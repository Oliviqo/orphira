const {
 net
} = require('electron');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const storage =
 require('./storage');

const debugEngine =
 require('./debug-engine');

 const {
 getUserAgent
} = require('./app-identity');

const {
 fetchMetadata
} = require('./metadata-engine');

const {
 ensureAssetDirectories
} = require('./track-assets');

/**
 * COSMIC PLAYER - COVER ART ARCHIVE PROVIDER
 *
 * Artwork capability официального ядра.
 *
 * Pipeline:
 * Track identity
 * -> MusicBrainz release MBID
 * -> Cover Art Archive release lookup
 * -> front artwork
 * -> userData/covers/downloaded
 *
 * Metadata и artwork намеренно остаются разными capabilities.
 */

const CAA_REQUEST_TIMEOUT_MS = 10000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 15000;
const CAA_REQUEST_INTERVAL_MS = 1100;

const HEADERS = {
 'User-Agent':
 getUserAgent(),
 'Accept':
 'application/json'
};

const IMAGE_HEADERS = {
 'User-Agent':
 getUserAgent(),
 'Accept':
 'image/*'
};

let lastCaaRequestTime = 0;

let caaQueue =
 Promise.resolve();

const releaseArtworkCache =
 new Map();

function sleep(milliseconds) {
 return new Promise(resolve => {
 setTimeout(
 resolve,
 milliseconds
 );
 });
}

function scheduleCaaRequest(
 requestFn
) {
 const scheduled =
 caaQueue
 .catch(() => null)
 .then(async () => {
 const elapsed =
 Date.now() -
 lastCaaRequestTime;

 if (
 elapsed <
 CAA_REQUEST_INTERVAL_MS
 ) {
 await sleep(
 CAA_REQUEST_INTERVAL_MS -
 elapsed
 );
 }

 lastCaaRequestTime =
 Date.now();

 return requestFn();
 });

 caaQueue =
 scheduled.catch(() => null);

 return scheduled;
}

function getRetryAfterMs(
 response
) {
 const rawValue =
 response?.headers?.get(
 'retry-after'
 );

 if (!rawValue) {
 return 0;
 }

 const seconds =
 Number(rawValue);

 if (
 Number.isFinite(seconds) &&
 seconds >= 0
 ) {
 return Math.min(
 seconds * 1000,
 30000
 );
 }

 const retryDate =
 Date.parse(rawValue);

 if (
 Number.isFinite(retryDate)
 ) {
 return Math.min(
 Math.max(
 0,
 retryDate - Date.now()
 ),
 30000
 );
 }

 return 0;
}

async function fetchCaaJson(
 url,
 retryAllowed = true
) {
 return scheduleCaaRequest(
 async () => {
 let mayRetry =
 retryAllowed;

 while (true) {
 const controller =
 new AbortController();

 const timer =
 setTimeout(
 () => controller.abort(),
 CAA_REQUEST_TIMEOUT_MS
 );

 try {
        const fetchFn = net.fetch;

 const response =
 await fetchFn(
 url,
 {
 headers: HEADERS,
 signal:
 controller.signal,
 redirect:
 'follow'
 }
 );

 if (
 response.status === 404
 ) {
 return null;
 }

 if (
 response.status === 429 &&
 mayRetry
 ) {
 mayRetry = false;

 const retryAfterMs =
 getRetryAfterMs(
 response
 );

 const waitMs =
 retryAfterMs > 0
 ? retryAfterMs
 : CAA_REQUEST_INTERVAL_MS;

 debugEngine.addLog(
 'COVERS',
 'warn',
 `Cover Art Archive rate limit. Retry after ${waitMs}ms.`
 );

 await sleep(
 waitMs
 );

 lastCaaRequestTime =
 Date.now();

 continue;
 }

 if (!response.ok) {
 debugEngine.addLog(
 'COVERS',
 'warn',
 `Cover Art Archive HTTP ${response.status}.`
 );

 return null;
 }

 return await response.json();
 } catch (error) {
 const message =
 error?.name === 'AbortError'
 ? 'request timeout'
 : error.message;

 debugEngine.addLog(
 'COVERS',
 'warn',
 `Cover Art Archive недоступен: ${message}`
 );

 return null;
 } finally {
 clearTimeout(timer);
 }
 }
 }
 );
}

function selectFrontArtwork(
 releaseData
) {
 const images =
 Array.isArray(
 releaseData?.images
 )
 ? releaseData.images
 : [];

 if (images.length === 0) {
 return null;
 }

 const frontImage =
 images.find(image =>
 image?.front === true
 ) ||
 images.find(image =>
 Array.isArray(image?.types) &&
 image.types.some(type =>
 String(type).toLowerCase() ===
 'front'
 )
 ) ||
 images[0];

 if (!frontImage) {
 return null;
 }

 const thumbnails =
 frontImage.thumbnails &&
 typeof frontImage.thumbnails ===
 'object'
 ? frontImage.thumbnails
 : {};

 const imageUrl =
 thumbnails['1200'] ||
 thumbnails.large ||
 thumbnails['500'] ||
 frontImage.image ||
 null;

 if (!imageUrl) {
 return null;
 }

 return {
 imageUrl,
 originalUrl:
 frontImage.image || imageUrl,
 front:
 Boolean(frontImage.front),
 approved:
 frontImage.approved !== false,
 id:
 frontImage.id || null
 };
}

async function resolveCaaArtwork(
 releaseId
) {
 if (!releaseId) {
 return null;
 }

 if (
 releaseArtworkCache.has(
 releaseId
 )
 ) {
 return releaseArtworkCache.get(
 releaseId
 );
 }

 const releaseUrl =
 `https://coverartarchive.org/release/${encodeURIComponent(releaseId)}`;

 const releaseData =
 await fetchCaaJson(
 releaseUrl
 );

 if (!releaseData) {
 releaseArtworkCache.set(
 releaseId,
 null
 );

 return null;
 }

 const artwork =
 selectFrontArtwork(
 releaseData
 );

 if (
 releaseArtworkCache.size >= 500
 ) {
 const oldestKey =
 releaseArtworkCache
 .keys()
 .next()
 .value;

 if (oldestKey) {
 releaseArtworkCache.delete(
 oldestKey
 );
 }
 }

 releaseArtworkCache.set(
 releaseId,
 artwork
 );

 return artwork;
}

function detectImageExtension(
 buffer,
 contentType
) {
 if (
 buffer.length >= 12 &&
 buffer[0] === 0x89 &&
 buffer[1] === 0x50 &&
 buffer[2] === 0x4e &&
 buffer[3] === 0x47
 ) {
 return 'png';
 }

 if (
 buffer.length >= 3 &&
 buffer[0] === 0xff &&
 buffer[1] === 0xd8 &&
 buffer[2] === 0xff
 ) {
 return 'jpg';
 }

 if (
 buffer.length >= 12 &&
 buffer.toString(
 'ascii',
 0,
 4
 ) === 'RIFF' &&
 buffer.toString(
 'ascii',
 8,
 12
 ) === 'WEBP'
 ) {
 return 'webp';
 }

 const normalizedType =
 String(
 contentType || ''
 )
 .toLowerCase();

 if (
 normalizedType.includes(
 'image/png'
 )
 ) {
 return 'png';
 }

 if (
 normalizedType.includes(
 'image/jpeg'
 ) ||
 normalizedType.includes(
 'image/jpg'
 )
 ) {
 return 'jpg';
 }

 if (
 normalizedType.includes(
 'image/webp'
 )
 ) {
 return 'webp';
 }

 return null;
}

async function downloadImageBuffer(
  imageUrl,
  retryAllowed = true
) {
  if (!imageUrl) {
    return null;
  }
  if (imageUrl.startsWith('http://')) {
    imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
  }
  const controller =
    new AbortController();
  const timer =
    setTimeout(
      () => controller.abort(),
      IMAGE_DOWNLOAD_TIMEOUT_MS
    );
  try {
      const fetchFn = net.fetch;
    const response =
      await fetchFn(
        imageUrl,
        {
          headers:
            IMAGE_HEADERS,
          signal:
            controller.signal,
          redirect:
            'follow'
        }
      );
    if (
      response.status === 429 &&
      retryAllowed
    ) {
      const retryAfterMs =
        getRetryAfterMs(
          response
        );
      if (retryAfterMs > 0) {
        await sleep(
          retryAfterMs
        );
      }
      return downloadImageBuffer(
        imageUrl,
        false
      );
    }
    if (!response.ok) {
      debugEngine.addLog(
        'COVERS',
        'warn',
        `Artwork image HTTP ${response.status}.`
      );
      return null;
    }
    const contentType =
      response.headers.get(
        'content-type'
      ) || '';
    const arrayBuffer =
      await response.arrayBuffer();
    const buffer =
      Buffer.from(
        arrayBuffer
      );
    if (
      buffer.length < 12
    ) {
      return null;
    }
    const extension =
      detectImageExtension(
        buffer,
        contentType
      );
    if (!extension) {
      debugEngine.addLog(
        'COVERS',
        'warn',
        'Cover Art Archive вернул данные, которые не удалось подтвердить как поддерживаемое изображение.'
      );
      return null;
    }
    return {
      buffer,
      contentType,
      extension
    };
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'download timeout'
        : error.message;
    debugEngine.addLog(
      'COVERS',
      'warn',
      `Ошибка загрузки изображения CAA: ${message}`
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function saveCoverBufferToDisk(
 buffer,
 extension
) {
 if (
 !buffer ||
 !extension
 ) {
 return null;
 }

 try {
 const directories =
 ensureAssetDirectories(
 storage.getCoversPath()
 );

 if (!directories) {
 return null;
 }

 const hash =
 crypto
 .createHash('sha256')
 .update(buffer)
 .digest('hex');

 const filePath =
 path.join(
 directories.coversDownloaded,
 `${hash}.${extension}`
 );

 if (
 !fs.existsSync(
 filePath
 )
 ) {
 fs.writeFileSync(
 filePath,
 buffer
 );
 }

 return filePath;
 } catch (error) {
 debugEngine.addLog(
 'COVERS',
 'error',
 `Не удалось сохранить CAA artwork: ${error.message}`
 );

 return null;
 }
}

async function downloadAndSaveCover(
 coverUrl
) {
 if (!coverUrl) {
 return null;
 }

 const downloaded =
 await downloadImageBuffer(
 coverUrl
 );

 if (!downloaded) {
 return null;
 }

 return saveCoverBufferToDisk(
 downloaded.buffer,
 downloaded.extension
 );
}

async function resolveReleaseIdentity(
 rawArtist,
 rawTitle,
 filePath
) {
 const metadata =
 await fetchMetadata(
 rawArtist,
 rawTitle,
 filePath,
 'COVERS'
 );

 if (
 !metadata ||
 metadata.unavailable === true
 ) {
 if (
 metadata?.reason ===
 'acoustid-key-required'
 ) {
 debugEngine.addLog(
 'COVERS',
 'info',
 'Cover lookup остановлен: MusicBrainz не дал достаточной identity, а пользовательский AcoustID API-ключ не настроен.'
 );
 }

 return null;
 }

 const primaryReleaseId =
 metadata.musicBrainz?.albumId ||
 null;

 const alternativeReleaseIds =
 Array.isArray(
 metadata.musicBrainz?.releaseIds
 )
 ? metadata.musicBrainz.releaseIds
 : [];

 const releaseIds =
 [
 primaryReleaseId,
 ...alternativeReleaseIds
 ]
 .filter(Boolean)
 .filter(
 (value, index, array) =>
 array.indexOf(value) ===
 index
 )
 .slice(0, 5);

 if (
 releaseIds.length === 0
 ) {
 debugEngine.addLog(
 'COVERS',
 'warn',
 'MusicBrainz/AcoustID подтвердили трек, но release MBID для Cover Art Archive отсутствует.'
 );

 return null;
 }

 return {
 releaseId:
 releaseIds[0],
 releaseIds,
 metadata
 };
}

async function fetchAndSaveCover(
 rawArtist,
 rawTitle,
 filePath = ''
) {
 const startedAt =
 Date.now();

 debugEngine.addLog(
 'COVERS',
 'info',
 `Cover Art Archive lookup: "${rawArtist || 'Unknown'}" — "${rawTitle || 'Unknown'}".`
 );

 const identity =
 await resolveReleaseIdentity(
 rawArtist,
 rawTitle,
 filePath
 );

 if (!identity) {
 return null;
 }

 const releaseIds =
 Array.isArray(identity.releaseIds)
 ? identity.releaseIds
 : [identity.releaseId];

 debugEngine.addLog(
 'COVERS',
 'info',
 `MusicBrainz release candidates для CAA: ${releaseIds.length}.`,
 {
 releaseIds
 }
 );

 for (
 let index = 0;
 index < releaseIds.length;
 index++
 ) {
 const releaseId =
 releaseIds[index];

 const artwork =
 await resolveCaaArtwork(
 releaseId
 );

 if (!artwork?.imageUrl) {
 debugEngine.addLog(
 'COVERS',
 'info',
 `CAA: front artwork отсутствует для release ${releaseId} (${index + 1}/${releaseIds.length}).`
 );

 continue;
 }

 const savedPath =
 await downloadAndSaveCover(
 artwork.imageUrl
 );

 if (!savedPath) {
 debugEngine.addLog(
 'COVERS',
 'warn',
 `CAA artwork найден для ${releaseId}, но изображение скачать не удалось.`
 );

 continue;
 }

 debugEngine.addLog(
 'COVERS',
 'success',
 `Cover Art Archive artwork сохранён за ${Date.now() - startedAt}мс.`,
 {
 releaseId,
 candidate:
 `${index + 1}/${releaseIds.length}`,
 imageId:
 artwork.id,
 savedPath
 }
 );

 return savedPath;
 }

 debugEngine.addLog(
 'COVERS',
 'warn',
 `Cover Art Archive не содержит доступной front artwork ни для одного из ${releaseIds.length} найденных изданий.`
 );

 return null;
}

function collectStoredReleaseIds(
 track
) {
 const candidates = [
 track?.enrichedMetadata
 ?.musicBrainz?.albumId,
 track?.sourceMetadata
 ?.musicBrainz?.albumId
 ];
 const enrichedReleaseIds =
 Array.isArray(
 track?.enrichedMetadata
 ?.musicBrainz?.releaseIds
 )
 ? track.enrichedMetadata
 .musicBrainz.releaseIds
 : [];
 const sourceReleaseIds =
 Array.isArray(
 track?.sourceMetadata
 ?.musicBrainz?.releaseIds
 )
 ? track.sourceMetadata
 .musicBrainz.releaseIds
 : [];
 return [
 ...candidates,
 ...enrichedReleaseIds,
 ...sourceReleaseIds
 ]
 .filter(Boolean)
 .map(value =>
 String(value).trim()
 )
 .filter(Boolean)
 .filter(
 (value, index, array) =>
 array.indexOf(value) === index
 )
 .slice(0, 5);
}

async function fetchAndSaveCoverFromTrackIdentity(
 track
) {
 if (!track) {
 return null;
 }
 const releaseIds =
 collectStoredReleaseIds(
 track
 );
 if (releaseIds.length === 0) {
 return null;
 }
 debugEngine.addLog(
 'COVERS',
 'info',
 `Используем сохранённую MusicBrainz release identity без повторного metadata lookup. Кандидатов: ${releaseIds.length}.`,
 {
 releaseIds,
 trackId:
 track.id || null
 }
 );
 for (
 let index = 0;
 index < releaseIds.length;
 index++
 ) {
 const releaseId =
 releaseIds[index];
 const artwork =
 await resolveCaaArtwork(
 releaseId
 );
 if (!artwork?.imageUrl) {
 continue;
 }
 const savedPath =
 await downloadAndSaveCover(
 artwork.imageUrl
 );
 if (!savedPath) {
 continue;
 }
 debugEngine.addLog(
 'COVERS',
 'success',
 `CAA artwork получен напрямую по сохранённому release MBID (${index + 1}/${releaseIds.length}).`,
 {
 releaseId,
 savedPath
 }
 );
 return savedPath;
 }
 return null;
}

function clearCaaMemoryCache() {
 releaseArtworkCache.clear();
}

module.exports = {
 fetchAndSaveCover,
 fetchAndSaveCoverFromTrackIdentity,
 downloadAndSaveCover,
 clearCaaMemoryCache
};