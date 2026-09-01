/**
 * ORPHIRA - ARTIST OVERLAY VIEW
 *
 * Самостоятельный экран исполнителя.
 *
 * Структура:
 * - круглая artwork и статистика слева;
 * - Albums / Tracks справа;
 * - обе страницы постоянно существуют внутри одного viewport;
 * - переключение страниц выполняется transform-анимацией;
 * - порядок дискографии используется также как playback order артиста;
 * - Album View открывается поверх Artist View;
 * - NavigationHistory возвращает Album -> Artist -> Library.
 */
class ArtistViewManager {
 constructor() {
 this.isOpen = false;
 this.overlayEl = null;
 this.currentArtist = null;
 this.activePage = 'albums';
 this.sortConfig = {
 field: 'year',
 order: 'asc'
 };
 this.closeTimer = null;
 this.sortTimer = null;
 this.paletteRequestToken = 0;
 this.savedSearchQuery = '';
 this.savedLibraryScrollTop = 0;
 this.initialized = false;
 }

 init() {
 if (this.initialized) {
 return;
 }

 this.overlayEl =
 document.getElementById(
 'artist-overlay'
 );

 if (!this.overlayEl) {
 return;
 }

 this.initialized = true;

 document
 .getElementById('artist-btn-back')
 ?.addEventListener(
 'click',
 () => {
 this.requestClose();
 }
 );

 document
 .getElementById('artist-btn-play')
 ?.addEventListener(
 'click',
 () => {
 this.playAll(false);
 }
 );

 document
 .getElementById('artist-btn-shuffle')
 ?.addEventListener(
 'click',
 () => {
 this.playAll(true);
 }
 );

 document
 .getElementById('artist-btn-queue-next')
 ?.addEventListener(
 'click',
 () => {
 const tracks =
 this.getOrderedArtistTracks();

 if (
 tracks.length > 0 &&
 window.State
 ) {
 window.State.addToQueueNext(
 tracks
 );
 }
 }
 );

 document
 .getElementById('artist-btn-queue-end')
 ?.addEventListener(
 'click',
 () => {
 const tracks =
 this.getOrderedArtistTracks();

 if (
 tracks.length > 0 &&
 window.State
 ) {
 window.State.addToQueueEnd(
 tracks
 );
 }
 }
 );

 document
 .querySelectorAll(
 '.artist-view-tab'
 )
 .forEach(tab => {
 tab.addEventListener(
 'click',
 () => {
 this.switchPage(
 tab.dataset.artistPage
 );
 }
 );
 });

 this._bindSortControls();
 }

 _getArtistById(artistId) {
 if (
 !artistId ||
 !window.ArtistIdentity
 ) {
 return null;
 }

 return (
 window.ArtistIdentity.findById(
 artistId
 ) ||
 null
 );
 }

 _getAlbums() {
 if (
 !this.currentArtist ||
 !Array.isArray(
 this.currentArtist.albums
 )
 ) {
 return [];
 }

 return [
 ...this.currentArtist.albums
 ];
 }

 _getValidYear(album) {
 const year =
 Number(album?.year);

 if (
 !Number.isFinite(year) ||
 year < 1000 ||
 year > 9999
 ) {
 return null;
 }

 return Math.floor(year);
 }

 _compareAlbumDefault(a, b) {
 const yearA =
 this._getValidYear(a);

 const yearB =
 this._getValidYear(b);

 if (
 yearA !== null &&
 yearB !== null &&
 yearA !== yearB
 ) {
 return yearA - yearB;
 }

 if (
 yearA !== null &&
 yearB === null
 ) {
 return -1;
 }

 if (
 yearA === null &&
 yearB !== null
 ) {
 return 1;
 }

 const titleA =
 String(
 a?.title || ''
 );

 const titleB =
 String(
 b?.title || ''
 );

 const titleCompare =
 titleA.localeCompare(
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

 return String(
 a?.id || a?.key || ''
 )
 .localeCompare(
 String(
 b?.id || b?.key || ''
 ),
 undefined,
 {
 numeric: true,
 sensitivity: 'base'
 }
 );
 }

 getSortedAlbums() {
 const albums =
 this._getAlbums();

 const field =
 this.sortConfig.field;

 const multiplier =
 this.sortConfig.order === 'asc'
 ? 1
 : -1;

 albums.sort(
 (a, b) => {
 if (field === 'year') {
 const yearA =
 this._getValidYear(a);

 const yearB =
 this._getValidYear(b);

 if (
 yearA !== null &&
 yearB !== null &&
 yearA !== yearB
 ) {
 return (
 yearA - yearB
 ) * multiplier;
 }

 if (
 yearA !== null &&
 yearB === null
 ) {
 return -1;
 }

 if (
 yearA === null &&
 yearB !== null
 ) {
 return 1;
 }

 return (
 String(a?.title || '')
 .localeCompare(
 String(b?.title || ''),
 undefined,
 {
 numeric: true,
 sensitivity: 'base'
 }
 ) *
 multiplier
 );
 }

 if (field === 'title') {
 return (
 String(a?.title || '')
 .localeCompare(
 String(b?.title || ''),
 undefined,
 {
 numeric: true,
 sensitivity: 'base'
 }
 ) *
 multiplier
 );
 }

 if (field === 'tracksCount') {
 const countA =
 Array.isArray(a?.tracks)
 ? a.tracks.length
 : 0;

 const countB =
 Array.isArray(b?.tracks)
 ? b.tracks.length
 : 0;

 if (countA !== countB) {
 return (
 countA - countB
 ) * multiplier;
 }

 return (
 this._compareAlbumDefault(
 a,
 b
 ) *
 multiplier
 );
 }

 return (
 this._compareAlbumDefault(
 a,
 b
 ) *
 multiplier
 );
 }
 );

 return albums;
 }

 _getAlbumOrderedTracks(album) {
 const tracks =
 Array.isArray(album?.tracks)
 ? [...album.tracks]
 : [];

 if (!window.AlbumOrder) {
 return tracks;
 }

 const context =
 window.AlbumOrder.createContext(
 tracks
 );

 const getDisplayTitle =
 track => {
 const title =
 String(
 track?.title || ''
 )
 .trim();

 if (
 title &&
 title.toLowerCase() !==
 'unknown track' &&
 title.toLowerCase() !==
 'unknown title'
 ) {
 return title;
 }

 return this._getTrackFilename(
 track
 ) || (
 window.i18n?.t(
 'unknown_track'
 ) ||
 'Unknown Track'
 );
 };

 return tracks.sort(
 (a, b) =>
 window.AlbumOrder.compare(
 a,
 b,
 context,
 getDisplayTitle,
 track =>
 this._getTrackFilename(
 track
 )
 )
 );
 }

 getOrderedArtistTracks() {
 const albums =
 this.getSortedAlbums();

 const result = [];
 const seen = new Set();

 albums.forEach(
 album => {
 const albumTracks =
 this._getAlbumOrderedTracks(
 album
 );

 albumTracks.forEach(
 track => {
 if (
 !track ||
 !track.id ||
 seen.has(track.id)
 ) {
 return;
 }

 seen.add(track.id);
 result.push(track);
 }
 );
 }
 );

 if (
 this.currentArtist &&
 Array.isArray(
 this.currentArtist.tracks
 )
 ) {
 this.currentArtist.tracks
 .forEach(track => {
 if (
 !track ||
 !track.id ||
 seen.has(track.id)
 ) {
 return;
 }

 seen.add(track.id);
 result.push(track);
 });
 }

 return result;
 }

 _getTrackFilename(track) {
 if (!track?.path) {
 return '';
 }

 const normalized =
 String(track.path)
 .replace(/\\/g, '/');

 const fileName =
 normalized.substring(
 normalized.lastIndexOf('/') + 1
 );

 return fileName.replace(
 /\.[^.]+$/,
 ''
 );
 }

 _getDisplayTrackTitle(track) {
 const title =
 String(
 track?.title || ''
 )
 .trim();

 if (
 title &&
 title.toLowerCase() !==
 'unknown track' &&
 title.toLowerCase() !==
 'unknown title'
 ) {
 return title;
 }

 return (
 this._getTrackFilename(track) ||
 window.i18n?.t(
 'unknown_track'
 ) ||
 'Unknown Track'
 );
 }

 _getTrackAlbum(track) {
 const album =
 String(
 track?.album || ''
 )
 .trim();

 if (
 !album ||
 album.toLowerCase() ===
 'unknown album'
 ) {
 return '';
 }

 return album;
 }

 _getAlbumForTrackId(trackId) {
 if (!trackId) {
 return null;
 }

 return (
 this._getAlbums()
 .find(
 album =>
 Array.isArray(album?.tracks) &&
 album.tracks.some(
 track =>
 track?.id === trackId
 )
 ) ||
 null
 );
 }

 _createNavigationState() {
 return {
 type: 'artist',
 artistId:
 this.currentArtist?.id ||
 null,
 activePage:
 this.activePage,
 sortConfig: {
 ...this.sortConfig
 },
 searchState:
 window.NavigationHistory
 ?.captureSearchState() || {
 query: '',
 placeholder:
 window.i18n?.t('search') ||
 'Search track, artist, album...'
 }
 };
 }

 async openArtist(
 artistInput,
 navigationSource = null
 ) {
 if (!this.initialized) {
 this.init();
 }

 if (
 !this.overlayEl ||
 !artistInput
 ) {
 return;
 }

 const artist =
 typeof artistInput === 'string'
 ? this._getArtistById(
 artistInput
 )
 : artistInput;

 if (!artist) {
 return;
 }

 const previousSearchState =
 window.NavigationHistory
 ?.captureSearchState() || {
 query:
 window.Search?.inputEl?.value ||
 '',
 placeholder:
 window.Search?.inputEl
 ?.getAttribute(
 'placeholder'
 ) ||
 window.i18n?.t('search') ||
 'Search track, artist, album...'
 };

 if (
 window.NavigationHistory &&
 !window.NavigationHistory.restoring
 ) {
 window.NavigationHistory.push(
 navigationSource || {
 type: 'library',
 searchState:
 previousSearchState,
 libraryView:
 window.LibraryViews
 ?.currentView ||
 'artists',
 libraryScrollTop:
 document.getElementById(
 'library-grid-view'
 )?.scrollTop ||
 0
 }
 );
 }

 this.currentArtist =
 artist;

 this.activePage =
 'albums';

 this.sortConfig = {
 field: 'year',
 order: 'asc'
 };

 this.savedSearchQuery =
 previousSearchState.query ||
 '';

 this.savedLibraryScrollTop =
 document.getElementById(
 'library-grid-view'
 )?.scrollTop ||
 0;

 if (
 window.Search?.inputEl
 ) {
 window.Search.inputEl.value =
 '';

 window.Search
 ._toggleClearButton(false);

 window.Search
 .hideHistoryDropdown();
 }

 if (this.closeTimer) {
 clearTimeout(
 this.closeTimer
 );

 this.closeTimer = null;
 }

 this.isOpen = true;

 this.overlayEl.classList.remove(
 'artist-open',
 'artist-closing'
 );

 this.overlayEl.classList.add(
 'artist-opening'
 );

 this.overlayEl.classList.remove(
 'hidden'
 );

 this.render();

 requestAnimationFrame(
 () => {
 requestAnimationFrame(
 () => {
 if (
 !this.isOpen ||
 !this.overlayEl
 ) {
 return;
 }

 this.overlayEl.classList.remove(
 'artist-opening'
 );

 this.overlayEl.classList.add(
 'artist-open'
 );
 }
 );
 }
 );

 await this._applyArtistPalette(
 artist
 );
 }

 async restoreNavigationState(
 state
 ) {
 const artist =
 this._getArtistById(
 state?.artistId
 );

 if (!artist) {
 return false;
 }

 if (!this.initialized) {
 this.init();
 }

 this.currentArtist =
 artist;

 this.activePage =
 state?.activePage ===
 'tracks'
 ? 'tracks'
 : 'albums';

 this.sortConfig = {
 field:
 state?.sortConfig?.field ||
 'year',
 order:
 state?.sortConfig?.order ===
 'desc'
 ? 'desc'
 : 'asc'
 };

 if (this.closeTimer) {
 clearTimeout(
 this.closeTimer
 );

 this.closeTimer = null;
 }

 this.isOpen = true;

 this.overlayEl.classList.remove(
 'hidden',
 'artist-opening',
 'artist-closing'
 );

 this.overlayEl.classList.add(
 'artist-open'
 );

 this.render();

 await this._applyArtistPalette(
 artist
 );

 return true;
 }

 requestClose() {
 if (
 window.NavigationHistory
 ?.canGoBack()
 ) {
 window.NavigationHistory.back();
 return;
 }

 this.close();
 }

 close(options = {}) {
 if (!this.isOpen) {
 return;
 }

 const restoreSearch =
 options.restoreSearch !== false;

 const fromNavigation =
 options.fromNavigation === true;

 this.isOpen = false;
 this.paletteRequestToken++;

 if (
 !fromNavigation &&
 window.NavigationHistory
 ?.canGoBack()
 ) {
 window.NavigationHistory.pop();
 }

 if (
 restoreSearch &&
 window.Search?.inputEl
 ) {
 const query =
 this.savedSearchQuery || '';

 window.Search.inputEl.value =
 query;

 window.Search
 ._toggleClearButton(
 query.length > 0
 );

 window.Search.syncContext();

 if (
 window.Search.executeSearch
 ) {
 window.Search.executeSearch(
 query
 );
 }
 }

 if (!this.overlayEl) {
 return;
 }

 this.overlayEl.classList.remove(
 'artist-opening',
 'artist-open'
 );

 this.overlayEl.classList.add(
 'artist-closing'
 );

 if (this.closeTimer) {
 clearTimeout(
 this.closeTimer
 );
 }

 this.closeTimer =
 setTimeout(
 () => {
 if (
 this.isOpen ||
 !this.overlayEl
 ) {
 return;
 }

 this.overlayEl.classList.add(
 'hidden'
 );

 this.overlayEl.classList.remove(
 'artist-closing'
 );

 this._resetArtistPalette();

 const grid =
 document.getElementById(
 'library-grid-view'
 );

 if (grid) {
 grid.scrollTop =
 this.savedLibraryScrollTop;
 }

 this.currentArtist = null;
 this.closeTimer = null;
 },
 180
 );
 }

 switchPage(page) {
 const nextPage =
 page === 'tracks'
 ? 'tracks'
 : 'albums';

 this.activePage =
 nextPage;

 const track =
 document.getElementById(
 'artist-pages-track'
 );

 if (track) {
 track.classList.toggle(
 'show-tracks',
 nextPage === 'tracks'
 );
 }

 document
 .querySelectorAll(
 '.artist-view-tab'
 )
 .forEach(tab => {
 tab.classList.toggle(
 'active',
 tab.dataset.artistPage ===
 nextPage
 );
 });

 this.syncPlayingState();
 }

 render() {
 if (!this.currentArtist) {
 return;
 }

 this.renderLeftPanel();
 this.renderAlbumsPage();
 this.renderTracksPage();
 this.switchPage(
 this.activePage
 );
 this.syncPlayingState();

 if (window.i18n) {
 window.i18n.updateDOM();
 }
 }

 renderLeftPanel() {
 const artist =
 this.currentArtist;

 const artwork =
 document.getElementById(
 'artist-artwork'
 );

 const name =
 document.getElementById(
 'artist-name'
 );

 const stats =
 document.getElementById(
 'artist-stats'
 );

 if (name) {
 name.textContent =
 artist.name ||
 'Unknown Artist';
 }

 if (artwork) {
 if (artist.coverPath) {
 artwork.style.backgroundImage =
 `url("media://${encodeURIComponent(artist.coverPath)}")`;

 artwork.classList.remove(
 'default-artwork'
 );

 artwork.innerHTML = '';
 } else {
 artwork.style.backgroundImage =
 'none';

 artwork.classList.add(
 'default-artwork'
 );

 artwork.innerHTML = `
 <svg viewBox="0 0 24 24">
 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
 </svg>
 `;
 }
 }

 if (stats) {
 const albumsCount =
 this._getAlbums().length;

 const tracksCount =
 Array.isArray(artist.tracks)
 ? artist.tracks.length
 : 0;

 const albumTemplate =
 window.i18n?.t(
 'artist_albums_count'
 ) ||
 '{count} albums';

 const trackTemplate =
 window.i18n?.t(
 'artist_tracks_count'
 ) ||
 '{count} tracks';

 stats.textContent =
 `${albumTemplate.replace(
 '{count}',
 String(albumsCount)
 )} · ${trackTemplate.replace(
 '{count}',
 String(tracksCount)
 )}`;
 }
 }

 renderAlbumsPage() {
 const container =
 document.getElementById(
 'artist-albums-grid'
 );

 if (!container) {
 return;
 }

 container.innerHTML = '';

 const albums =
 this.getSortedAlbums();

 if (albums.length === 0) {
 const empty =
 document.createElement('div');

 empty.className =
 'artist-page-empty';

 empty.textContent =
 window.i18n?.t(
 'no_albums_found'
 ) ||
 'No albums found';

 container.appendChild(
 empty
 );

 return;
 }

 albums.forEach(
 album => {
 const card =
 this._createAlbumCard(
 album
 );

 container.appendChild(
 card
 );
 }
 );

 this.syncPlayingState();
 }

 _createAlbumCard(album) {
 const card =
 document.createElement('div');

 card.className =
 'artist-album-card';

 card.dataset.albumId =
 String(
 album.id ||
 album.key ||
 ''
 );

 const cover =
 document.createElement('div');

 cover.className =
 'artist-album-card-cover';

 if (album.coverPath) {
 cover.style.backgroundImage =
 `url("media://${encodeURIComponent(album.coverPath)}")`;
 } else {
 cover.classList.add(
 'default-cover'
 );

 cover.innerHTML = `
 <svg viewBox="0 0 24 24">
 <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
 </svg>
 `;
 }

 const playButton =
 document.createElement('button');

 playButton.className =
 'artist-album-play';

 playButton.setAttribute(
 'data-i18n-tooltip',
 'album_play_all'
 );

 playButton.innerHTML = `
 <svg viewBox="0 0 24 24">
 <path d="M8 5v14l11-7z"/>
 </svg>
 `;

 playButton.addEventListener(
 'click',
 e => {
 e.preventDefault();
 e.stopPropagation();

 this.playAlbum(
 album
 );
 }
 );

 cover.appendChild(
 playButton
 );

 const meta =
 document.createElement('div');

 meta.className =
 'artist-album-card-meta';

 const title =
 document.createElement('div');

 title.className =
 'artist-album-card-title';

 title.textContent =
 album.title ||
 'Unknown Album';

 const subtitle =
 document.createElement('div');

 subtitle.className =
 'artist-album-card-subtitle';

 const subtitleParts = [];

 if (album.year) {
 subtitleParts.push(
 String(album.year)
 );
 }

 if (
 Array.isArray(
 album.tracks
 )
 ) {
 subtitleParts.push(
 (
 window.i18n?.t(
 'artist_tracks_count'
 ) ||
 '{count} tracks'
 )
 .replace(
 '{count}',
 String(
 album.tracks.length
 )
 )
 );
 }

 subtitle.textContent =
 subtitleParts.join(' · ');

 meta.appendChild(title);
 meta.appendChild(subtitle);

 card.appendChild(cover);
 card.appendChild(meta);

 card.addEventListener(
 'click',
 () => {
 if (!window.AlbumView) {
 return;
 }

 window.AlbumView.openAlbum(
 album,
 this._createNavigationState()
 );
 }
 );

 card.addEventListener(
 'contextmenu',
 e => {
 e.preventDefault();
 e.stopPropagation();

 const tracks =
 this._getAlbumOrderedTracks(
 album
 );

 if (
 tracks.length > 0 &&
 window.ContextMenu
 ) {
 window.ContextMenu.showTrackMenu(
 e,
 tracks[0],
 tracks
 );
 }
 }
 );

 if (
 album.coverPath &&
 window.CoverColor
 ) {
 const mediaUrl =
 `media://${encodeURIComponent(album.coverPath)}`;

 window.CoverColor
 .extractPalette(
 mediaUrl
 )
 .then(
 palette => {
 if (
 !palette ||
 !card.isConnected
 ) {
 return;
 }

 card.style.setProperty(
 '--artist-card-accent',
 palette.accent
 );

 card.style.setProperty(
 '--artist-card-accent-rgb',
 palette.accentRgb
 );

 card.style.setProperty(
 '--artist-card-accent-text',
 palette.accentText
 );

 card.classList.add(
 'has-accent'
 );
 }
 );
 }

 return card;
 }

 renderTracksPage() {
 const body =
 document.getElementById(
 'artist-tracklist-body'
 );

 if (!body) {
 return;
 }

 body.innerHTML = '';

 const albums =
 this.getSortedAlbums();

 let displayIndex = 0;

 albums.forEach(
 album => {
 const tracks =
 this._getAlbumOrderedTracks(
 album
 );

 tracks.forEach(
 track => {
 displayIndex++;

 const row =
 document.createElement('div');

 row.className =
 'artist-track-row';

 row.dataset.trackId =
 track.id || '';

 row.dataset.albumId =
 String(
 album.id ||
 album.key ||
 ''
 );

 const index =
 document.createElement('div');

 index.className =
 'artist-track-index';

 index.textContent =
 String(displayIndex);

 const title =
 document.createElement('div');

 title.className =
 'artist-track-title';

 title.textContent =
 this._getDisplayTrackTitle(
 track
 );

 const albumCell =
 document.createElement('div');

 albumCell.className =
 'artist-track-album';

 albumCell.textContent =
 album.title ||
 this._getTrackAlbum(track);

 const duration =
 document.createElement('div');

 duration.className =
 'artist-track-time';

 duration.textContent =
 window.formatTime
 ? window.formatTime(
 track.duration
 )
 : '0:00';

 row.appendChild(index);
 row.appendChild(title);
 row.appendChild(albumCell);
 row.appendChild(duration);

 row.addEventListener(
 'click',
 () => {
 this.playTrackFromArtist(
 track
 );
 }
 );

 row.addEventListener(
 'contextmenu',
 e => {
 e.preventDefault();
 e.stopPropagation();

 if (window.ContextMenu) {
 window.ContextMenu.showTrackMenu(
 e,
 track,
 this.getOrderedArtistTracks()
 );
 }
 }
 );

 body.appendChild(row);
 }
 );
 }
 );

 this.syncPlayingState();
 }

 playTrackFromArtist(track) {
 if (
 !track ||
 !window.State ||
 !this.currentArtist
 ) {
 return;
 }

 const tracks =
 this.getOrderedArtistTracks();

 const sourceId =
 this.currentArtist.id ||
 `artist:${this.currentArtist.name}`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginArtist(
 sourceId
 );
 }

 window.state.shuffle = false;

 window.State.playTrack(
 track,
 false,
 sourceId,
 tracks
 );

 window.State.updateModeUI();
 }

 playAll(shuffle = false) {
 if (
 !this.currentArtist ||
 !window.State
 ) {
 return;
 }

 const tracks =
 this.getOrderedArtistTracks();

 if (tracks.length === 0) {
 return;
 }

 const sourceId =
 this.currentArtist.id ||
 `artist:${this.currentArtist.name}`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginArtist(
 sourceId
 );
 }

 window.state.shuffle =
 Boolean(shuffle);

 let startTrack =
 tracks[0];

 if (
 shuffle &&
 tracks.length > 1
 ) {
 startTrack =
 tracks[
 Math.floor(
 Math.random() *
 tracks.length
 )
 ];
 }

 window.State.playTrack(
 startTrack,
 false,
 sourceId,
 tracks
 );

 window.State.updateModeUI();
 }

 playAlbum(album) {
 if (
 !album ||
 !window.State
 ) {
 return;
 }

 const tracks =
 this._getAlbumOrderedTracks(
 album
 );

 if (tracks.length === 0) {
 return;
 }

 const sourceId =
 `album:${
 album.id ||
 album.key ||
 album.title ||
 'artist'
 }`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginAlbum(
 sourceId
 );
 }

 window.state.shuffle = false;

 window.State.playTrack(
 tracks[0],
 false,
 sourceId,
 tracks
 );

 window.State.updateModeUI();
 }

 syncPlayingState() {
 if (
 !this.isOpen ||
 !this.currentArtist
 ) {
 return;
 }

 const currentTrackId =
 window.state
 ?.currentTrackId ||
 null;

 const activeAlbum =
 this._getAlbumForTrackId(
 currentTrackId
 );

 const activeAlbumId =
 activeAlbum
 ? String(
 activeAlbum.id ||
 activeAlbum.key ||
 ''
 )
 : '';

 document
 .querySelectorAll(
 '#artist-albums-grid .artist-album-card'
 )
 .forEach(
 card => {
 card.classList.toggle(
 'playing',
 Boolean(
 activeAlbumId &&
 card.dataset.albumId ===
 activeAlbumId
 )
 );
 }
 );

 document
 .querySelectorAll(
 '#artist-tracklist-body .artist-track-row'
 )
 .forEach(
 row => {
 row.classList.toggle(
 'playing',
 Boolean(
 currentTrackId &&
 row.dataset.trackId ===
 currentTrackId
 )
 );
 }
 );
 }

 _bindSortControls() {
 const wrapper =
 document.getElementById(
 'artist-sort-wrapper'
 );

 const button =
 document.getElementById(
 'artist-btn-sort'
 );

 const menu =
 document.getElementById(
 'artist-sort-popup'
 );

 if (
 !wrapper ||
 !button ||
 !menu
 ) {
 return;
 }

 const hide =
 () => {
 menu.classList.add(
 'hidden'
 );

 button.classList.remove(
 'active'
 );

 if (this.sortTimer) {
 clearTimeout(
 this.sortTimer
 );

 this.sortTimer = null;
 }
 };

 const cancelTimer =
 () => {
 if (this.sortTimer) {
 clearTimeout(
 this.sortTimer
 );

 this.sortTimer = null;
 }
 };

 button.addEventListener(
 'click',
 e => {
 e.stopPropagation();
 cancelTimer();

 if (
 menu.classList.contains(
 'hidden'
 )
 ) {
 this.renderSortMenu();

 menu.classList.remove(
 'hidden'
 );

 button.classList.add(
 'active'
 );
 } else {
 hide();
 }
 }
 );

 menu.addEventListener(
 'click',
 e => {
 e.stopPropagation();
 }
 );

 wrapper.addEventListener(
 'mouseenter',
 cancelTimer
 );

 wrapper.addEventListener(
 'mouseleave',
 () => {
 cancelTimer();

 this.sortTimer =
 setTimeout(
 hide,
 350
 );
 }
 );

 document.addEventListener(
 'click',
 e => {
 if (
 !wrapper.contains(
 e.target
 )
 ) {
 hide();
 }
 }
 );
 }

 renderSortMenu() {
 const menu =
 document.getElementById(
 'artist-sort-popup'
 );

 if (!menu) {
 return;
 }

 menu.innerHTML = '';

 const header =
 document.createElement('div');

 header.className =
 'sort-menu-header';

 header.textContent =
 window.i18n?.t(
 'sort_by'
 ) ||
 'SORT BY';

 menu.appendChild(header);

 const options = [
 {
 id: 'year',
 key: 'sort_year',
 fallback: 'Release Year'
 },
 {
 id: 'title',
 key: 'sort_album',
 fallback: 'Album Title'
 },
 {
 id: 'tracksCount',
 key: 'sort_tracksCount',
 fallback: 'Tracks Count'
 }
 ];

 options.forEach(
 option => {
 const item =
 document.createElement('div');

 item.className =
 `sort-menu-item ${
 this.sortConfig.field ===
 option.id
 ? 'active'
 : ''
 }`;

 const label =
 window.i18n?.t(
 option.key
 ) ||
 option.fallback;

 item.innerHTML =
 `<span class="item-check"></span><span>${window.escapeHTML(label)}</span>`;

 item.addEventListener(
 'click',
 e => {
 e.stopPropagation();

 this.sortConfig.field =
 option.id;

 this.renderAlbumsPage();
 this.renderTracksPage();
 this.renderSortMenu();
 }
 );

 menu.appendChild(item);
 }
 );

 const divider =
 document.createElement('div');

 divider.className =
 'ctx-divider';

 menu.appendChild(divider);

 const orderHeader =
 document.createElement('div');

 orderHeader.className =
 'sort-menu-header';

 orderHeader.textContent =
 window.i18n?.t(
 'sort_order'
 ) ||
 'ORDER';

 menu.appendChild(
 orderHeader
 );

 [
 {
 id: 'asc',
 key: 'sort_asc',
 fallback: 'Ascending'
 },
 {
 id: 'desc',
 key: 'sort_desc',
 fallback: 'Descending'
 }
 ].forEach(
 option => {
 const item =
 document.createElement('div');

 item.className =
 `sort-menu-item ${
 this.sortConfig.order ===
 option.id
 ? 'active'
 : ''
 }`;

 const label =
 window.i18n?.t(
 option.key
 ) ||
 option.fallback;

 item.innerHTML =
 `<span class="item-check"></span><span>${window.escapeHTML(label)}</span>`;

 item.addEventListener(
 'click',
 e => {
 e.stopPropagation();

 this.sortConfig.order =
 option.id;

 this.renderAlbumsPage();
 this.renderTracksPage();
 this.renderSortMenu();
 }
 );

 menu.appendChild(item);
 }
 );
 }

 _resetArtistPalette() {
 if (!this.overlayEl) {
 return;
 }

 this.overlayEl.classList.remove(
 'artist-has-palette'
 );

 [
 '--artist-color-rgb',
 '--artist-accent',
 '--artist-accent-rgb',
 '--artist-accent-text',
 '--artist-panel',
 '--artist-panel-rgb',
 '--artist-ambient-rgb'
 ].forEach(
 property => {
 this.overlayEl.style
 .removeProperty(
 property
 );
 }
 );
 }

 async _applyArtistPalette(
 artist
 ) {
 const requestToken =
 ++this.paletteRequestToken;

 this._resetArtistPalette();

 if (
 !artist?.coverPath ||
 !window.CoverColor ||
 !this.overlayEl
 ) {
 return;
 }


 const mediaUrl =
 `media://${encodeURIComponent(artist.coverPath)}`;

 const palette =
 await window.CoverColor
 .extractPalette(
 mediaUrl
 );

 if (
 requestToken !==
 this.paletteRequestToken ||
 !this.isOpen ||
 !palette ||
 !this.overlayEl
 ) {
 return;
 }

 this.overlayEl.style
 .setProperty(
 '--artist-color-rgb',
 palette.dominantRgb
 );

 this.overlayEl.style
 .setProperty(
 '--artist-accent',
 palette.accent
 );

 this.overlayEl.style
 .setProperty(
 '--artist-accent-rgb',
 palette.accentRgb
 );

 this.overlayEl.style
 .setProperty(
 '--artist-accent-text',
 palette.accentText
 );

 this.overlayEl.style
 .setProperty(
 '--artist-panel',
 palette.panel
 );

 this.overlayEl.style
 .setProperty(
 '--artist-panel-rgb',
 palette.panelRgb
 );

 this.overlayEl.style
 .setProperty(
 '--artist-ambient-rgb',
 palette.ambientRgb
 );

 this.overlayEl.classList.add(
 'artist-has-palette'
 );
 }
}

window.ArtistView =
 new ArtistViewManager();

document.addEventListener(
 'DOMContentLoaded',
 () => {
 window.ArtistView.init();
 }
);

