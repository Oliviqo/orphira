const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * COSMIC PLAYER - TRACK ASSETS MANAGER
 *
 * Физическое разделение оригинальных и скачанных assets.
 *
 * covers/
 *   embedded/   - artwork, извлечённая из самого аудиофайла
 *   downloaded/ - artwork, загруженная из интернета
 *
 * lyrics/
 *   embedded/   - lyrics, извлечённые из тегов аудиофайла
 *   downloaded/ - lyrics, загруженные из интернета
 *
 * Оригинальные external .lrc/.txt рядом с аудиофайлом никогда
 * не копируются и никогда не считаются downloaded cache.
 */

function ensureDirectory(directoryPath) {
 if (
  !directoryPath ||
  typeof directoryPath !== 'string'
 ) {
  return null;
 }

 try {
  if (!fs.existsSync(directoryPath)) {
   fs.mkdirSync(
    directoryPath,
    { recursive: true }
   );
  }

  return directoryPath;
 } catch (e) {
  return null;
 }
}

function getAssetDirectories(coversRootPath) {
 if (
  !coversRootPath ||
  typeof coversRootPath !== 'string'
 ) {
  return null;
 }

 const normalizedCoversRoot =
  path.resolve(coversRootPath);

 const userDataRoot =
  path.dirname(normalizedCoversRoot);

 const coversEmbedded =
  path.join(
   normalizedCoversRoot,
   'embedded'
  );

 const coversDownloaded =
  path.join(
   normalizedCoversRoot,
   'downloaded'
  );

 const lyricsRoot =
  path.join(
   userDataRoot,
   'lyrics'
  );

 const lyricsEmbedded =
  path.join(
   lyricsRoot,
   'embedded'
  );

 const lyricsDownloaded =
  path.join(
   lyricsRoot,
   'downloaded'
  );

 return {
  userDataRoot,
  coversRoot:
   normalizedCoversRoot,
  coversEmbedded,
  coversDownloaded,
  lyricsRoot,
  lyricsEmbedded,
  lyricsDownloaded
 };
}

function ensureAssetDirectories(coversRootPath) {
 const directories =
  getAssetDirectories(
   coversRootPath
  );

 if (!directories) {
  return null;
 }

 ensureDirectory(
  directories.coversRoot
 );

 ensureDirectory(
  directories.coversEmbedded
 );

 ensureDirectory(
  directories.coversDownloaded
 );

 ensureDirectory(
  directories.lyricsRoot
 );

 ensureDirectory(
  directories.lyricsEmbedded
 );

 ensureDirectory(
  directories.lyricsDownloaded
 );

 return directories;
}

function normalizeImageExtension(picture) {
 const mime =
  String(
   picture?.format || ''
  )
   .trim()
   .toLowerCase();

 if (mime.includes('png')) {
  return 'png';
 }

 if (mime.includes('webp')) {
  return 'webp';
 }

 if (
  mime.includes('jpeg') ||
  mime.includes('jpg')
 ) {
  return 'jpg';
 }

 return 'jpg';
}

function saveEmbeddedCover(
 pictures,
 coversRootPath
) {
 if (
  !Array.isArray(pictures) ||
  pictures.length === 0
 ) {
  return null;
 }

 const picture =
  pictures.find(item =>
   item?.data &&
   item.data.length > 0
  );

 if (!picture) {
  return null;
 }

 const directories =
  ensureAssetDirectories(
   coversRootPath
  );

 if (!directories) {
  return null;
 }

 try {
  const buffer =
   Buffer.from(picture.data);

  if (buffer.length === 0) {
   return null;
  }

  const extension =
   normalizeImageExtension(
    picture
   );

  const hash =
   crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');

  const filePath =
   path.join(
    directories.coversEmbedded,
    `${hash}.${extension}`
   );

  if (!fs.existsSync(filePath)) {
   fs.writeFileSync(
    filePath,
    buffer
   );
  }

  return filePath;
 } catch (e) {
  return null;
 }
}

function findExternalLyrics(audioPath) {
 if (
  !audioPath ||
  typeof audioPath !== 'string'
 ) {
  return null;
 }

 try {
  const directory =
   path.dirname(audioPath);

  const extension =
   path.extname(audioPath);

  const baseName =
   path.basename(
    audioPath,
    extension
   );

  const candidates = [
   path.join(
    directory,
    `${baseName}.lrc`
   ),
   path.join(
    directory,
    `${baseName}.LRC`
   ),
   path.join(
    directory,
    `${baseName}.txt`
   ),
   path.join(
    directory,
    `${baseName}.TXT`
   )
  ];

  for (const candidate of candidates) {
   if (fs.existsSync(candidate)) {
    return candidate;
   }
  }
 } catch (e) {
  return null;
 }

 return null;
}

function normalizeEmbeddedLyrics(
 lyrics
) {
 if (
  !Array.isArray(lyrics) ||
  lyrics.length === 0
 ) {
  return null;
 }

 const lines = [];

 lyrics.forEach(item => {
  if (
   typeof item === 'string'
  ) {
   const text =
    item.trim();

   if (text) {
    lines.push(text);
   }

   return;
  }

  if (
   !item ||
   typeof item !== 'object'
  ) {
   return;
  }

  const text =
   String(
    item.text ??
    item.value ??
    ''
   ).trim();

  if (!text) {
   return;
  }

  const timestamp =
   Number(
    item.timestamp ??
    item.time
   );

  if (
   Number.isFinite(timestamp) &&
   timestamp >= 0
  ) {
   const totalSeconds =
    timestamp > 10000
     ? timestamp / 1000
     : timestamp;

   const minutes =
    Math.floor(
     totalSeconds / 60
    );

   const seconds =
    totalSeconds -
    minutes * 60;

   const formattedMinutes =
    String(minutes)
     .padStart(2, '0');

   const formattedSeconds =
    seconds
     .toFixed(2)
     .padStart(5, '0');

   lines.push(
    `[${formattedMinutes}:${formattedSeconds}]${text}`
   );

   return;
  }

  lines.push(text);
 });

 const result =
  lines
   .join('\n')
   .trim();

 return result || null;
}

function saveEmbeddedLyrics(
 lyrics,
 audioPath,
 coversRootPath
) {
 const content =
  normalizeEmbeddedLyrics(
   lyrics
  );

 if (!content) {
  return null;
 }

 const directories =
  ensureAssetDirectories(
   coversRootPath
  );

 if (!directories) {
  return null;
 }

 try {
  const identity =
   String(audioPath || content);

  const hash =
   crypto
    .createHash('sha256')
    .update(identity)
    .digest('hex');

  const hasTiming =
   /\[\d{1,3}:\d{2}(?:\.\d+)?\]/.test(
    content
   );

  const extension =
   hasTiming
    ? 'lrc'
    : 'txt';

  const filePath =
   path.join(
    directories.lyricsEmbedded,
    `${hash}.${extension}`
   );

  fs.writeFileSync(
   filePath,
   content,
   'utf-8'
  );

  return filePath;
 } catch (e) {
  return null;
 }
}

function prepareTrackAssets(
 metadata,
 audioPath,
 coversRootPath
) {
 const directories =
  ensureAssetDirectories(
   coversRootPath
  );

 const embeddedCoverPath =
  saveEmbeddedCover(
   metadata?.common?.picture,
   coversRootPath
  );

 const externalLyricsPath =
  findExternalLyrics(
   audioPath
  );

 const embeddedLyricsPath =
  saveEmbeddedLyrics(
   metadata?.common?.lyrics,
   audioPath,
   coversRootPath
  );

 const temporaryTrack = {
  externalLyricsPath,
  embeddedLyricsPath,
  downloadedLyricsPath: null
 };

 const lyricsPath =
  resolveActiveLyricsPath(
   temporaryTrack
  );

 return {
  directories,

  embeddedCoverPath,
  downloadedCoverPath: null,
  coverPath:
   embeddedCoverPath || null,

  externalLyricsPath,
  embeddedLyricsPath,
  downloadedLyricsPath: null,
  lyricsPath
 };
}

function hasSyncedLyricsContent(content) {
 if (
  !content ||
  typeof content !== 'string'
 ) {
  return false;
 }

 return /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(
  content
 );
}

function readLyricsAsset(filePath) {
 if (
  !filePath ||
  typeof filePath !== 'string'
 ) {
  return null;
 }

 try {
  if (!fs.existsSync(filePath)) {
   return null;
  }

  const content =
   fs.readFileSync(
    filePath,
    'utf-8'
   );

  if (!content.trim()) {
   return null;
  }

  return {
   path: filePath,
   content,
   synced:
    hasSyncedLyricsContent(
     content
    )
  };
 } catch (e) {
  return null;
 }
}

function resolveBestLyricsAsset(
 track,
 downloadedLyricsPath = null
) {
 const candidates = [
  {
   type: 'external',
   priority: 3,
   path:
    track?.externalLyricsPath
  },
  {
   type: 'embedded',
   priority: 2,
   path:
    track?.embeddedLyricsPath
  },
  {
   type: 'downloaded',
   priority: 1,
   path:
    downloadedLyricsPath ||
    track?.downloadedLyricsPath
  }
 ];

 const available =
  candidates
   .map(candidate => {
    const asset =
     readLyricsAsset(
      candidate.path
     );

    if (!asset) {
     return null;
    }

    return {
     ...candidate,
     ...asset
    };
   })
   .filter(Boolean);

 if (available.length === 0) {
  return null;
 }

 available.sort(
  (a, b) => {
   if (a.synced !== b.synced) {
    return a.synced
     ? -1
     : 1;
   }

   return (
    b.priority -
    a.priority
   );
  }
 );

 return available[0];
}

function resolveActiveLyricsPath(
 track,
 downloadedLyricsPath = null
) {
 const asset =
  resolveBestLyricsAsset(
   track,
   downloadedLyricsPath
  );

 return asset?.path || null;
}

function removeFileIfExists(
 filePath
) {
 if (!filePath) {
  return false;
 }

 try {
  if (
   fs.existsSync(filePath)
  ) {
   fs.unlinkSync(filePath);
  }

  return true;
 } catch (e) {
  return false;
 }
}

function cleanupDownloadedAssets(
 tracks,
 coversRootPath
) {
 const directories =
  ensureAssetDirectories(
   coversRootPath
  );

 if (!directories) {
  return {
   removedCovers: 0,
   removedLyrics: 0
  };
 }

 const safeTracks =
  Array.isArray(tracks)
   ? tracks
   : [];

 const usedCovers =
  new Set(
   safeTracks
    .map(track =>
     track?.downloadedCoverPath
    )
    .filter(Boolean)
    .map(filePath =>
     path.resolve(filePath)
    )
  );

 const usedLyrics =
  new Set(
   safeTracks
    .map(track =>
     track?.downloadedLyricsPath
    )
    .filter(Boolean)
    .map(filePath =>
     path.resolve(filePath)
    )
  );

 let removedCovers = 0;
 let removedLyrics = 0;

 const cleanupDirectory = (
  directoryPath,
  usedPaths,
  onRemoved
 ) => {
  try {
   const entries =
    fs.readdirSync(
     directoryPath,
     {
      withFileTypes: true
     }
    );

   entries.forEach(entry => {
    if (!entry.isFile()) {
     return;
    }

    const filePath =
     path.resolve(
      path.join(
       directoryPath,
       entry.name
      )
     );

    if (
     usedPaths.has(filePath)
    ) {
     return;
    }

    if (
     removeFileIfExists(
      filePath
     )
    ) {
     onRemoved();
    }
   });
  } catch (e) {}
 };

 cleanupDirectory(
  directories.coversDownloaded,
  usedCovers,
  () => {
   removedCovers++;
  }
 );

 cleanupDirectory(
  directories.lyricsDownloaded,
  usedLyrics,
  () => {
   removedLyrics++;
  }
 );

 return {
  removedCovers,
  removedLyrics
 };
}

module.exports = {
 getAssetDirectories,
 ensureAssetDirectories,
 saveEmbeddedCover,
 findExternalLyrics,
 normalizeEmbeddedLyrics,
 saveEmbeddedLyrics,
 prepareTrackAssets,
 hasSyncedLyricsContent,
 readLyricsAsset,
 resolveBestLyricsAsset,
 resolveActiveLyricsPath,
 removeFileIfExists,
 cleanupDownloadedAssets
};