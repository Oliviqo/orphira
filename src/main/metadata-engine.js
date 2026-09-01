const { net } = require('electron');
const fs = require('fs');
const {
  generateQueryPasses,
  cleanString,
  cleanTitle,
  calculateSimilarity,
  isNumericOrJunkQuery
} = require('./query-cleaner');

const {
  lookupAcoustId,
  isAcoustIdConfigured
} = require('./acoustic-engine');

const debugEngine = require('./debug-engine');
const { getUserAgent } = require('./app-identity');

/**
 * COSMIC PLAYER - MUSICBRAINZ METADATA ENGINE
 *
 * Production capabilities:
 * - MusicBrainz: bibliographic metadata and release identity;
 * - AcoustID: acoustic identity fallback.
 *
 * Artwork remains a separate Cover Art Archive capability.
 */

const REQUEST_TIMEOUT_MS = 10000;
const MUSICBRAINZ_REQUEST_INTERVAL_MS = 1200;
const MUSICBRAINZ_ERROR_COOLDOWN_MS = 15000;

const MUSICBRAINZ_HEADERS = {
  'User-Agent': getUserAgent(),
  'Accept': 'application/json'
};

let lastMusicBrainzRequestTime = 0;
let musicBrainzCooldownUntil = 0;
let musicBrainzQueue = Promise.resolve();

const recordingCache = new Map();

function sleep(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function getRetryAfterMs(response) {
  const raw = response?.headers?.get('retry-after');
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60000);
  }
  const retryDate = Date.parse(raw);
  if (Number.isFinite(retryDate)) {
    return Math.min(Math.max(0, retryDate - Date.now()), 60000);
  }
  return 0;
}

function isMusicBrainzCoolingDown() {
 return Date.now() < musicBrainzCooldownUntil;
}

function activateMusicBrainzCooldown(reason, durationMs = MUSICBRAINZ_ERROR_COOLDOWN_MS) {
 const safeDuration =
 Number.isFinite(Number(durationMs)) && Number(durationMs) > 0
 ? Number(durationMs)
 : MUSICBRAINZ_ERROR_COOLDOWN_MS;

 musicBrainzCooldownUntil = Math.max(
 musicBrainzCooldownUntil,
 Date.now() + safeDuration
 );

 debugEngine.addLog(
 'METADATA',
 'warn',
 `MusicBrainz временно отключён на ${safeDuration}мс: ${reason}`
 );
}

function scheduleMusicBrainzRequest(requestFn) {
 if (isMusicBrainzCoolingDown()) {
 return Promise.resolve(null);
 }

 const scheduled = musicBrainzQueue
 .catch(() => null)
 .then(async () => {
 if (isMusicBrainzCoolingDown()) {
 return null;
 }

 const elapsed =
 Date.now() - lastMusicBrainzRequestTime;

 if (elapsed < MUSICBRAINZ_REQUEST_INTERVAL_MS) {
 await sleep(
 MUSICBRAINZ_REQUEST_INTERVAL_MS - elapsed
 );
 }

 if (isMusicBrainzCoolingDown()) {
 return null;
 }

 lastMusicBrainzRequestTime =
 Date.now();

 return requestFn();
 });

 musicBrainzQueue =
 scheduled.catch(() => null);

 return scheduled;
}

async function performMusicBrainzTransportFetch(
 fetchFn,
 transportName,
 url
) {
 const controller =
 new AbortController();

 const timer =
 setTimeout(
 () => controller.abort(),
 REQUEST_TIMEOUT_MS
 );

 try {
 const response =
 await fetchFn(
 url,
 {
 headers: MUSICBRAINZ_HEADERS,
 signal: controller.signal
 }
 );

 return {
 response,
 error: null,
 transportName
 };
 } catch (error) {
 return {
 response: null,
 error,
 transportName
 };
 } finally {
 clearTimeout(timer);
 }
}

const MUSICBRAINZ_TRANSIENT_RETRY_DELAY_MS = 1500;

async function waitForMusicBrainzRetry(response) {
 const retryAfterMs =
 getRetryAfterMs(response);

 const delayMs =
 retryAfterMs > 0
 ? retryAfterMs
 : MUSICBRAINZ_TRANSIENT_RETRY_DELAY_MS;

 debugEngine.addLog(
 'METADATA',
 'info',
 `MusicBrainz HTTP ${response.status}. Повторная попытка через ${delayMs}мс.`
 );

 await sleep(delayMs);
}

async function performMusicBrainzFetch(url) {
 const transports = [];

 if (
 typeof globalThis.fetch === 'function'
 ) {
 transports.push({
 name: 'Node',
 fetchFn: globalThis.fetch.bind(globalThis)
 });
 }

 if (
 net &&
 typeof net.fetch === 'function'
 ) {
 transports.push({
 name: 'Electron',
 fetchFn: net.fetch.bind(net)
 });
 }

 if (transports.length === 0) {
 activateMusicBrainzCooldown(
 'в Main Process отсутствует доступный HTTP transport.'
 );
 return null;
 }

 let lastError = null;
 let lastTransientStatus = null;

 for (const transport of transports) {
 let retryAllowed = true;

 while (true) {
 const result =
 await performMusicBrainzTransportFetch(
 transport.fetchFn,
 transport.name,
 url
 );

 if (result.error) {
 lastError =
 result.error;

 const message =
 result.error?.name === 'AbortError'
 ? 'request timeout'
 : (
 result.error?.message ||
 String(result.error)
 );

 debugEngine.addLog(
 'METADATA',
 'warn',
 `MusicBrainz transport ${transport.name} недоступен: ${message}`
 );

 break;
 }

 const response =
 result.response;

 if (!response) {
 break;
 }

 if (
 response.status === 429 ||
 response.status === 503
 ) {
 lastTransientStatus =
 response.status;

 if (retryAllowed) {
 retryAllowed = false;

 await waitForMusicBrainzRetry(
 response
 );

 continue;
 }

 debugEngine.addLog(
 'METADATA',
 'warn',
 `MusicBrainz HTTP ${response.status} повторно получен через transport ${transport.name}.`
 );

 break;
 }

 if (!response.ok) {
 debugEngine.addLog(
 'METADATA',
 'warn',
 `MusicBrainz HTTP ${response.status} через transport ${transport.name}.`
 );

 return null;
 }

 try {
 const data =
 await response.json();

 debugEngine.addLog(
 'METADATA',
 'info',
 `MusicBrainz соединение успешно через transport ${transport.name}.`
 );

 return data;
 } catch (error) {
 debugEngine.addLog(
 'METADATA',
 'warn',
 `MusicBrainz вернул некорректный JSON через transport ${transport.name}: ${error.message}`
 );

 return null;
 }
 }
 }

 if (lastTransientStatus !== null) {
 activateMusicBrainzCooldown(
 `повторный HTTP ${lastTransientStatus} после transient retry.`
 );

 return null;
 }

 const finalMessage =
 lastError?.name === 'AbortError'
 ? 'request timeout'
 : (
 lastError?.message ||
 'все сетевые transport недоступны'
 );

 activateMusicBrainzCooldown(
 finalMessage
 );

 return null;
}

function fetchMusicBrainzJson(url) {
 if (isMusicBrainzCoolingDown()) {
 return Promise.resolve(null);
 }

 return scheduleMusicBrainzRequest(
 () => performMusicBrainzFetch(url)
 );
}

function normalizeArtistCredit(recording) {
  const credits = Array.isArray(recording?.['artist-credit'])
    ? recording['artist-credit']
    : [];

  return cleanString(
    credits
      .map(credit => credit?.name || credit?.artist?.name || '')
      .filter(Boolean)
      .join(', ')
  );
}

function normalizeReleaseArtist(release, fallbackArtist) {
  const credits = Array.isArray(release?.['artist-credit'])
    ? release['artist-credit']
    : [];

  const releaseArtist = cleanString(
    credits
      .map(credit => credit?.name || credit?.artist?.name || '')
      .filter(Boolean)
      .join(', ')
  );

  return releaseArtist || fallbackArtist || null;
}

function normalizeYear(value) {
  const match = String(value || '').match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year) || year < 1000 || year > 9999) {
    return null;
  }
  return year;
}

function calculateCandidateScore(recording, expectedTitle, expectedArtist) {
  const candidateTitle = cleanTitle(recording?.title || '');
  const candidateArtist = normalizeArtistCredit(recording);

  if (!candidateTitle || !expectedTitle) {
    return null;
  }

  const titleSimilarity = calculateSimilarity(candidateTitle, expectedTitle);
  const artistKnown = Boolean(
    expectedArtist && expectedArtist !== 'Unknown Artist'
  );

  const artistSimilarity = artistKnown
    ? calculateSimilarity(candidateArtist, expectedArtist)
    : 1;

  const accepted = artistKnown
    ? titleSimilarity >= 0.62 && artistSimilarity >= 0.48
    : titleSimilarity >= 0.84;

  if (!accepted) {
    return null;
  }

  return {
    accepted: true,
    score: titleSimilarity * 0.65 + artistSimilarity * 0.35,
    titleSimilarity,
    artistSimilarity,
    title: candidateTitle,
    artist: candidateArtist
  };
}

function getReleaseScore(release) {
  let score = 0;
  const status = String(release?.status || '').toLowerCase();

  if (status === 'official') score += 100;
  if (release?.id) score += 20;
  if (release?.title) score += 10;
  if (release?.date) score += 5;
  if (release?.['release-group']?.id) score += 5;

  const country = String(release?.country || '').toUpperCase();
  if (country === 'XW') score += 6;

  return score;
}

function selectBestRelease(recording) {
  const releases = Array.isArray(recording?.releases)
    ? recording.releases.filter(release => release?.id)
    : [];

  if (releases.length === 0) return null;

  const sorted = [...releases].sort(
    (a, b) => getReleaseScore(b) - getReleaseScore(a)
  );

  return sorted[0] || null;
}

function buildMetadataResult(recording, validation) {
  const release = selectBestRelease(recording);
  const releaseGroup = release?.['release-group'] || null;
  const releaseDate =
    release?.date || releaseGroup?.['first-release-date'] || null;

  const releaseIds = Array.isArray(recording?.releases)
    ? recording.releases
        .filter(candidate => candidate?.id)
        .sort((a, b) => getReleaseScore(b) - getReleaseScore(a))
        .map(candidate => candidate.id)
        .filter((value, index, array) => array.indexOf(value) === index)
    : [];

  const isrc = Array.isArray(recording?.isrcs)
    ? recording.isrcs.map(value => cleanString(value)).filter(Boolean)
    : [];

  const artist =
    validation?.artist || normalizeArtistCredit(recording);
  const title = validation?.title || cleanTitle(recording?.title || '');

  return {
    source: 'MusicBrainz',
    artist: artist || null,
    title: title || null,
    album: cleanString(release?.title || '') || null,
    albumArtist: normalizeReleaseArtist(release, artist),
    year: normalizeYear(releaseDate),
    releaseDate: releaseDate || null,
    genres: [],
    genre: '',
    labels: [],
    catalogNumber: [],
    barcode: null,
    isrc,
    musicBrainz: {
      trackId: recording?.id || null,
      releaseTrackId: null,
      albumId: release?.id || null,
      releaseIds,
      releaseGroupId: releaseGroup?.id || null
    },
    trackNumber: null,
    trackTotal: null,
    discNumber: null,
    discTotal: null,
    explicit: null,
    coverUrl: null,
    duration: recording?.length
      ? Math.round(Number(recording.length) / 1000)
      : 0,
    isCoverFallback: false
  };
}

function safeRecordingCacheSet(recordingId, value) {
  if (!recordingId) return;

  if (recordingCache.size >= 500) {
    const oldest = recordingCache.keys().next().value;
    if (oldest) {
      recordingCache.delete(oldest);
    }
  }

  recordingCache.set(recordingId, value);
}

async function lookupRecordingById(
  recordingId,
  expectedArtist = '',
  expectedTitle = ''
) {
  if (!recordingId) return null;

  if (recordingCache.has(recordingId)) {
    return recordingCache.get(recordingId);
  }

  const url = `https://musicbrainz.org/ws/2/recording/${encodeURIComponent(
    recordingId
  )}?fmt=json&inc=artists+releases+release-groups+isrcs`;

  debugEngine.addLog(
    'METADATA',
    'info',
    `[MusicBrainz ID] ${recordingId}`
  );

  const recording = await fetchMusicBrainzJson(url);
  if (!recording?.id) return null;

  let validation = null;

  if (expectedTitle) {
    validation = calculateCandidateScore(
      recording,
      expectedTitle,
      expectedArtist
    );

    if (!validation) {
      debugEngine.addLog(
        'METADATA',
        'warn',
        `MusicBrainz recording ${recordingId} не прошёл проверку Artist/Title.`
      );
      return null;
    }
  } else {
    validation = {
      artist: normalizeArtistCredit(recording),
      title: cleanTitle(recording.title || '')
    };
  }

  const result = buildMetadataResult(recording, validation);
  safeRecordingCacheSet(recordingId, result);
  return result;
}

async function searchMusicBrainz(query, expectedTitle, expectedArtist) {
  if (!query || !expectedTitle || isNumericOrJunkQuery(query)) {
    return null;
  }

  const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=10`;

  const data = await fetchMusicBrainzJson(url);

  if (!Array.isArray(data?.recordings) || data.recordings.length === 0) {
    return null;
  }

  let bestCandidate = null;

  for (const recording of data.recordings) {
    const validation = calculateCandidateScore(
      recording,
      expectedTitle,
      expectedArtist
    );

    if (!validation) continue;

    if (
      !bestCandidate ||
      validation.score > bestCandidate.validation.score
    ) {
      bestCandidate = { recording, validation };
    }
  }

  if (!bestCandidate) return null;

  const result = buildMetadataResult(
    bestCandidate.recording,
    bestCandidate.validation
  );

  if (result.musicBrainz.trackId) {
    safeRecordingCacheSet(result.musicBrainz.trackId, result);
  }

  return result;
}

async function executeMusicBrainzPasses(passes, startedAt, maxPasses = 2) {
  const safePasses = passes.slice(0, Math.max(1, maxPasses));

  for (let index = 0; index < safePasses.length; index++) {
    const pass = safePasses[index];

    if (!pass?.query || !pass?.title) continue;

    debugEngine.addLog(
      'METADATA',
      'info',
      `[MusicBrainz ${index + 1}/${safePasses.length}] "${pass.query}"`
    );

    const result = await searchMusicBrainz(
      pass.query,
      pass.title,
      pass.artist
    );

    if (result) {
      debugEngine.addLog(
        'METADATA',
        'success',
        `MusicBrainz metadata найдены за ${Date.now() - startedAt}мс.`,
        {
          artist: result.artist,
          title: result.title,
          album: result.album,
          releaseId: result.musicBrainz?.albumId || null
        }
      );

      return result;
    }

    if (Date.now() < musicBrainzCooldownUntil) {
      break;
    }
  }

  return null;
}

async function resolveAcousticMetadata(acousticIdentity, startedAt) {
  if (!acousticIdentity?.artist || !acousticIdentity?.title) {
    return null;
  }
  const recordingId = acousticIdentity?.musicBrainz?.trackId || null;
  if (recordingId) {
    const directResult = await lookupRecordingById(
      recordingId,
      acousticIdentity.artist,
      acousticIdentity.title
    );
    if (directResult) {
      debugEngine.addLog(
        'METADATA',
        'success',
        `MusicBrainz release identity получена напрямую по AcoustID recording MBID за ${Date.now() - startedAt}мс.`,
        {
          recordingId,
          releaseId: directResult.musicBrainz?.albumId || null
        }
      );
      return directResult;
    }
  }
  const passes = generateQueryPasses(
    acousticIdentity.artist,
    acousticIdentity.title
  );
  if (passes.length === 0) {
    return null;
  }
  return executeMusicBrainzPasses(passes, startedAt, 1);
}

function createAcoustIdRequiredResult(reason) {
  return {
    unavailable: true,
    reason: 'acoustid-key-required',
    acousticReason: reason || 'fallback-required'
  };
}

async function fetchMetadata(
  rawArtist,
  rawTitle,
  filePath = '',
  logCategory = 'METADATA'
) {
  const startedAt = Date.now();
  debugEngine.addLog(
    logCategory,
    'info',
    `Metadata lookup: "${rawArtist || 'Unknown'}" — "${rawTitle || 'Unknown'}".`
  );
  let targetArtist = cleanString(rawArtist || '');
  let targetTitle = cleanTitle(rawTitle || '');
  let acousticIdentity = null;
  const combinedIdentity = `${rawArtist || ''} ${rawTitle || ''}`;
  const identityUnreliable =
    !targetArtist ||
    targetArtist === 'Unknown Artist' ||
    !targetTitle ||
    isNumericOrJunkQuery(combinedIdentity);

  // 1. Если данные ненадёжны — проверяем AcoustID (если настроен)
  if (identityUnreliable && filePath && fs.existsSync(filePath)) {
    if (!isAcoustIdConfigured()) {
      debugEngine.addLog(
        logCategory,
        'warn',
        'Metadata identity недостаточно надёжна, но акустическое распознавание недоступно: пользовательский AcoustID API-ключ не настроен.'
      );
      return createAcoustIdRequiredResult('unreliable-track-identity');
    }
    acousticIdentity = await lookupAcoustId(filePath);
    if (acousticIdentity?.artist && acousticIdentity?.title) {
      targetArtist = acousticIdentity.artist;
      targetTitle = acousticIdentity.title;
      const directResult = await resolveAcousticMetadata(
        acousticIdentity,
        startedAt
      );
      if (directResult) {
        return directResult;
      }
    }
  }

  // 2. Ищем в MusicBrainz по названию и артисту
  const passes = generateQueryPasses(targetArtist, targetTitle, filePath);
  if (passes.length > 0) {
    const result = await executeMusicBrainzPasses(passes, startedAt, 2);
    if (result) {
      return result;
    }
  }

  // 3. Если текстовый поиск не дал результатов — пробуем AcoustID fallback
  if (!acousticIdentity && filePath && fs.existsSync(filePath)) {
    if (!isAcoustIdConfigured()) {
      const wasMbUnavailable = Date.now() < musicBrainzCooldownUntil;
      const reason = wasMbUnavailable
        ? 'musicbrainz-unavailable'
        : 'acoustid-key-required';
      debugEngine.addLog(
        logCategory,
        'info',
        `MusicBrainz не нашёл достаточное совпадение.${wasMbUnavailable ? ' Сервер MusicBrainz временно недоступен (cooldown).' : ''} Acoustic fallback пропущен: API-ключ AcoustID не настроен.`
      );
      return {
        unavailable: true,
        reason,
        acousticReason: 'fallback-required'
      };
    }
    acousticIdentity = await lookupAcoustId(filePath);
    if (acousticIdentity) {
      const result = await resolveAcousticMetadata(
        acousticIdentity,
        startedAt
      );
      if (result) {
        return result;
      }
    }
  }

  // 4. Подтверждённая AcoustID identity при отсутствии релизов в MusicBrainz
  if (acousticIdentity?.artist && acousticIdentity?.title) {
    debugEngine.addLog(
      logCategory,
      'success',
      'MusicBrainz release metadata недоступны; используется подтверждённая AcoustID identity.'
    );
    return {
      source: 'AcoustID',
      artist: acousticIdentity.artist,
      title: acousticIdentity.title,
      album: acousticIdentity.album || null,
      albumArtist: acousticIdentity.artist,
      year: acousticIdentity.year || null,
      genres: [],
      genre: '',
      labels: [],
      catalogNumber: [],
      barcode: null,
      isrc: [],
      musicBrainz: acousticIdentity.musicBrainz || {},
      coverUrl: null,
      duration: 0,
      isCoverFallback: false
    };
  }

  debugEngine.addLog(
    logCategory,
    'warn',
    `Metadata не найдены за ${Date.now() - startedAt}мс.`
  );
  return null;
}

module.exports = {
  fetchMetadata
};