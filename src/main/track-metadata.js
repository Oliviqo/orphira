/**
 * COSMIC PLAYER - TRACK METADATA MODEL
 *
 * Центральная модель метаданных музыкального файла.
 *
 * sourceMetadata:
 *   неизменяемый эталон, прочитанный непосредственно из аудиофайла.
 *
 * enrichedMetadata:
 *   отдельный сетевой слой. Никогда не должен изменять sourceMetadata.
 *
 * technicalMetadata:
 *   физические характеристики конкретного аудиофайла.
 *
 * Плоские track.title / track.artist / track.album и другие поля остаются
 * материализованным display-слоем для совместимости с Renderer.
 */

const {
 parseFilename
} = require('./query-cleaner');

function normalizeString(value) {
 if (value === null || value === undefined) {
  return null;
 }

 const result = String(value)
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim();

 return result || null;
}

function normalizeNumber(value) {
 if (
  value === null ||
  value === undefined ||
  value === ''
 ) {
  return null;
 }

 const result = Number(value);

 return Number.isFinite(result)
  ? result
  : null;
}

function normalizePositiveInteger(value) {
 const result = normalizeNumber(value);

 if (
  result === null ||
  result <= 0
 ) {
  return null;
 }

 return Math.floor(result);
}

function normalizeYear(value) {
 const result = normalizePositiveInteger(value);

 if (
  result === null ||
  result < 1000 ||
  result > 9999
 ) {
  return null;
 }

 return result;
}

function normalizeBoolean(value) {
 return typeof value === 'boolean'
  ? value
  : null;
}

function normalizeStringArray(value) {
 if (value === null || value === undefined) {
  return [];
 }

 const source = Array.isArray(value)
  ? value
  : [value];

 const seen = new Set();
 const result = [];

 source.forEach(item => {
  const normalized = normalizeString(item);

  if (!normalized) return;

  const key = normalized.toLocaleLowerCase();

  if (seen.has(key)) return;

  seen.add(key);
  result.push(normalized);
 });

 return result;
}

function normalizeComments(value) {
 if (!Array.isArray(value)) {
  return [];
 }

 const result = [];

 value.forEach(item => {
  if (typeof item === 'string') {
   const text = normalizeString(item);

   if (text) {
    result.push({
     descriptor: null,
     text
    });
   }

   return;
  }

  if (
   !item ||
   typeof item !== 'object'
  ) {
   return;
  }

  const descriptor = normalizeString(
   item.descriptor ||
   item.description
  );

  const text = normalizeString(
   item.text ||
   item.value
  );

  if (!text) return;

  result.push({
   descriptor,
   text
  });
 });

 return result;
}

function normalizeRating(value) {
 if (!Array.isArray(value)) {
  return [];
 }

 return value
  .map(item => {
   if (
    !item ||
    typeof item !== 'object'
   ) {
    return null;
   }

   const source = normalizeString(
    item.source
   );

   const rating = normalizeNumber(
    item.rating
   );

   if (
    !source &&
    rating === null
   ) {
    return null;
   }

   return {
    source,
    rating
   };
  })
  .filter(Boolean);
}

function normalizeMusicBrainzIds(common) {
 return {
  trackId: normalizeString(
   common.musicbrainz_trackid
  ),
  releaseTrackId: normalizeString(
   common.musicbrainz_releasetrackid
  ),
  albumId: normalizeString(
   common.musicbrainz_albumid
  ),
  releaseGroupId: normalizeString(
   common.musicbrainz_releasegroupid
  ),
  artistIds: normalizeStringArray(
   common.musicbrainz_artistid
  ),
  albumArtistIds: normalizeStringArray(
   common.musicbrainz_albumartistid
  ),
  workId: normalizeString(
   common.musicbrainz_workid
  )
 };
}

function buildSourceMetadata(metadata) {
 const common = metadata?.common || {};

 const sourceMetadata = {
  title: normalizeString(
   common.title
  ),

  artist: normalizeString(
   common.artist
  ),

  artists: normalizeStringArray(
   common.artists
  ),

  album: normalizeString(
   common.album
  ),

  albumArtist: normalizeString(
   common.albumartist
  ),

  year: normalizeYear(
   common.year
  ),

  date: normalizeString(
   common.date
  ),

  originalDate: normalizeString(
   common.originaldate
  ),

  originalYear: normalizeYear(
   common.originalyear
  ),

  genres: normalizeStringArray(
   common.genre
  ),

  trackNumber: normalizePositiveInteger(
   common.track?.no
  ),

  trackTotal: normalizePositiveInteger(
   common.track?.of
  ),

  discNumber: normalizePositiveInteger(
   common.disk?.no
  ),

  discTotal: normalizePositiveInteger(
   common.disk?.of
  ),

  bpm: normalizeNumber(
   common.bpm
  ),

  key: normalizeString(
   common.key
  ),

  composer: normalizeStringArray(
   common.composer
  ),

  conductor: normalizeStringArray(
   common.conductor
  ),

  remixer: normalizeStringArray(
   common.remixer
  ),

  label: normalizeStringArray(
   common.label
  ),

  grouping: normalizeString(
   common.grouping
  ),

  copyright: normalizeString(
   common.copyright
  ),

  media: normalizeString(
   common.media
  ),

  compilation: normalizeBoolean(
   common.compilation
  ),

  isrc: normalizeStringArray(
   common.isrc
  ),

  barcode: normalizeString(
   common.barcode
  ),

  catalogNumber: normalizeStringArray(
   common.catalognumber
  ),

  comments: normalizeComments(
   common.comment
  ),

  ratings: normalizeRating(
   common.rating
  ),

  musicBrainz: normalizeMusicBrainzIds(
   common
  ),

  hasEmbeddedCover: Boolean(
   Array.isArray(common.picture) &&
   common.picture.some(
    picture =>
     picture?.data &&
     picture.data.length > 0
   )
  ),

  hasEmbeddedLyrics: Boolean(
   Array.isArray(common.lyrics) &&
   common.lyrics.length > 0
  )
 };

 return sourceMetadata;
}

function buildTechnicalMetadata(metadata) {
 const format = metadata?.format || {};

 return {
  duration: normalizeNumber(
   format.duration
  ),

  bitrate: normalizeNumber(
   format.bitrate
  ),

  codec: normalizeString(
   format.codec
  ),

  codecProfile: normalizeString(
   format.codecProfile
  ),

  container: normalizeString(
   format.container
  ),

  sampleRate: normalizePositiveInteger(
   format.sampleRate
  ),

  bitsPerSample: normalizePositiveInteger(
   format.bitsPerSample
  ),

  numberOfChannels: normalizePositiveInteger(
   format.numberOfChannels
  ),

  lossless: normalizeBoolean(
   format.lossless
  )
 };
}

function createEmptyEnrichedMetadata() {
  return {};
}

function firstDefined(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return value;
    }
  }
  return null;
}

function firstValidText(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !isMissingText(value, ['Unknown Track', 'Unknown Title', 'Unknown Artist', 'Unknown Album'])
    ) {
      return value;
    }
  }
  return null;
}

function firstArrayValue(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.length > 0
    ? value[0]
    : null;
}

function resolveDisplayMetadata(
  sourceMetadata,
  enrichedMetadata = {},
  fallbackMetadata = {}
) {
  const source = sourceMetadata || {};
  const enriched = enrichedMetadata || {};
  const fallback = fallbackMetadata || {};
  const sourceGenres = Array.isArray(source.genres) ? source.genres : [];
  const enrichedGenres = Array.isArray(enriched.genres) ? enriched.genres : [];
  const resolvedGenres = enrichedGenres.length > 0 ? enrichedGenres : sourceGenres;

  return {
    title:
      firstValidText(enriched.title, source.title, fallback.title) ||
      'Unknown Track',
    artist:
      firstValidText(
        enriched.artist,
        source.artist,
        firstArrayValue(source.artists),
        fallback.artist
      ) || 'Unknown Artist',
    album:
      firstValidText(enriched.album, source.album, fallback.album) ||
      'Unknown Album',
    albumArtist: firstDefined(
      enriched.albumArtist,
      source.albumArtist,
      fallback.albumArtist
    ),
    year: firstDefined(enriched.year, source.year, fallback.year, ''),
    genre:
      resolvedGenres.length > 0
        ? resolvedGenres.join(', ')
        : firstDefined(enriched.genre, fallback.genre, ''),
    trackNumber: firstDefined(
      enriched.trackNumber,
      source.trackNumber,
      fallback.trackNumber
    ),
    trackTotal: firstDefined(
      enriched.trackTotal,
      source.trackTotal,
      fallback.trackTotal
    ),
    discNumber: firstDefined(
      enriched.discNumber,
      source.discNumber,
      fallback.discNumber
    ),
    discTotal: firstDefined(
      enriched.discTotal,
      source.discTotal,
      fallback.discTotal
    ),
    bpm: firstDefined(enriched.bpm, source.bpm, fallback.bpm, 0)
  };
}

function applyDisplayMetadata(
 track,
 fallbackMetadata = {}
) {
 if (!track) return track;

 const resolved =
  resolveDisplayMetadata(
   track.sourceMetadata,
   track.enrichedMetadata,
   fallbackMetadata
  );

 track.title = resolved.title;
 track.artist = resolved.artist;
 track.album = resolved.album;
 track.albumArtist =
  resolved.albumArtist;
 track.year = resolved.year;
 track.genre = resolved.genre;
 track.trackNumber =
  resolved.trackNumber;
 track.trackTotal =
  resolved.trackTotal;
 track.discNumber =
  resolved.discNumber;
 track.discTotal =
  resolved.discTotal;
 track.bpm = resolved.bpm;

 return track;
}

function isMissingText(
 value,
 unknownValues = []
) {
 const normalized =
  normalizeString(value);

 if (!normalized) {
  return true;
 }

 const key =
  normalized.toLocaleLowerCase();

 return unknownValues.some(
  unknown =>
   key ===
   String(unknown)
    .toLocaleLowerCase()
 );
}

function isMissingArtist(value) {
 return isMissingText(
  value,
  [
   'Unknown Artist'
  ]
 );
}

function isMissingTitle(value) {
 return isMissingText(
  value,
  [
   'Unknown Track',
   'Unknown Title'
  ]
 );
}

function isMissingAlbum(value) {
 return isMissingText(
  value,
  [
   'Unknown Album'
  ]
 );
}

function buildEnrichmentPatch(
 track,
 metadataResult
) {
 if (
  !track ||
  !metadataResult
 ) {
  return {};
 }

 const source =
  track.sourceMetadata || {};

 const patch = {
  source:
   normalizeString(
    metadataResult.source
   ) ||
   'Unknown',

  updatedAt:
   Date.now()
 };

 const sourceArtistMissing =
  isMissingArtist(
   source.artist
  );

 const sourceTitleMissing =
  isMissingTitle(
   source.title
  );

 const sourceAlbumMissing =
  isMissingAlbum(
   source.album
  );

 if (
  sourceArtistMissing &&
  metadataResult.artist
 ) {
  patch.artist =
   normalizeString(
    metadataResult.artist
   );
 }

 if (
  sourceTitleMissing &&
  metadataResult.title
 ) {
  patch.title =
   normalizeString(
    metadataResult.title
   );
 }

 if (
  sourceAlbumMissing &&
  metadataResult.album
 ) {
  patch.album =
   normalizeString(
    metadataResult.album
   );
 }

 if (
  !source.albumArtist &&
  metadataResult.albumArtist
 ) {
  patch.albumArtist =
   normalizeString(
    metadataResult.albumArtist
   );
 }

 if (
  !source.year &&
  metadataResult.year
 ) {
  patch.year =
   normalizeYear(
    metadataResult.year
   );
 }

 if (
  (
   !Array.isArray(source.genres) ||
   source.genres.length === 0
  )
 ) {
  const incomingGenres =
   normalizeStringArray(
    metadataResult.genres ||
    metadataResult.genre
   );

  if (
   incomingGenres.length > 0
  ) {
   patch.genres =
    incomingGenres;
  }
 }

 if (
  !source.trackNumber &&
  metadataResult.trackNumber
 ) {
  patch.trackNumber =
   normalizePositiveInteger(
    metadataResult.trackNumber
   );
 }

 if (
  !source.trackTotal &&
  metadataResult.trackTotal
 ) {
  patch.trackTotal =
   normalizePositiveInteger(
    metadataResult.trackTotal
   );
 }

 if (
  !source.discNumber &&
  metadataResult.discNumber
 ) {
  patch.discNumber =
   normalizePositiveInteger(
    metadataResult.discNumber
   );
 }

 if (
  !source.discTotal &&
  metadataResult.discTotal
 ) {
  patch.discTotal =
   normalizePositiveInteger(
    metadataResult.discTotal
   );
 }

 if (
  !source.bpm &&
  metadataResult.bpm
 ) {
  patch.bpm =
   normalizeNumber(
    metadataResult.bpm
   );
 }

 if (
  (!source.label ||
   source.label.length === 0)
 ) {
  const labels =
   normalizeStringArray(
    metadataResult.labels ||
    metadataResult.label
   );

  if (labels.length > 0) {
patch.label =
    labels;
  }
 }

 if (
  (!source.isrc ||
   source.isrc.length === 0)
 ) {
  const isrc =
   normalizeStringArray(
    metadataResult.isrc
   );

  if (isrc.length > 0) {
   patch.isrc =
    isrc;
  }
 }

 if (
  !source.barcode &&
  metadataResult.barcode
 ) {
  patch.barcode =
   normalizeString(
    metadataResult.barcode
   );
 }

 if (
  (!source.catalogNumber ||
   source.catalogNumber.length === 0)
 ) {
  const catalogNumbers =
   normalizeStringArray(
    metadataResult.catalogNumber
   );

  if (
   catalogNumbers.length > 0
  ) {
   patch.catalogNumber =
    catalogNumbers;
  }
 }

 if (
  metadataResult.musicBrainz &&
  typeof metadataResult.musicBrainz ===
   'object'
 ) {
  const mb =
   metadataResult.musicBrainz;

  const sourceMb =
   source.musicBrainz || {};

  const musicBrainz = {};

  if (
   !sourceMb.trackId &&
   mb.trackId
  ) {
   musicBrainz.trackId =
    normalizeString(
     mb.trackId
    );
  }

  if (
   !sourceMb.releaseTrackId &&
   mb.releaseTrackId
  ) {
   musicBrainz.releaseTrackId =
    normalizeString(
     mb.releaseTrackId
    );
  }

  if (
   !sourceMb.albumId &&
   mb.albumId
  ) {
   musicBrainz.albumId =
    normalizeString(
     mb.albumId
    );
  }

  if (
   !sourceMb.releaseGroupId &&
   mb.releaseGroupId
  ) {
   musicBrainz.releaseGroupId =
    normalizeString(
     mb.releaseGroupId
    );
  }

  if (
   Object.keys(
    musicBrainz
   ).length > 0
  ) {
   patch.musicBrainz =
    musicBrainz;
  }
 }

 return patch;
}

function getMissingMetadataFields(
  track
) {
  if (!track) {
    return [];
  }
  const source =
    track.sourceMetadata || {};
  const enriched =
    track.enrichedMetadata || {};
  const missing = [];
  if (
    isMissingArtist(
      source.artist
    ) &&
    !enriched.artist
  ) {
    missing.push('artist');
  }
  if (
    isMissingTitle(
      source.title
    ) &&
    !enriched.title
  ) {
    missing.push('title');
  }
  if (
    isMissingAlbum(
      source.album
    ) &&
    !enriched.album
  ) {
    missing.push('album');
  }
  const hasBeenEnriched = Boolean(
    enriched.source || enriched.updatedAt
  );
  if (!hasBeenEnriched) {
    if (
      !source.year &&
      !enriched.year
    ) {
      missing.push('year');
    }
    const sourceGenres =
      Array.isArray(source.genres)
        ? source.genres
        : [];
    const enrichedGenres =
      Array.isArray(enriched.genres)
        ? enriched.genres
        : [];
    if (
      sourceGenres.length === 0 &&
      enrichedGenres.length === 0 &&
      !enriched.genre
    ) {
      missing.push('genre');
    }
  }
  return missing;
}

function needsMetadataEnrichment(
 track
) {
 return (
  getMissingMetadataFields(
   track
  ).length > 0
 );
}

function applyEnrichment(
 track,
 metadataResult
) {
 if (!track) {
  return track;
 }

 const patch =
  buildEnrichmentPatch(
   track,
   metadataResult
  );

 track.enrichedMetadata = {
  ...(
   track.enrichedMetadata ||
   {}
  ),
  ...patch,
  musicBrainz: {
   ...(
    track.enrichedMetadata
     ?.musicBrainz ||
    {}
   ),
   ...(
    patch.musicBrainz ||
    {}
   )
  }
 };

 return applyDisplayMetadata(
  track
 );
}

function clearEnrichedMetadata(track) {
 if (!track) {
 return track;
 }

 track.enrichedMetadata =
 createEmptyEnrichedMetadata();

 const filenameFallback =
 track.path
 ? parseFilename(
 track.path
 )
 : {
 title: '',
 artist: ''
 };

 return applyDisplayMetadata(
 track,
 {
 title:
 filenameFallback.title ||
 'Unknown Track',
 artist:
 filenameFallback.artist ||
 'Unknown Artist',
 album:
 'Unknown Album',
 albumArtist: null,
 year: '',
 genre: '',
 trackNumber: null,
 trackTotal: null,
 discNumber: null,
 discTotal: null,
 bpm: 0
 }
 );
}

module.exports = {
 buildSourceMetadata,
 buildTechnicalMetadata,
 createEmptyEnrichedMetadata,
 resolveDisplayMetadata,
 applyDisplayMetadata,
 buildEnrichmentPatch,
 applyEnrichment,
 clearEnrichedMetadata,
 getMissingMetadataFields,
 needsMetadataEnrichment,
 isMissingArtist,
 isMissingTitle,
 isMissingAlbum
};