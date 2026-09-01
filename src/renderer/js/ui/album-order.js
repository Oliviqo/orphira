/**
 * COSMIC PLAYER - ALBUM ORDER RESOLVER
 * Безопасная интерпретация порядка альбома при отсутствующих или повреждённых
 * track/disc tags без изменения исходных метаданных библиотеки.
 */
class AlbumOrderResolver {
 _toPositiveInteger(value) {
 const number = Number(value);
 if (!Number.isFinite(number) || number <= 0) {
 return null;
 }
 return Math.floor(number);
 }

 _getFilename(track) {
 if (!track?.path) return '';
 const normalized = String(track.path).replace(/\\/g, '/');
 const fileName = normalized.substring(normalized.lastIndexOf('/') + 1);
 return fileName.replace(/\.[^.]+$/, '');
 }

 _getPathSegments(track) {
 if (!track?.path) return [];
 const normalized = String(track.path).replace(/\\/g, '/');
 return normalized.split('/').filter(Boolean);
 }

 _extractDiscNumberFromText(text) {
 if (!text) return null;

 const normalized = String(text)
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

 const patterns = [
  /(?:^|\s)(?:cd|disc|disk)\s*0*(\d{1,2})(?:\s|$)/i,
  /(?:^|\s)(?:диск)\s*0*(\d{1,2})(?:\s|$)/i
 ];

 for (const pattern of patterns) {
  const match = normalized.match(pattern);
  if (!match) continue;

  const discNumber = this._toPositiveInteger(match[1]);
  if (discNumber) return discNumber;
 }

 return null;
 }

 _inferDiscNumber(track) {
 const segments = this._getPathSegments(track);

 for (let i = segments.length - 2; i >= 0; i--) {
  const inferred = this._extractDiscNumberFromText(segments[i]);
  if (inferred) return inferred;
 }

 return this._extractDiscNumberFromText(this._getFilename(track));
 }

 _extractTrackNumberFromFilename(track) {
 const filename = this._getFilename(track);
 if (!filename) return null;

 const patterns = [
  /^\s*0*(\d{1,3})\s*[-._]\s+/,
  /^\s*0*(\d{1,3})\.\s+/,
  /^\s*0*(\d{1,3})\s+-\s+/,
  /^\s*0*(\d{1,3})\s+/
 ];

 for (const pattern of patterns) {
  const match = filename.match(pattern);
  if (!match) continue;

  const trackNumber = this._toPositiveInteger(match[1]);
  if (trackNumber) return trackNumber;
 }

 return null;
 }

 _analyzeTrackNumbers(tracks) {
 const numbers = tracks
  .map(track => this._toPositiveInteger(track?.trackNumber))
  .filter(number => number !== null);

 const totalTracks = tracks.length;
 const taggedTracks = numbers.length;
 const uniqueNumbers = new Set(numbers);
 const duplicateCount = taggedTracks - uniqueNumbers.size;

 const allTaggedSame =
  taggedTracks >= 3 &&
  uniqueNumbers.size === 1;

 const excessiveDuplicates =
  taggedTracks >= 4 &&
  duplicateCount / taggedTracks >= 0.5;

 const mostlyMissing =
  totalTracks >= 3 &&
  taggedTracks / totalTracks < 0.5;

 return {
  taggedTracks,
  uniqueCount: uniqueNumbers.size,
  allTaggedSame,
  excessiveDuplicates,
  mostlyMissing,
  globallyUnreliable:
   allTaggedSame ||
   excessiveDuplicates
 };
 }

 _resolveDiscNumber(track) {
 const embeddedDisc = this._toPositiveInteger(track?.discNumber);
 if (embeddedDisc) return embeddedDisc;

 const inferredDisc = this._inferDiscNumber(track);
 if (inferredDisc) return inferredDisc;

 return 1;
 }

 _resolveTrackNumber(track, analysis) {
 const embeddedTrack = this._toPositiveInteger(track?.trackNumber);
 const filenameTrack = this._extractTrackNumberFromFilename(track);

 if (!analysis.globallyUnreliable && embeddedTrack) {
  return embeddedTrack;
 }

 if (filenameTrack) {
  return filenameTrack;
 }

 if (!analysis.globallyUnreliable && embeddedTrack) {
  return embeddedTrack;
 }

 return null;
 }

 createContext(tracks) {
 const safeTracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
 const trackAnalysis = this._analyzeTrackNumbers(safeTracks);

 const resolved = new Map();
 const discSet = new Set();

 safeTracks.forEach(track => {
  const discNumber = this._resolveDiscNumber(track);
  const trackNumber = this._resolveTrackNumber(track, trackAnalysis);

  resolved.set(track, {
   discNumber,
   trackNumber
  });

  discSet.add(discNumber);
 });

 return {
  resolved,
  trackAnalysis,
  hasMultipleDiscs:
   discSet.size > 1 ||
   safeTracks.some(track => this._toPositiveInteger(track?.discTotal) > 1)
 };
 }

 getResolvedTrackData(track, context) {
 if (!track) {
  return {
   discNumber: 1,
   trackNumber: null
  };
 }

 const cached = context?.resolved?.get(track);
 if (cached) return cached;

 return {
  discNumber: this._resolveDiscNumber(track),
  trackNumber: this._toPositiveInteger(track?.trackNumber) ||
   this._extractTrackNumberFromFilename(track)
 };
 }

 compare(a, b, context, getDisplayTitle, getTrackFilename) {
 const resolvedA = this.getResolvedTrackData(a, context);
 const resolvedB = this.getResolvedTrackData(b, context);

 if (resolvedA.discNumber !== resolvedB.discNumber) {
  return resolvedA.discNumber - resolvedB.discNumber;
 }

 const hasTrackA = resolvedA.trackNumber !== null;
 const hasTrackB = resolvedB.trackNumber !== null;

 if (
  hasTrackA &&
  hasTrackB &&
  resolvedA.trackNumber !== resolvedB.trackNumber
 ) {
  return resolvedA.trackNumber - resolvedB.trackNumber;
 }

 if (hasTrackA !== hasTrackB) {
  return hasTrackA ? -1 : 1;
 }

 const titleA = getDisplayTitle(a);
 const titleB = getDisplayTitle(b);

 const titleCompare = titleA.localeCompare(
  titleB,
  undefined,
  {
   numeric: true,
   sensitivity: 'base'
  }
 );

 if (titleCompare !== 0) {
  return titleCompare;
 }

 return getTrackFilename(a).localeCompare(
  getTrackFilename(b),
  undefined,
  {
   numeric: true,
   sensitivity: 'base'
  }
 );
 }
}

window.AlbumOrder = new AlbumOrderResolver();