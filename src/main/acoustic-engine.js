const { net, app } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');
const debugEngine = require('./debug-engine');
const { getUserAgent } = require('./app-identity');
const { cleanString, cleanTitle } = require('./query-cleaner');

/**
 * COSMIC PLAYER - ACOUSTIC IDENTIFICATION ENGINE
 *
 * Назначение:
 * - локально вычисляет Chromaprint через отдельный fpcalc process;
 * - отправляет AcoustID только fingerprint и duration;
 * - никогда не отправляет сам аудиофайл;
 * - использует пользовательский API-ключ AcoustID из настроек;
 * - не обращается к metadata/artwork/lyrics providers.
 */

const REQUEST_TIMEOUT_MS = 8000;
const MIN_REQUEST_INTERVAL_MS = 450;

const HEADERS = {
  'User-Agent': getUserAgent(),
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json'
};

const acousticCache = new Map();

let lastAcoustIdRequestTime = 0;
let acoustIdQueueChain = Promise.resolve();

function scheduleAcoustIdApiCall(apiCallFn) {
  acoustIdQueueChain = acoustIdQueueChain.then(async () => {
    const now = Date.now();
    const elapsed = now - lastAcoustIdRequestTime;

    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(resolve => {
        setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed);
      });
    }

    lastAcoustIdRequestTime = Date.now();

    return apiCallFn();
  });

  return acoustIdQueueChain;
}

function resolveFpcalcBinary() {
 const platform = process.platform;
 const arch = process.arch;
 const binaryName =
 platform === 'win32'
 ? 'fpcalc.exe'
 : 'fpcalc';
 const platformDirectory =
 `${platform}-${arch}`;
 const possiblePaths = [];
 if (app?.isPackaged) {
 possiblePaths.push(
 path.join(
 process.resourcesPath,
 'fpcalc',
 platformDirectory,
 binaryName
 )
 );
 }
 if (app?.getAppPath) {
 possiblePaths.push(
 path.join(
 app.getAppPath(),
 'src',
 'main',
 'assets',
 'fpcalc',
 platformDirectory,
 binaryName
 )
 );
 }
 possiblePaths.push(
 path.join(
 __dirname,
 'assets',
 'fpcalc',
 platformDirectory,
 binaryName
 )
 );
 for (const binaryPath of possiblePaths) {
 if (!fs.existsSync(binaryPath)) {
 continue;
 }
 if (platform !== 'win32') {
 try {
 fs.accessSync(
 binaryPath,
 fs.constants.X_OK
 );
 } catch (error) {
 try {
 fs.chmodSync(
 binaryPath,
 0o755
 );
 } catch (chmodError) {
 debugEngine.addLog(
 'ACOUSTIC',
 'warn',
 `Не удалось установить executable permission для fpcalc: ${binaryPath}`
 );
 continue;
 }
 }
 }
 return binaryPath;
 }
 debugEngine.addLog(
 'ACOUSTIC',
 'warn',
 `fpcalc не найден для платформы ${platform}-${arch}.`
 );
 return null;
}

function generateChromaprint(filePath) {
  return new Promise(resolve => {
    const binaryPath = resolveFpcalcBinary();

    if (!binaryPath) {
      debugEngine.addLog(
        'ACOUSTIC',
        'warn',
        'fpcalc не найден. Акустическое распознавание недоступно.'
      );
      resolve(null);
      return;
    }

    execFile(
      binaryPath,
      ['-json', filePath],
      {
        timeout: 15000,
        windowsHide: true
      },
      (error, stdout) => {
        if (error) {
          debugEngine.addLog(
            'ACOUSTIC',
            'warn',
            `fpcalc завершился с ошибкой: ${error.message}`
          );
          resolve(null);
          return;
        }

        try {
          const parsed = JSON.parse(stdout);

          if (parsed?.fingerprint && parsed?.duration) {
            resolve({
              fingerprint: parsed.fingerprint,
              duration: Number(parsed.duration)
            });
            return;
          }
        } catch (error) {
          debugEngine.addLog(
            'ACOUSTIC',
            'warn',
            `Не удалось разобрать ответ fpcalc: ${error.message}`
          );
        }

        resolve(null);
      }
    );
  });
}

function safeCacheSet(key, value) {
  if (acousticCache.size >= 2000) {
    const oldestKey = acousticCache.keys().next().value;
    if (oldestKey) {
      acousticCache.delete(oldestKey);
    }
  }

  acousticCache.set(key, value);
}

function isAcoustIdConfigured() {
  const userKey = String(storage.getConfig()?.acoustidKey || '').trim();
  return userKey.length > 0;
}

async function lookupAcoustId(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const userKey = String(storage.getConfig()?.acoustidKey || '').trim();
  if (!userKey) {
    debugEngine.addLog(
      'ACOUSTIC',
      'info',
      'AcoustID пропущен: пользовательский API-ключ не настроен.'
    );
    return null;
  }

  if (acousticCache.has(filePath)) {
    return acousticCache.get(filePath);
  }

  const fileName = path.basename(filePath);

  debugEngine.addLog(
    'ACOUSTIC',
    'info',
    `Локальное вычисление Chromaprint: ${fileName}`
  );

  const startedAt = Date.now();

  const fingerprintData = await generateChromaprint(filePath);

  if (
    !fingerprintData?.fingerprint ||
    !Number.isFinite(fingerprintData.duration)
  ) {
    safeCacheSet(filePath, null);
    return null;
  }

  const duration = Math.max(1, Math.round(fingerprintData.duration));

  debugEngine.addLog(
    'ACOUSTIC',
    'info',
    `Chromaprint готов. В AcoustID отправляются только fingerprint и duration=${duration}.`
  );

  return scheduleAcoustIdApiCall(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const body = new URLSearchParams();
      body.append('client', userKey);
      body.append('format', 'json');
      body.append('duration', String(duration));
      body.append('fingerprint', fingerprintData.fingerprint);
      body.append('meta', 'recordings releasegroups');

        const fetchFn = net.fetch;
        
      const response = await fetchFn('https://api.acoustid.org/v2/lookup', {
        method: 'POST',
        headers: HEADERS,
        body: body.toString(),
        signal: controller.signal
      });

      if (!response.ok) {
        debugEngine.addLog(
          'ACOUSTIC',
          'warn',
          `AcoustID HTTP ${response.status}.`
        );
        safeCacheSet(filePath, null);
        return null;
      }

      const data = await response.json();

      if (data?.status !== 'ok' || !Array.isArray(data.results)) {
        safeCacheSet(filePath, null);
        return null;
      }

      for (const result of data.results) {
        const score = Number(result?.score) || 0;

        if (score < 0.30 || !Array.isArray(result.recordings)) {
          continue;
        }

        for (const recording of result.recordings) {
          const artist = cleanString(
            recording?.artists?.[0]?.name ||
            recording?.['artist-credit']?.[0]?.name ||
            ''
          );

          const title = cleanTitle(recording?.title || '');

          if (!artist || !title) {
            continue;
          }

          const releaseGroup = recording?.releasegroups?.[0] || null;
          const releaseDate = releaseGroup?.['first-release-date'] || '';
          const yearMatch = String(releaseDate).match(/^(\d{4})/);

          const finalResult = {
            source: 'AcoustID',
            artist,
            title,
            album: cleanString(releaseGroup?.title || '') || null,
            year: yearMatch ? Number(yearMatch[1]) : null,
            musicBrainz: {
              trackId: recording?.id || null,
              releaseGroupId: releaseGroup?.id || null
            }
          };

          safeCacheSet(filePath, finalResult);

          debugEngine.addLog(
            'ACOUSTIC',
            'success',
            `AcoustID распознал "${artist}" — "${title}" за ${Date.now() - startedAt}мс.`,
            {
              score: Math.round(score * 100),
              duration
            }
          );

          return finalResult;
        }
      }

      debugEngine.addLog(
        'ACOUSTIC',
        'info',
        'AcoustID не вернул достаточно надёжного совпадения.'
      );

      safeCacheSet(filePath, null);
      return null;
    } catch (error) {
      const message =
        error?.name === 'AbortError' ? 'тайм-аут запроса' : error.message;

      debugEngine.addLog(
        'ACOUSTIC',
        'warn',
        `AcoustID недоступен: ${message}`
      );

      safeCacheSet(filePath, null);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  });
}

function clearAcousticCache() {
  acousticCache.clear();

  debugEngine.addLog(
    'ACOUSTIC',
    'info',
    'RAM-кэш результатов AcoustID очищен.'
  );
}

module.exports = {
  lookupAcoustId,
  isAcoustIdConfigured,
  clearAcousticCache
};