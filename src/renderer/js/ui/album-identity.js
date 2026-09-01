/**
 * COSMIC PLAYER - ALBUM IDENTITY RESOLVER
 * Централизованное определение музыкальных релизов поверх библиотеки.
 *
 * Принципы:
 * - название альбома и albumArtist/artist формируют базовую идентичность;
 * - year является метаданными релиза, а не жесткой частью ключа;
 * - физическая папка используется как дополнительный сигнал;
 * - CD1 / CD2 / Disc 1 / Disc 2 не создают отдельные альбомы;
 * - fuzzy matching намеренно не используется;
 * - исходные track metadata не изменяются.
 */
class AlbumIdentityResolver {
 normalizeText(value) {
 return String(value || '')
  .normalize('NFKC')
  .trim()
  .toLowerCase()
  .replace(/[‐‑‒–—―]/g, '-')
  .replace(/\s+/g, ' ');
 }

 getAlbumTitle(track) {
 const album = String(track?.album || '').trim();

 if (
  !album ||
  album.toLowerCase() === 'unknown album'
 ) {
  return 'Unknown Album';
 }

 return album;
 }

 getPrimaryArtistName(value) {
 const raw = String(value || '').trim();

 if (!raw) {
  return 'Unknown Artist';
 }

 const normalized = raw
  .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '')
  .replace(/\s*[;,]\s*.+$/, '')
  .trim();

 return normalized || raw;
 }

 getAlbumArtist(track) {
 const albumArtist = String(track?.albumArtist || '').trim();

 if (
  albumArtist &&
  albumArtist.toLowerCase() !== 'unknown artist'
 ) {
  return albumArtist;
 }

 return this.getPrimaryArtistName(track?.artist);
 }

 getTrackDirectory(track) {
 if (!track?.path) return '';

 const normalized = String(track.path).replace(/\\/g, '/');
 const slashIndex = normalized.lastIndexOf('/');

 if (slashIndex === -1) return '';

 return normalized.substring(0, slashIndex);
 }

 _isDiscDirectoryName(name) {
 if (!name) return false;

 const normalized = this.normalizeText(name)
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

 return /^(?:cd|disc|disk|диск)\s*0*\d{1,2}$/i.test(normalized);
 }

 getReleaseDirectory(track) {
 let directory = this.getTrackDirectory(track);
 if (!directory) return '';

 const segments = directory.split('/').filter(Boolean);

 if (
  segments.length > 0 &&
  this._isDiscDirectoryName(segments[segments.length - 1])
 ) {
  segments.pop();
 }

 return segments.join('/');
 }

 _normalizeDirectory(directory) {
 return String(directory || '')
  .replace(/\\/g, '/')
  .replace(/\/+/g, '/')
  .replace(/\/$/, '')
  .toLowerCase();
 }

 _getBaseKey(track, resolvedAlbumArtist = null) {
 const album = this.normalizeText(this.getAlbumTitle(track));
 const artist = this.normalizeText(
  resolvedAlbumArtist || this.getAlbumArtist(track)
 );

 return `${album}|||${artist}`;
 }

 _getMostCommonValue(values) {
 const counts = new Map();

 values.forEach(value => {
  if (
   value === null ||
   value === undefined ||
   value === ''
  ) {
   return;
  }

  const key = String(value);
  counts.set(key, (counts.get(key) || 0) + 1);
 });

 let winner = null;
 let winnerCount = 0;

 for (const [value, count] of counts.entries()) {
  if (count > winnerCount) {
   winner = value;
   winnerCount = count;
  }
 }

 return winner;
 }

 _resolveYear(tracks) {
 const years = tracks
  .map(track => {
   const year = Number(track?.year);
   if (
    !Number.isFinite(year) ||
    year < 1000 ||
    year > 9999
   ) {
    return null;
   }

   return Math.floor(year);
  })
  .filter(year => year !== null);

 if (years.length === 0) return '';

 const mostCommon = this._getMostCommonValue(years);
 return mostCommon ? Number(mostCommon) : '';
 }

 _resolveCoverPath(tracks) {
 for (const track of tracks) {
  if (track?.coverPath) {
   return track.coverPath;
  }
 }

 return null;
 }

 _resolveAlbumArtist(tracks) {
 const explicitAlbumArtists = tracks
  .map(track => {
   const value = String(track?.albumArtist || '').trim();

   if (
    value &&
    value.toLowerCase() !== 'unknown artist'
   ) {
    return value;
   }

   return null;
  })
  .filter(Boolean);

 const explicitAlbumArtist = this._getMostCommonValue(
  explicitAlbumArtists
 );

 if (explicitAlbumArtist) {
  return explicitAlbumArtist;
 }

 const primaryArtists = tracks
  .map(track => this.getPrimaryArtistName(track?.artist))
  .filter(artist =>
   artist &&
   artist.toLowerCase() !== 'unknown artist'
  );

 return (
  this._getMostCommonValue(primaryArtists) ||
  'Unknown Artist'
 );
 }

 _shouldSeparateByDirectory(baseTracks) {
 const directories = new Map();

 baseTracks.forEach(track => {
  const directory = this._normalizeDirectory(
   this.getReleaseDirectory(track)
  );

  if (!directory) return;

  if (!directories.has(directory)) {
   directories.set(directory, []);
  }

  directories.get(directory).push(track);
 });

 if (directories.size <= 1) {
  return false;
 }

 const reliableDirectoryYears = [];

 for (const tracks of directories.values()) {
  const yearCounts = new Map();

  tracks.forEach(track => {
   const year = Number(track?.year);

   if (
    !Number.isFinite(year) ||
    year < 1000 ||
    year > 9999
   ) {
    return;
   }

   const normalizedYear = Math.floor(year);
   yearCounts.set(
    normalizedYear,
    (yearCounts.get(normalizedYear) || 0) + 1
   );
  });

  let dominantYear = null;
  let dominantCount = 0;

  for (const [year, count] of yearCounts.entries()) {
   if (count > dominantCount) {
    dominantYear = year;
    dominantCount = count;
   }
  }

  if (
   dominantYear !== null &&
   (
    dominantCount >= 2 ||
    tracks.length === 1
   )
  ) {
   reliableDirectoryYears.push(dominantYear);
  }
 }

 return new Set(reliableDirectoryYears).size >= 2;
 }

 _createRelease(baseKey, tracks, directory = '') {
 const safeTracks = tracks.filter(Boolean);
 const firstTrack = safeTracks[0] || null;
 const title = this.getAlbumTitle(firstTrack);
 const albumArtist = this._resolveAlbumArtist(safeTracks);
 const year = this._resolveYear(safeTracks);
 const coverPath = this._resolveCoverPath(safeTracks);
 const normalizedDirectory = this._normalizeDirectory(directory);

 const releaseId = normalizedDirectory
  ? `${baseKey}|||dir:${normalizedDirectory}`
  : baseKey;

 return {
  id: releaseId,
  key: releaseId,
  baseKey,
  title,
  artist: albumArtist,
  albumArtist,
  year,
  directory: directory || '',
  coverPath,
  tracks: [...safeTracks]
 };
 }

buildReleases(tracksInput) {
 const tracks = Array.isArray(tracksInput)
 ? tracksInput.filter(track => track && !track.isSectionHeader)
 : [];

 const albumGroups = new Map();

 tracks.forEach(track => {
 const albumTitle = this.normalizeText(
 this.getAlbumTitle(track)
 );

 if (!albumGroups.has(albumTitle)) {
 albumGroups.set(albumTitle, []);
 }

 albumGroups.get(albumTitle).push(track);
 });

 const releases = [];

 for (const [albumTitle, albumTracks] of albumGroups.entries()) {
 const directoryGroups = new Map();
 const tracksWithoutDirectory = [];

 albumTracks.forEach(track => {
 const releaseDirectory = this._normalizeDirectory(
 this.getReleaseDirectory(track)
 );

 if (!releaseDirectory) {
 tracksWithoutDirectory.push(track);
 return;
 }

 if (!directoryGroups.has(releaseDirectory)) {
 directoryGroups.set(releaseDirectory, []);
 }

 directoryGroups.get(releaseDirectory).push(track);
 });

 if (directoryGroups.size === 1) {
 const [directory, directoryTracks] =
 Array.from(directoryGroups.entries())[0];

 const combinedTracks = [
 ...directoryTracks,
 ...tracksWithoutDirectory
 ];

 const resolvedAlbumArtist =
 this._resolveAlbumArtist(combinedTracks);

 const baseKey =
 `${albumTitle}|||${this.normalizeText(resolvedAlbumArtist)}`;

 releases.push(
 this._createRelease(
 baseKey,
 combinedTracks,
 directory
 )
 );

 continue;
 }

 if (directoryGroups.size > 1) {
 const directoryEntries =
 Array.from(directoryGroups.entries());

 const shouldSeparateDirectories =
 this._shouldSeparateByDirectory(albumTracks);

 if (!shouldSeparateDirectories) {
 const resolvedAlbumArtist =
 this._resolveAlbumArtist(albumTracks);

 const baseKey =
 `${albumTitle}|||${this.normalizeText(resolvedAlbumArtist)}`;

 releases.push(
 this._createRelease(
 baseKey,
 albumTracks
 )
 );

 continue;
 }

 let largestDirectory = null;
 let largestDirectorySize = -1;

 directoryEntries.forEach(([directory, directoryTracks]) => {
 if (directoryTracks.length > largestDirectorySize) {
 largestDirectory = directory;
 largestDirectorySize = directoryTracks.length;
 }
 });

 if (
 largestDirectory &&
 tracksWithoutDirectory.length > 0
 ) {
 directoryGroups
 .get(largestDirectory)
 .push(...tracksWithoutDirectory);
 }

 for (const [directory, directoryTracks] of directoryGroups.entries()) {
 const resolvedAlbumArtist =
 this._resolveAlbumArtist(directoryTracks);

 const baseKey =
 `${albumTitle}|||${this.normalizeText(resolvedAlbumArtist)}`;

 releases.push(
 this._createRelease(
 baseKey,
 directoryTracks,
 directory
 )
 );
 }

 continue;
 }

 const explicitArtistGroups = new Map();
 const tracksWithoutAlbumArtist = [];

 albumTracks.forEach(track => {
 const explicitAlbumArtist =
 String(track?.albumArtist || '').trim();

 if (
 !explicitAlbumArtist ||
 explicitAlbumArtist.toLowerCase() === 'unknown artist'
 ) {
 tracksWithoutAlbumArtist.push(track);
 return;
 }

 const artistKey =
 this.normalizeText(explicitAlbumArtist);

 if (!explicitArtistGroups.has(artistKey)) {
 explicitArtistGroups.set(artistKey, {
 artist: explicitAlbumArtist,
 tracks: []
 });
 }

 explicitArtistGroups
 .get(artistKey)
 .tracks
 .push(track);
 });

 if (explicitArtistGroups.size === 0) {
 const resolvedAlbumArtist =
 this._resolveAlbumArtist(albumTracks);

 const baseKey =
 `${albumTitle}|||${this.normalizeText(resolvedAlbumArtist)}`;

 releases.push(
 this._createRelease(
 baseKey,
 albumTracks
 )
 );

 continue;
 }

 if (explicitArtistGroups.size === 1) {
 const onlyGroup =
 Array.from(explicitArtistGroups.values())[0];

 onlyGroup.tracks.push(...tracksWithoutAlbumArtist);

 const baseKey =
 `${albumTitle}|||${this.normalizeText(onlyGroup.artist)}`;

 releases.push(
 this._createRelease(
 baseKey,
 onlyGroup.tracks
 )
 );

 continue;
 }

 let largestArtistKey = null;
 let largestArtistGroupSize = -1;

 for (const [artistKey, group] of explicitArtistGroups.entries()) {
 if (group.tracks.length > largestArtistGroupSize) {
 largestArtistKey = artistKey;
 largestArtistGroupSize = group.tracks.length;
 }
 }

 if (
 largestArtistKey &&
 tracksWithoutAlbumArtist.length > 0
 ) {
 explicitArtistGroups
 .get(largestArtistKey)
 .tracks
 .push(...tracksWithoutAlbumArtist);
 }

 for (const [artistKey, group] of explicitArtistGroups.entries()) {
 const baseKey =
 `${albumTitle}|||${artistKey}`;

 releases.push(
 this._createRelease(
 baseKey,
 group.tracks
 )
 );
 }
 }

 return releases;
}

 findReleaseByTrackId(tracksInput, trackId) {
 if (!trackId) return null;

 const releases = this.buildReleases(tracksInput);

 return releases.find(release =>
  release.tracks.some(track => track.id === trackId)
 ) || null;
 }

 getReleaseTrackIds(release) {
 if (!release || !Array.isArray(release.tracks)) {
  return [];
 }

 return release.tracks
  .map(track => track?.id)
  .filter(Boolean);
 }
}

window.AlbumIdentity = new AlbumIdentityResolver();