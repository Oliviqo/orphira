const fs = require('fs');
const path = require('path');

const {
 createTrackId
} = require('./track-identity');

const {
 parseFilename,
 cleanString,
 cleanTitle
} = require('./query-cleaner');

const {
 buildSourceMetadata,
 buildTechnicalMetadata,
 createEmptyEnrichedMetadata,
 applyDisplayMetadata
} = require('./track-metadata');

const {
 prepareTrackAssets
} = require('./track-assets');

/**
 * COSMIC PLAYER - UNIFIED TRACK FILE PARSER
 *
 * Единственная точка чтения физического аудиофайла.
 * Используется одновременно Worker и Watcher.
 */

let musicMetadataModulePromise = null;

async function getMusicMetadata() {
 if (!musicMetadataModulePromise) {
  musicMetadataModulePromise =
   import('music-metadata')
    .then(imported => {
     if (imported.parseFile) {
      return imported;
     }

     return (
      imported.default ||
      imported
     );
    });
 }

 return musicMetadataModulePromise;
}

function buildFilenameFallback(
 filePath
) {
 const parsed =
  parseFilename(filePath);

 const extension =
  path.extname(filePath);

 const baseName =
  path.basename(
   filePath,
   extension
  );

 return {
  title:
   parsed.title ||
   baseName ||
   'Unknown Track',

  artist:
   parsed.artist ||
   'Unknown Artist',

  album:
   'Unknown Album'
 };
}

function resolveInitialIdentity(
 sourceMetadata,
 fallback
) {
 let rawTitle =
  sourceMetadata.title || '';

 let rawArtist =
  sourceMetadata.artist || '';

 if (
  !rawTitle ||
  !rawArtist ||
  rawArtist === 'Unknown Artist'
 ) {
  if (
   !rawArtist ||
   rawArtist === 'Unknown Artist'
  ) {
   rawArtist =
    fallback.artist ||
    'Unknown Artist';
  }

  if (!rawTitle) {
   rawTitle =
    fallback.title ||
    'Unknown Track';
  }
 }

 if (
  rawTitle.includes(' - ') &&
  (
   !rawArtist ||
   rawArtist === 'Unknown Artist'
  )
 ) {
  const parts =
   rawTitle.split(' - ');

  rawArtist =
   parts[0].trim() ||
   rawArtist;

  rawTitle =
   parts
    .slice(1)
    .join(' - ')
    .trim() ||
   rawTitle;
 }

 return {
  title:
   cleanTitle(rawTitle) ||
   fallback.title ||
   'Unknown Track',

  artist:
   cleanString(rawArtist) ||
   fallback.artist ||
   'Unknown Artist'
 };
}

async function parseTrackFile(
 filePath,
 options = {}
) {
 if (
  !filePath ||
  typeof filePath !== 'string' ||
  !fs.existsSync(filePath)
 ) {
  return null;
 }

 try {
  const stats =
   fs.statSync(filePath);

  if (
   !stats.isFile() ||
   stats.size <= 0
  ) {
   return null;
  }

  const coversRootPath =
   options.coversRootPath;

  if (!coversRootPath) {
   throw new Error(
    'coversRootPath is required'
   );
  }

  const mm =
   await getMusicMetadata();

  const metadata =
   await mm.parseFile(
    filePath,
    {
     duration: true,
     skipCovers: false
    }
   );

  const sourceMetadata =
   buildSourceMetadata(
    metadata
   );

  const technicalMetadata =
   buildTechnicalMetadata(
    metadata
   );

  const enrichedMetadata =
   createEmptyEnrichedMetadata();

  const filenameFallback =
   buildFilenameFallback(
    filePath
   );

  const initialIdentity =
   resolveInitialIdentity(
    sourceMetadata,
    filenameFallback
   );

  const assets =
   prepareTrackAssets(
    metadata,
    filePath,
    coversRootPath
   );

  const track = {
   id:
    createTrackId(filePath),

   path:
    filePath,

   title:
    initialIdentity.title,

   artist:
    initialIdentity.artist,

   album:
    sourceMetadata.album ||
    'Unknown Album',

   albumArtist:
    sourceMetadata.albumArtist ||
    null,

   genre:
    sourceMetadata.genres.join(', '),

   year:
    sourceMetadata.year || '',

   trackNumber:
    sourceMetadata.trackNumber,

   trackTotal:
    sourceMetadata.trackTotal,

   discNumber:
    sourceMetadata.discNumber,

   discTotal:
    sourceMetadata.discTotal,

   bpm:
    sourceMetadata.bpm || 0,

   duration:
    technicalMetadata.duration || 0,

   bitrate:
    technicalMetadata.bitrate || 0,

   codec:
    technicalMetadata.codec,

   codecProfile:
    technicalMetadata.codecProfile,

   container:
    technicalMetadata.container,

   sampleRate:
    technicalMetadata.sampleRate,

   bitsPerSample:
    technicalMetadata.bitsPerSample,

   numberOfChannels:
    technicalMetadata.numberOfChannels,

   lossless:
    technicalMetadata.lossless,

   size:
    stats.size,

   addedAt:
    stats.birthtimeMs > 0
     ? stats.birthtimeMs
     : Date.now(),

   embeddedCoverPath:
    assets.embeddedCoverPath,

   downloadedCoverPath:
    assets.downloadedCoverPath,

   coverPath:
    assets.coverPath,

   externalLyricsPath:
    assets.externalLyricsPath,

   embeddedLyricsPath:
    assets.embeddedLyricsPath,

   downloadedLyricsPath:
    assets.downloadedLyricsPath,

   lyricsPath:
    assets.lyricsPath,

   sourceMetadata,
   enrichedMetadata,
   technicalMetadata
  };

  applyDisplayMetadata(
   track,
   {
    title:
     initialIdentity.title,

    artist:
     initialIdentity.artist,

    album:
     'Unknown Album',

    genre:
     '',

    bpm:
     0
   }
  );

  return track;
 } catch (error) {
  if (
   typeof options.onError ===
   'function'
  ) {
   options.onError(
    error,
    filePath
   );
  }

  return null;
 }
}

module.exports = {
 parseTrackFile
};