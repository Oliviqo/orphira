/**
 * COSMIC PLAYER - ARTIST IDENTITY RESOLVER
 * Единый источник истины для музыкальных исполнителей.
 *
 * Задачи:
 * - один track может принадлежать нескольким артистам;
 * - feat. / ft. / featuring и явные collaboration separators разделяются;
 * - строка "Artist A, Artist B" не становится третьим артистом;
 * - неоднозначный "&" разделяется только при наличии библиотечного сигнала;
 * - регистр, Unicode и лишние пробелы не создают дубликаты;
 * - исходные track metadata никогда не изменяются;
 * - результат пригоден для Artists Grid, Artist View и кликабельных credits.
 */
class ArtistIdentityResolver {
 constructor() {
 this.entities = [];
 this.entityById = new Map();
 this.trackCredits = new Map();
 this.aliasByNormalizedName = new Map();
 this.librarySignature = '';
 }

 normalizeText(value) {
 return String(value || '')
 .normalize('NFKC')
 .replace(/[‒–—―]/g, '-')
 .replace(/\s+/g, ' ')
 .trim()
 .toLowerCase();
 }

 normalizeDisplayName(value) {
 return String(value || '')
 .normalize('NFKC')
 .replace(/\s+/g, ' ')
 .replace(/^[,;|/]+|[,;|/]+$/g, '')
 .trim();
 }

 createArtistId(name) {
 const normalized = this.normalizeText(name);

 if (!normalized) {
 return 'artist:unknown';
 }

 return `artist:${encodeURIComponent(normalized)}`;
 }

 isUnknownArtist(value) {
 const normalized = this.normalizeText(value);

 return (
 !normalized ||
 normalized === 'unknown artist' ||
 normalized === 'various artists'
 );
 }

 _getTrackKey(track) {
 if (!track) return '';

 return String(
 track.id ||
 track.path ||
 `${track.artist || ''}|||${track.title || ''}`
 );
 }

 _buildLibrarySignature(tracks) {
 const safeTracks = Array.isArray(tracks) ? tracks : [];

 let signature = `${safeTracks.length}`;

 for (let i = 0; i < safeTracks.length; i++) {
 const track = safeTracks[i];

 signature += `|${track?.id || ''}:${track?.artist || ''}:${track?.albumArtist || ''}`;
 }

 return signature;
 }

 _collectStrongStandaloneNames(tracks) {
 const standalone = new Map();

 const register = (rawName) => {
 const displayName = this.normalizeDisplayName(rawName);
 const normalized = this.normalizeText(displayName);

 if (
 !displayName ||
 this.isUnknownArtist(displayName)
 ) {
 return;
 }

 const existing = standalone.get(normalized);

 if (!existing) {
 standalone.set(normalized, {
 name: displayName,
 count: 1
 });
 } else {
 existing.count++;
 }
 };

 tracks.forEach(track => {
 const artist = this.normalizeDisplayName(track?.artist);
 const albumArtist = this.normalizeDisplayName(track?.albumArtist);

 if (
 artist &&
 !this._containsExplicitCollaborationSeparator(artist)
 ) {
 register(artist);
 }

 if (
 albumArtist &&
 !this._containsExplicitCollaborationSeparator(albumArtist)
 ) {
 register(albumArtist);
 }
 });

 return standalone;
 }

 _containsExplicitCollaborationSeparator(value) {
 const text = String(value || '');

 return (
 /\b(?:feat(?:uring)?|ft)\.?\s+/i.test(text) ||
 /\s*[,;]\s*/.test(text) ||
 /\s+[x×]\s+/i.test(text)
 );
 }

 _splitExplicitCredits(rawValue) {
 const value = this.normalizeDisplayName(rawValue);

 if (!value) return [];

 const normalizedSeparators = value
 .replace(
 /\s+(?:feat(?:uring)?|ft)\.?\s+/gi,
 '|||'
 )
 .replace(/\s*[;,]\s*/g, '|||')
 .replace(/\s+[x×]\s+/gi, '|||');

 return normalizedSeparators
 .split('|||')
 .map(name => this.normalizeDisplayName(name))
 .filter(Boolean);
 }

 _splitAmbiguousAmpersand(name, standaloneNames) {
 const displayName = this.normalizeDisplayName(name);

 if (!displayName || !displayName.includes('&')) {
 return [displayName].filter(Boolean);
 }

 const parts = displayName
 .split(/\s*&\s*/)
 .map(part => this.normalizeDisplayName(part))
 .filter(Boolean);

 if (parts.length !== 2) {
 return [displayName];
 }

 const leftKey = this.normalizeText(parts[0]);
 const rightKey = this.normalizeText(parts[1]);

 const leftEvidence = standaloneNames.has(leftKey);
 const rightEvidence = standaloneNames.has(rightKey);

 if (leftEvidence && rightEvidence) {
 return parts;
 }

 return [displayName];
 }

 _deduplicateCredits(credits) {
 const result = [];
 const seen = new Set();

 credits.forEach(name => {
 const displayName = this.normalizeDisplayName(name);
 const normalized = this.normalizeText(displayName);

 if (
 !displayName ||
 this.isUnknownArtist(displayName) ||
 seen.has(normalized)
 ) {
 return;
 }

 seen.add(normalized);
 result.push(displayName);
 });

 return result;
 }

 parseCredits(rawArtist, standaloneNames = new Map()) {
 const displayArtist = this.normalizeDisplayName(rawArtist);

 if (this.isUnknownArtist(displayArtist)) {
 return ['Unknown Artist'];
 }

 const explicitParts =
 this._splitExplicitCredits(displayArtist);

 const finalParts = [];

 explicitParts.forEach(part => {
 const ampersandParts =
 this._splitAmbiguousAmpersand(
 part,
 standaloneNames
 );

 ampersandParts.forEach(name => {
 finalParts.push(name);
 });
 });

 const deduplicated =
 this._deduplicateCredits(finalParts);

 return deduplicated.length > 0
 ? deduplicated
 : ['Unknown Artist'];
 }

 _registerCanonicalName(name, nameStats) {
 const displayName = this.normalizeDisplayName(name);
 const normalized = this.normalizeText(displayName);

 if (!normalized) return;

 if (!nameStats.has(normalized)) {
 nameStats.set(normalized, new Map());
 }

 const variants = nameStats.get(normalized);
 variants.set(
 displayName,
 (variants.get(displayName) || 0) + 1
 );
 }

 _chooseCanonicalName(normalizedName, nameStats) {
 const variants = nameStats.get(normalizedName);

 if (!variants || variants.size === 0) {
 return normalizedName;
 }

 let bestName = normalizedName;
 let bestCount = -1;

 for (const [name, count] of variants.entries()) {
 if (count > bestCount) {
 bestName = name;
 bestCount = count;
 continue;
 }

 if (
 count === bestCount &&
 name.length > bestName.length
 ) {
 bestName = name;
 }
 }

 return bestName;
 }

 _resolveArtistCover(tracks) {
 const coverCounts = new Map();

 tracks.forEach(track => {
 if (!track?.coverPath) return;

 coverCounts.set(
 track.coverPath,
 (coverCounts.get(track.coverPath) || 0) + 1
 );
 });

 let bestCover = null;
 let bestCount = 0;

 for (const [coverPath, count] of coverCounts.entries()) {
 if (count > bestCount) {
 bestCover = coverPath;
 bestCount = count;
 }
 }

 return bestCover;
 }

 _buildAlbumsForArtist(tracks) {
 if (
 window.AlbumIdentity &&
 typeof window.AlbumIdentity.buildReleases === 'function'
 ) {
 return window.AlbumIdentity.buildReleases(tracks);
 }

 const albums = new Map();

 tracks.forEach(track => {
 const albumName =
 this.normalizeDisplayName(track?.album) ||
 'Unknown Album';

 const key = this.normalizeText(albumName);

 if (!albums.has(key)) {
 albums.set(key, {
 id: `album:${encodeURIComponent(key)}`,
 title: albumName,
 tracks: []
 });
 }

 albums.get(key).tracks.push(track);
 });

 return Array.from(albums.values());
 }

 rebuild(tracksInput) {
 const tracks = Array.isArray(tracksInput)
 ? tracksInput.filter(
 track => track && !track.isSectionHeader
 )
 : [];

 const signature =
 this._buildLibrarySignature(tracks);

 const standaloneNames =
 this._collectStrongStandaloneNames(tracks);

 const nameStats = new Map();
 const creditsByTrackKey = new Map();

 tracks.forEach(track => {
 const credits =
 this.parseCredits(
 track.artist,
 standaloneNames
 );

 creditsByTrackKey.set(
 this._getTrackKey(track),
 credits
 );

 credits.forEach(name => {
 this._registerCanonicalName(
 name,
 nameStats
 );
 });
 });

 const groupedTracks = new Map();

 tracks.forEach(track => {
 const trackKey = this._getTrackKey(track);
 const credits =
 creditsByTrackKey.get(trackKey) ||
 ['Unknown Artist'];

 credits.forEach(rawName => {
 const normalized =
 this.normalizeText(rawName);

 if (!groupedTracks.has(normalized)) {
 groupedTracks.set(normalized, []);
 }

 const artistTracks =
 groupedTracks.get(normalized);

 if (
 !artistTracks.some(
 existingTrack =>
 this._getTrackKey(existingTrack) === trackKey
 )
 ) {
 artistTracks.push(track);
 }
 });
 });

 const entities = [];

 for (
 const [normalizedName, artistTracks]
 of groupedTracks.entries()
 ) {
 const canonicalName =
 normalizedName === 'unknown artist'
 ? 'Unknown Artist'
 : this._chooseCanonicalName(
 normalizedName,
 nameStats
 );

 const entity = {
 id: this.createArtistId(canonicalName),
 key: normalizedName,
 name: canonicalName,
 normalizedName,
 tracks: [...artistTracks],
 albums: this._buildAlbumsForArtist(
 artistTracks
 ),
 coverPath: this._resolveArtistCover(
 artistTracks
 )
 };

 entities.push(entity);
 }

 entities.sort((a, b) => {
 if (a.name === 'Unknown Artist') return 1;
 if (b.name === 'Unknown Artist') return -1;

 return a.name.localeCompare(
 b.name,
 undefined,
 {
 numeric: true,
 sensitivity: 'base'
 }
 );
 });

 this.entities = entities;
 this.entityById = new Map(
 entities.map(entity => [
 entity.id,
 entity
 ])
 );

 this.trackCredits.clear();
 this.aliasByNormalizedName.clear();

 entities.forEach(entity => {
 this.aliasByNormalizedName.set(
 entity.normalizedName,
 entity.id
 );
 });

 tracks.forEach(track => {
 const trackKey = this._getTrackKey(track);
 const rawCredits =
 creditsByTrackKey.get(trackKey) ||
 ['Unknown Artist'];

 const resolvedCredits = rawCredits
 .map(name => {
 const normalized =
 this.normalizeText(name);

 const artistId =
 this.aliasByNormalizedName.get(
 normalized
 ) ||
 this.createArtistId(name);

 const entity =
 this.entityById.get(artistId);

 return {
 id: artistId,
 name: entity?.name ||
 this.normalizeDisplayName(name) ||
 'Unknown Artist'
 };
 })
 .filter((credit, index, array) => (
 array.findIndex(
 candidate => candidate.id === credit.id
 ) === index
 ));

 this.trackCredits.set(
 trackKey,
 resolvedCredits
 );
 });

 this.librarySignature = signature;

 return this.entities;
 }

 ensure(tracksInput) {
 const tracks = Array.isArray(tracksInput)
 ? tracksInput.filter(
 track => track && !track.isSectionHeader
 )
 : [];

 const signature =
 this._buildLibrarySignature(tracks);

 if (signature !== this.librarySignature) {
 return this.rebuild(tracks);
 }

 return this.entities;
 }

 getEntities(tracksInput = null) {
 if (Array.isArray(tracksInput)) {
 return this.rebuild(tracksInput);
 }

 return this.ensure(
 window.state?.library || []
 );
 }

 getTrackCredits(track) {
 if (!track) return [];

 this.ensure(
 window.state?.library || []
 );

 const trackKey = this._getTrackKey(track);
 const cached =
 this.trackCredits.get(trackKey);

 if (cached) {
 return [...cached];
 }

 const standaloneNames =
 this._collectStrongStandaloneNames(
 window.state?.library || []
 );

 return this.parseCredits(
 track.artist,
 standaloneNames
 ).map(name => ({
 id: this.createArtistId(name),
 name
 }));
 }

 findById(artistId) {
 if (!artistId) return null;

 this.ensure(
 window.state?.library || []
 );

 return this.entityById.get(artistId) || null;
 }

 findByName(name) {
 const normalized =
 this.normalizeText(name);

 if (!normalized) return null;

 this.ensure(
 window.state?.library || []
 );

 const artistId =
 this.aliasByNormalizedName.get(normalized);

 return artistId
 ? this.entityById.get(artistId) || null
 : null;
 }

 findForTrack(track, artistName = null) {
 if (!track) return null;

 const credits =
 this.getTrackCredits(track);

 if (artistName) {
 const normalizedTarget =
 this.normalizeText(artistName);

 const targetCredit =
 credits.find(
 credit =>
 this.normalizeText(credit.name) ===
 normalizedTarget
 );

 if (targetCredit) {
 return this.findById(
 targetCredit.id
 );
 }
 }

 const firstCredit = credits[0];

 return firstCredit
 ? this.findById(firstCredit.id)
 : null;
 }

 getArtistTrackIds(artist) {
 if (!artist || !Array.isArray(artist.tracks)) {
 return [];
 }

 return artist.tracks
 .map(track => track?.id)
 .filter(Boolean);
 }
}

window.ArtistIdentity =
 new ArtistIdentityResolver();