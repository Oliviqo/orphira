const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const debugEngine = require('./debug-engine');
const {
 fetchAndSaveCover,
 fetchAndSaveCoverFromTrackIdentity
} = require('./covers-engine');
const { fetchMetadata } = require('./metadata-engine');
const { cleanTitle, cleanString } = require('./query-cleaner');
const {
 applyEnrichment,
 needsMetadataEnrichment
} = require('./track-metadata');

/**
 * COSMIC PLAYER - STORAGE CONTROL & BATCH PROCESSOR
 * Контроль памяти, подсчёт файлов и пакетная обработка обложек/метаданных
 */
let activeBatchCancelFlag = false;
let activeBatchState = {
 running: false,
 type: null,
 mode: null,
 current: 0,
 total: 0,
 enrichedCount: 0,
 downloadedCount: 0,
 canceled: false
};

function getBatchStatus() {
 return activeBatchState;
}
function getFolderSize(dirPath) {
 let totalSize = 0;

 try {
  if (
   !dirPath ||
   !fs.existsSync(dirPath)
  ) {
   return 0;
  }

  const entries =
   fs.readdirSync(
    dirPath,
    {
     withFileTypes: true
    }
   );

  for (const entry of entries) {
   const entryPath =
    path.join(
     dirPath,
     entry.name
    );

   if (entry.isDirectory()) {
    totalSize +=
     getFolderSize(
      entryPath
     );

    continue;
   }

   if (entry.isFile()) {
    try {
     totalSize +=
      fs.statSync(
       entryPath
      ).size;
    } catch (e) {}
   }
  }
 } catch (e) {}

 return totalSize;
}
function formatBytes(bytes) {
 if (!bytes || bytes <= 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function hasTrackCover(track) {
 if (!track) {
  return false;
 }

 const coverCandidates = [
  track.downloadedCoverPath,
  track.embeddedCoverPath,
  track.coverPath
 ];

 return coverCandidates.some(
  coverPath => {
   if (
    !coverPath ||
    typeof coverPath !== 'string'
   ) {
    return false;
   }

   try {
    return fs.existsSync(
     coverPath
    );
   } catch (e) {
    return false;
   }
  }
 );
}

function getStorageStats(trackIds = null) {
let library =
 storage.getLibrary() || [];
 if (Array.isArray(trackIds) && trackIds.length > 0) {
 library = library.filter(t => trackIds.includes(t.id));
 }
const {
 ensureAssetDirectories
} = require('./track-assets');

const assetDirs =
 ensureAssetDirectories(
  storage.getCoversPath()
 );

const coversCacheSize =
 assetDirs
  ? getFolderSize(
   assetDirs.coversDownloaded
  )
  : 0;

const lyricsCacheSize =
 assetDirs
  ? getFolderSize(
   assetDirs.lyricsDownloaded
  )
  : 0;
 let missingCovers = 0;
 let missingMeta = 0;
library.forEach(track => {
 if (
  !hasTrackCover(
   track
  )
 ) {
  missingCovers++;
 }

 if (
  needsMetadataEnrichment(
   track
  )
 ) {
  missingMeta++;
 }
});
 const estimatedCoversMissingBytes = missingCovers * 1.1 * 1024 * 1024;
 const estimatedCoversAllBytes = library.length * 1.1 * 1024 * 1024;
 return {
 totalTracks: library.length,
 missingCovers,
 missingMeta,
 coversCacheSizeFormatted: formatBytes(coversCacheSize),
 lyricsCacheSizeFormatted: formatBytes(lyricsCacheSize),
 estimatedCoversMissingFormatted: formatBytes(estimatedCoversMissingBytes),
 estimatedCoversAllFormatted: formatBytes(estimatedCoversAllBytes)
 };
}

function normalizeReleaseText(
 value
) {
 return String(value || '')
 .normalize('NFKC')
 .trim()
 .toLowerCase()
 .replace(/[‒–—―]/g, '-')
 .replace(/\s+/g, ' ');
}

function getPrimaryReleaseArtist(
 track
) {
 const albumArtist =
 String(
 track?.albumArtist ||
 track?.sourceMetadata
 ?.albumArtist ||
 ''
 ).trim();
 if (
 albumArtist &&
 albumArtist.toLowerCase() !==
 'unknown artist'
 ) {
 return albumArtist;
 }
 const artist =
 String(
 track?.artist || ''
 ).trim();
 if (!artist) {
 return 'Unknown Artist';
 }
 return artist
 .replace(
 /\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i,
 ''
 )
 .replace(
 /\s*[;,]\s*.+$/,
 ''
 )
 .trim() ||
 artist;
}

function isDiscDirectoryName(
 directoryName
) {
 const normalized =
 normalizeReleaseText(
 directoryName
 )
 .replace(/[_-]+/g, ' ')
 .replace(/\s+/g, ' ')
 .trim();
 return /^(?:cd|disc|disk|диск)\s*0*\d{1,2}$/i.test(
 normalized
 );
}

function getTrackReleaseDirectory(
 track
) {
 if (!track?.path) {
 return '';
 }
 const directory =
 path.dirname(track.path);
 const baseName =
 path.basename(directory);
 if (
 isDiscDirectoryName(
 baseName
 )
 ) {
 return path.dirname(
 directory
 );
 }
 return directory;
}

function createBatchReleaseKey(
 track
) {
 if (!track) {
 return null;
 }
 const album =
 String(
 track.album || ''
 ).trim();
 if (
 !album ||
 album.toLowerCase() ===
 'unknown album'
 ) {
 return null;
 }
 const artist =
 getPrimaryReleaseArtist(
 track
 );
 if (
 !artist ||
 artist.toLowerCase() ===
 'unknown artist'
 ) {
 return null;
 }
 const releaseDirectory =
 getTrackReleaseDirectory(
 track
 );
 const normalizedDirectory =
 process.platform === 'win32'
 ? releaseDirectory
 .replace(/\\/g, '/')
 .toLowerCase()
 : releaseDirectory
 .replace(/\\/g, '/');
 return [
 normalizeReleaseText(album),
 normalizeReleaseText(artist),
 normalizedDirectory
 ].join('|||');
}

function applyCoverToBatchRelease(
 library,
 releaseKey,
 coverPath,
 mode,
 targetIdSet = null
) {
 if (
 !releaseKey ||
 !coverPath
 ) {
 return 0;
 }
 let assignedCount = 0;
 library.forEach(track => {
 if (
 targetIdSet &&
 !targetIdSet.has(track.id)
 ) {
 return;
 }
 if (
 createBatchReleaseKey(track) !==
 releaseKey
 ) {
 return;
 }
 if (
  mode !== 'all' &&
  hasTrackCover(
   track
  )
 ) {
  return;
 }
 track.downloadedCoverPath =
 coverPath;
 track.coverPath =
 coverPath;
 assignedCount++;
 });
 return assignedCount;
}

/**
 * ПАКЕТНАЯ ЗАГРУЗКА ОБЛОЖЕК (Кнопка «Найти HD-обложки»)
 */
 
async function processBatchCovers(
 mode,
 trackIds,
 onProgress
) {
 if (typeof trackIds === 'function') {
 onProgress = trackIds;
 trackIds = null;
 }
 activeBatchCancelFlag = false;
 const library = storage.getLibrary() || [];
 const targetIdSet = Array.isArray(trackIds) && trackIds.length > 0 ? new Set(trackIds) : null;
 const targets = library.filter(track => {
 const hasExistingCover = hasTrackCover(track);
 const matchesMode = mode === 'all' || !hasExistingCover;
 const matchesTrack = !targetIdSet || targetIdSet.has(track.id);
 return matchesMode && matchesTrack;
 });
 const total = targets.length;
 activeBatchState = {
 running: true,
 type: 'covers',
 mode,
 current: 0,
 total,
 downloadedCount: 0,
 enrichedCount: 0,
 canceled: false
 };
 debugEngine.addLog('COVERS', 'info', `Запущен пакетный поиск обложек (${mode}). Целей: ${total}`);
 if (total === 0) {
 activeBatchState.running = false;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'covers', current: 0, total: 0, downloadedCount: 0, canceled: false, empty: true });
 }
 return { processed: 0, total: 0, downloadedCount: 0, canceled: false, updatedLibrary: library };
 }
 let processed = 0;
 let downloadedCount = 0;
 const processedTrackIds = new Set();
 const resolvedReleaseCovers = new Map();

 for (const track of targets) {
 if (activeBatchCancelFlag) {
 activeBatchState.canceled = true;
 debugEngine.addLog('COVERS', 'warn', 'Пакетная загрузка обложек отменена пользователем.');
 break;
 }
 if (processedTrackIds.has(track.id)) continue;

 const releaseKey = createBatchReleaseKey(track);
 if (releaseKey && resolvedReleaseCovers.has(releaseKey)) {
 const cachedCoverPath = resolvedReleaseCovers.get(releaseKey);
 if (cachedCoverPath) {
 const releaseTargets = targets.filter(candidate => !processedTrackIds.has(candidate.id) && createBatchReleaseKey(candidate) === releaseKey);
 releaseTargets.forEach(candidate => {
 candidate.downloadedCoverPath = cachedCoverPath;
 candidate.coverPath = cachedCoverPath;
 processedTrackIds.add(candidate.id);
 });
 processed += releaseTargets.length;
 downloadedCount += releaseTargets.length;
 activeBatchState.current = Math.min(processed, total);
 activeBatchState.downloadedCount = downloadedCount;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'covers', current: Math.min(processed, total), total, downloadedCount, canceled: activeBatchCancelFlag });
 }
 continue;
 }
 }

 if ((!track.artist || track.artist === 'Unknown Artist') && track.title?.includes(' - ')) {
 const parts = track.title.split(' - ');
 track.artist = cleanString(parts[0]);
 track.title = cleanTitle(parts.slice(1).join(' - '));
 }

 let newCoverPath = await fetchAndSaveCoverFromTrackIdentity(track);
 if (!newCoverPath && !activeBatchCancelFlag) {
 newCoverPath = await fetchAndSaveCover(track.artist, track.title, track.path);
 }

 if (newCoverPath) {
 if (releaseKey) {
 resolvedReleaseCovers.set(releaseKey, newCoverPath);
 const releaseTargets = targets.filter(candidate => !processedTrackIds.has(candidate.id) && createBatchReleaseKey(candidate) === releaseKey);
 releaseTargets.forEach(candidate => {
 candidate.downloadedCoverPath = newCoverPath;
 candidate.coverPath = newCoverPath;
 processedTrackIds.add(candidate.id);
 });
 processed += releaseTargets.length;
 downloadedCount += releaseTargets.length;
 } else {
 track.downloadedCoverPath = newCoverPath;
 track.coverPath = newCoverPath;
 processedTrackIds.add(track.id);
 processed++;
 downloadedCount++;
 }
 } else {
 processedTrackIds.add(track.id);
 processed++;
 }

 activeBatchState.current = Math.min(processed, total);
 activeBatchState.downloadedCount = downloadedCount;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'covers', current: Math.min(processed, total), total, downloadedCount, canceled: activeBatchCancelFlag });
 }
 if (!activeBatchCancelFlag) {
 await new Promise(resolve => setTimeout(resolve, 400));
 }
 }

 activeBatchState.running = false;
 storage.saveLibrary(library);
 return {
 processed: Math.min(processed, total),
 total,
 downloadedCount: Math.min(downloadedCount, total),
 canceled: activeBatchCancelFlag,
 updatedLibrary: library
 };
}

/**
 * ПАКЕТНОЕ ОБОГАЩЕНИЕ МЕТАДАННЫХ (Кнопка «Обогатить метаданные»)
 */
async function processBatchMetadata(
 trackIds,
 onProgress
) {
 if (typeof trackIds === 'function') {
 onProgress = trackIds;
 trackIds = null;
 }
 activeBatchCancelFlag = false;
 let library = storage.getLibrary() || [];
 const targets = library.filter(track => {
 const matchesTrack = !Array.isArray(trackIds) || trackIds.includes(track.id);
 return matchesTrack && needsMetadataEnrichment(track);
 });
 const total = targets.length;
 activeBatchState = {
 running: true,
 type: 'metadata',
 mode: 'missing',
 current: 0,
 total,
 enrichedCount: 0,
 downloadedCount: 0,
 canceled: false
 };
 debugEngine.addLog('METADATA', 'info', `Запущено пакетное обогащение тегов. Целей: ${total}`);
 if (total === 0) {
 activeBatchState.running = false;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'metadata', current: 0, total: 0, enrichedCount: 0, canceled: false, empty: true });
 }
 return { processed: 0, total: 0, enrichedCount: 0, canceled: false, updatedLibrary: library };
 }
 let processed = 0;
 let enrichedCount = 0;
 let acoustIdSkippedCount = 0;
 let providerUnavailableCount = 0;

 for (const track of targets) {
 if (activeBatchCancelFlag) {
 activeBatchState.canceled = true;
 debugEngine.addLog('METADATA', 'warn', 'Обогащение метаданных отменено пользователем.');
 break;
 }
 const meta = await fetchMetadata(track.artist, track.title, track.path);
 if (meta?.unavailable === true) {
 if (meta.reason === 'acoustid-key-required') {
 acoustIdSkippedCount++;
 } else if (meta.reason === 'musicbrainz-unavailable') {
 providerUnavailableCount++;
 }
 processed++;
 activeBatchState.current = processed;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'metadata', current: processed, total, enrichedCount, canceled: activeBatchCancelFlag, acoustIdSkippedCount, providerUnavailableCount });
 }
 continue;
 }
 if (meta) {
 applyEnrichment(track, meta);
 enrichedCount++;
 }
 processed++;
 activeBatchState.current = processed;
 activeBatchState.enrichedCount = enrichedCount;
 if (typeof onProgress === 'function') {
 onProgress({ type: 'metadata', current: processed, total, enrichedCount, canceled: activeBatchCancelFlag, acoustIdSkippedCount, providerUnavailableCount });
 }
 await new Promise(resolve => setTimeout(resolve, 400));
 }

 activeBatchState.running = false;
 storage.saveLibrary(library);
 return {
 processed,
 total,
 enrichedCount,
 canceled: activeBatchCancelFlag,
 acoustIdSkippedCount,
 providerUnavailableCount,
 updatedLibrary: library
 };
}

async function downloadCoverForTracks(trackIds) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return {
      success: false,
      coverPath: null,
      updatedLibrary: storage.getLibrary() || []
    };
  }
  const library = storage.getLibrary() || [];
  const targetTracks = library.filter(track => trackIds.includes(track.id));
  if (targetTracks.length === 0) {
    return {
      success: false,
      coverPath: null,
      updatedLibrary: library
    };
  }
  const representativeTrack =
    targetTracks.find(track => track.artist && track.artist !== 'Unknown Artist') ||
    targetTracks[0];

  let coverPath = await fetchAndSaveCoverFromTrackIdentity(representativeTrack);
  if (!coverPath) {
    coverPath = await fetchAndSaveCover(
      representativeTrack.artist,
      representativeTrack.title,
      representativeTrack.path
    );
  }

  if (!coverPath) {
    return {
      success: false,
      coverPath: null,
      updatedLibrary: library
    };
  }

  targetTracks.forEach(track => {
    track.downloadedCoverPath = coverPath;
    track.coverPath = coverPath;
  });

  storage.saveLibrary(library);
  debugEngine.addLog(
    'COVERS',
    'success',
    `Обложка релиза назначена трекам: ${targetTracks.length}`,
    {
      coverPath,
      trackIds
    }
  );
  return {
    success: true,
    coverPath,
    updatedLibrary: library
  };
}

function cancelBatch() {
 activeBatchCancelFlag = true;
}

module.exports = {
 getStorageStats,
 getBatchStatus,
 processBatchCovers,
 processBatchMetadata,
 downloadCoverForTracks,
 cancelBatch
};