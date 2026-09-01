/**
 * COSMIC PLAYER - ALBUM OVERLAY VIEW MANAGER
 * Жизненный цикл Album View, локальная палитра обложки,
 * album-order сортировка, поиск, очередь и воспроизведение.
 */
class AlbumViewManager {
 constructor() {
  this.isOpen = false;
  this.overlayEl = null;
  this.currentAlbumTracks = [];
  this.currentAlbumInfo = null;
  this.albumOrderContext = null;
  this.currentSort = { field: 'trackNumber', asc: true };
  this.activeSearchQuery = '';
  this.savedSearchQuery = '';
  this.sortTimer = null;
 this.paletteRequestToken = 0;
 this.closeAnimationTimer = null;
 this.savedLibraryScrollTop = 0;
 this.savedLibraryView = 'tracks';

 }

 init() {
  this.overlayEl = document.getElementById('album-overlay');

  document.getElementById('album-btn-back')?.addEventListener('click', () => this.close());

  document.getElementById('album-btn-play')?.addEventListener('click', () => {
   this.playAll(false);
  });

  document.getElementById('album-btn-shuffle')?.addEventListener('click', () => {
   this.playAll(true);
  });

  document.getElementById('album-btn-queue-next')?.addEventListener('click', () => {
   if (this.currentAlbumTracks.length > 0 && window.State) {
    window.State.addToQueueNext(this.getAlbumOrderTracks());
   }
  });

  document.getElementById('album-btn-queue-end')?.addEventListener('click', () => {
   if (this.currentAlbumTracks.length > 0 && window.State) {
    window.State.addToQueueEnd(this.getAlbumOrderTracks());
   }
  });

 document.getElementById('album-cover-box')?.addEventListener('click', (e) => {
 e.preventDefault();
 e.stopPropagation();

 const coverPath = this.currentAlbumInfo?.coverPath;

 if (
 !coverPath ||
 !window.AlbumCoverViewer
 ) {
 return;
 }

 window.AlbumCoverViewer.open(coverPath);
 });

 document.getElementById('album-find-cover-btn')?.addEventListener('click', async (e) => {
 e.stopPropagation();

 if (
  !this.currentAlbumInfo ||
  !Array.isArray(this.currentAlbumTracks) ||
  this.currentAlbumTracks.length === 0 ||
  !window.api?.batch?.downloadAlbumCover
 ) {
  return;
 }

 const button = e.currentTarget;
 const trackIds = this.currentAlbumTracks
  .map(track => track?.id)
  .filter(Boolean);

 if (trackIds.length === 0) return;

 button.disabled = true;

 const result = await window.api.batch.downloadAlbumCover(trackIds);

 if (!result?.success || !result.coverPath) {
  button.disabled = false;

  if (window.Toast) {
   window.Toast.warn(
    window.i18n?.t('album_cover_not_found') ||
    'Cover not found'
   );
  }

  return;
 }

 window.state.library = result.updatedLibrary || window.state.library;

 this.currentAlbumTracks = this.currentAlbumTracks.map(track => {
  const updatedTrack = window.state.library.find(item => item.id === track.id);
  return updatedTrack || {
   ...track,
   coverPath: result.coverPath
  };
 });

 this.currentAlbumInfo.tracks = [...this.currentAlbumTracks];
 this.currentAlbumInfo.coverPath = result.coverPath;

 this.renderLeftMeta(this.currentAlbumInfo);
 await this._applyAlbumPalette(this.currentAlbumInfo);

 if (window.LibraryViews?.currentView === 'albums') {
  window.LibraryViews.renderGrid('albums');
 }

 if (window.Toast) {
  window.Toast.success(
   window.i18n?.t('album_cover_found') ||
   'Cover downloaded'
  );
 }
 });

  this._bindSortControls();
 }

 _bindSortControls() {
  const wrapper = document.getElementById('album-sort-wrapper');
  const btnSort = document.getElementById('album-btn-sort');
  const menu = document.getElementById('album-sort-popup');

  if (!wrapper || !btnSort || !menu) return;

  const hideMenu = () => {
   menu.classList.add('hidden');
   btnSort.classList.remove('active');

   if (this.sortTimer) {
    clearTimeout(this.sortTimer);
    this.sortTimer = null;
   }
  };

  const startCloseTimer = () => {
   if (this.sortTimer) clearTimeout(this.sortTimer);

   this.sortTimer = setTimeout(() => {
    hideMenu();
   }, 350);
  };

  const cancelCloseTimer = () => {
   if (this.sortTimer) {
    clearTimeout(this.sortTimer);
    this.sortTimer = null;
   }
  };

  btnSort.addEventListener('click', (e) => {
   e.stopPropagation();
   cancelCloseTimer();

   const isHidden = menu.classList.contains('hidden');

   if (isHidden) {
    this.renderSortMenu();
    menu.classList.remove('hidden');
    btnSort.classList.add('active');
   } else {
    hideMenu();
   }
  });

  menu.addEventListener('click', (e) => {
   e.stopPropagation();
  });

  wrapper.addEventListener('mouseleave', () => {
   if (!menu.classList.contains('hidden')) {
    startCloseTimer();
   }
  });

  wrapper.addEventListener('mouseenter', () => {
   cancelCloseTimer();
  });

  document.addEventListener('click', (e) => {
   if (!wrapper.contains(e.target)) {
    hideMenu();
   }
  });
 }

 renderSortMenu() {
  const menu = document.getElementById('album-sort-popup');
  if (!menu) return;

  menu.innerHTML = '';

  const options = [
   {
    id: 'trackNumber',
    label: window.i18n?.t('sort_trackNumber') || 'Track Number'
   },
   {
    id: 'title',
    label: window.i18n?.t('sort_title') || 'Track Title'
   },
   {
    id: 'date',
    label: window.i18n?.t('sort_date') || 'Date Added'
   },
   {
    id: 'duration',
    label: window.i18n?.t('sort_duration') || 'Duration'
   }
  ];

  const sortHeader = document.createElement('div');
  sortHeader.className = 'sort-menu-header';
  sortHeader.textContent = window.i18n?.t('sort_by') || 'SORT BY';
  menu.appendChild(sortHeader);

  options.forEach((option) => {
   const item = document.createElement('div');
   const isActive = this.currentSort.field === option.id;

   item.className = `sort-menu-item ${isActive ? 'active' : ''}`;
   item.innerHTML = `<span class="item-check"></span><span>${window.escapeHTML(option.label)}</span>`;

   item.addEventListener('click', (e) => {
    e.stopPropagation();
    this.currentSort.field = option.id;
    this.renderTracklist();
    this.renderSortMenu();
   });

   menu.appendChild(item);
  });

  const divider = document.createElement('div');
  divider.className = 'ctx-divider';
  menu.appendChild(divider);

  const orderHeader = document.createElement('div');
  orderHeader.className = 'sort-menu-header';
  orderHeader.textContent = window.i18n?.t('sort_order') || 'ORDER';
  menu.appendChild(orderHeader);

  const orders = [
   {
    id: true,
    label: window.i18n?.t('sort_asc') || 'Ascending'
   },
   {
    id: false,
    label: window.i18n?.t('sort_desc') || 'Descending'
   }
  ];

  orders.forEach((option) => {
   const item = document.createElement('div');
   const isActive = this.currentSort.asc === option.id;

   item.className = `sort-menu-item ${isActive ? 'active' : ''}`;
   item.innerHTML = `<span class="item-check"></span><span>${window.escapeHTML(option.label)}</span>`;

   item.addEventListener('click', (e) => {
    e.stopPropagation();
    this.currentSort.asc = option.id;
    this.renderTracklist();
    this.renderSortMenu();
   });

   menu.appendChild(item);
  });
 }

 _resetAlbumPalette() {
  if (!this.overlayEl) return;

  this.overlayEl.style.removeProperty('--album-color');
  this.overlayEl.style.removeProperty('--album-color-rgb');
  this.overlayEl.style.removeProperty('--album-panel');
  this.overlayEl.style.removeProperty('--album-panel-rgb');
  this.overlayEl.style.removeProperty('--album-accent');
  this.overlayEl.style.removeProperty('--album-accent-rgb');
 this.overlayEl.style.removeProperty('--album-accent-text');
 this.overlayEl.style.removeProperty('--album-ambient-rgb');
 this.overlayEl.style.removeProperty('--album-ambient');
  this.overlayEl.classList.remove('album-has-cover-palette');
 }

 async _applyAlbumPalette(albumObj) {
  const requestToken = ++this.paletteRequestToken;

  this._resetAlbumPalette();

  if (!albumObj?.coverPath || !window.CoverColor) {
   return;
  }

  const coverUrl = `media://${encodeURIComponent(albumObj.coverPath)}`;
  const palette = await window.CoverColor.extractPalette(coverUrl);

  if (
   requestToken !== this.paletteRequestToken ||
   !this.isOpen ||
   !this.overlayEl ||
   !palette
  ) {
   return;
  }

  this.overlayEl.style.setProperty(
   '--album-color',
   palette.dominant
  );

  this.overlayEl.style.setProperty(
   '--album-color-rgb',
   palette.dominantRgb
  );

  this.overlayEl.style.setProperty(
   '--album-panel',
   palette.panel
  );

  this.overlayEl.style.setProperty(
   '--album-panel-rgb',
   palette.panelRgb
  );

  this.overlayEl.style.setProperty(
   '--album-accent',
   palette.accent
  );

  this.overlayEl.style.setProperty(
   '--album-accent-rgb',
   palette.accentRgb
  );

 this.overlayEl.style.setProperty(
 '--album-accent-text',
 palette.accentText
 );
 this.overlayEl.style.setProperty(
 '--album-ambient-rgb',
 palette.ambientRgb
 );
 this.overlayEl.style.setProperty(
 '--album-ambient',
 palette.ambient
 );
 this.overlayEl.classList.add('album-has-cover-palette');
 }

 async openAlbum(albumObj, navigationSource = null) {
 if (!this.overlayEl) {
  this.init();
 }

 if (
  !albumObj ||
  !Array.isArray(albumObj.tracks) ||
  albumObj.tracks.length === 0
 ) {
  return;
 }

 const previousSearchState = window.NavigationHistory
  ? window.NavigationHistory.captureSearchState()
  : {
   query: window.Search?.inputEl?.value || '',
   placeholder:
    window.Search?.inputEl?.getAttribute('placeholder') ||
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
    searchState: previousSearchState,
    libraryView: window.LibraryViews?.currentView || 'tracks',
    libraryScrollTop:
     document.getElementById('library-grid-view')?.scrollTop || 0
   }
  );
 }

 this.currentAlbumInfo = albumObj;
 this.currentAlbumTracks = [...albumObj.tracks];
 this.albumOrderContext = window.AlbumOrder
 ? window.AlbumOrder.createContext(this.currentAlbumTracks)
 : null;
 this.currentSort = {
 field: 'trackNumber',
 asc: true
 };
 this.activeSearchQuery = '';
 const gridView = document.getElementById('library-grid-view');
 this.savedLibraryScrollTop = gridView ? gridView.scrollTop : 0;
 this.savedLibraryView = window.LibraryViews?.currentView || 'tracks';
 if (window.Search?.inputEl) {
 this.savedSearchQuery = previousSearchState.query || '';
 window.Search.inputEl.value = '';
 window.Search._toggleClearButton(false);
 window.Search.hideHistoryDropdown();
 }
 this.isOpen = true;
 if (window.Search) {
 window.Search.syncContext();
 }

 this.isOpen = true;

 if (this.closeAnimationTimer) {
  clearTimeout(this.closeAnimationTimer);
  this.closeAnimationTimer = null;
 }

 this.overlayEl.classList.remove('album-open');
 this.overlayEl.classList.remove('album-closing');
 this.overlayEl.classList.add('album-opening');
 this.overlayEl.classList.remove('hidden');

 this.renderLeftMeta(albumObj);
 this.renderTracklist();

 requestAnimationFrame(() => {
  requestAnimationFrame(() => {
   if (!this.isOpen || !this.overlayEl) return;
   this.overlayEl.classList.remove('album-opening');
   this.overlayEl.classList.add('album-open');
  });
 });

 await this._applyAlbumPalette(albumObj);
 }

 close(options = {}) {
 if (!this.isOpen) return;

 const restoreSearch = options.restoreSearch !== false;
 const fromNavigation = options.fromNavigation === true;

 this.isOpen = false;
 this.paletteRequestToken++;
 this.activeSearchQuery = '';

 if (this.closeAnimationTimer) {
  clearTimeout(this.closeAnimationTimer);
  this.closeAnimationTimer = null;
 }

 if (restoreSearch && window.Search?.inputEl) {
 const restoredQuery = this.savedSearchQuery || '';
 window.Search.syncContext();
 window.Search.inputEl.value = restoredQuery;
 window.Search._toggleClearButton(restoredQuery.length > 0);
 window.Search.hideHistoryDropdown();
 if (window.Search.executeSearch) {
 window.Search.executeSearch(restoredQuery);
 }
 }

 if (
  !fromNavigation &&
  window.NavigationHistory?.canGoBack()
 ) {
  window.NavigationHistory.pop();
 }

 if (!this.overlayEl) {
  this._resetAlbumPalette();
  return;
 }

 this.overlayEl.classList.remove('album-opening');
 this.overlayEl.classList.remove('album-open');
 this.overlayEl.classList.add('album-closing');

 this.closeAnimationTimer = setTimeout(() => {
  if (this.isOpen || !this.overlayEl) {
   this.closeAnimationTimer = null;
   return;
  }

  this.overlayEl.classList.add('hidden');
  this.overlayEl.classList.remove('album-closing');
  this._resetAlbumPalette();

  const gridView = document.getElementById('library-grid-view');

  if (
   gridView &&
   this.savedLibraryView !== 'tracks'
  ) {
   gridView.scrollTop = this.savedLibraryScrollTop;
  }

  this.closeAnimationTimer = null;
 }, 160);
 }

 _formatTracksCount(count) {
  const lang = window.i18n?.currentLang || 'en';

  if (lang !== 'ru') {
   return `${count} ${count === 1 ? 'track' : 'tracks'}`;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
   return `${count} трек`;
  }

  if (
   [2, 3, 4].includes(mod10) &&
   ![12, 13, 14].includes(mod100)
  ) {
   return `${count} трека`;
  }

  return `${count} треков`;
 }

 _getTrackFilename(track) {
  if (!track?.path) return '';

  const normalized = track.path.replace(/\\/g, '/');
  const fileName = normalized.substring(normalized.lastIndexOf('/') + 1);

  return fileName.replace(/\.[^.]+$/, '');
 }

 _getDisplayTitle(track) {
  const title = String(track?.title || '').trim();

  if (
   title &&
   title.toLowerCase() !== 'unknown track' &&
   title.toLowerCase() !== 'unknown title'
  ) {
   return title;
  }

  const filename = this._getTrackFilename(track);

  if (filename) {
   return filename;
  }

  return window.i18n?.t('unknown_track') || 'Unknown Track';
 }

 _getDisplayArtist(track) {
  const artist = String(track?.artist || '').trim();

  if (artist) {
   return artist;
  }

  return window.i18n?.t('tray_unknown_artist') || 'Unknown Artist';
 }

 _getUniformValue(field) {
  if (this.currentAlbumTracks.length === 0) {
   return null;
  }

  const values = this.currentAlbumTracks.map((track) => {
   const value = track?.[field];

   if (
    value === null ||
    value === undefined ||
    value === ''
   ) {
    return null;
   }

   return value;
  });

  if (values.some((value) => value === null)) {
   return null;
  }

  const firstValue = String(values[0]).toLowerCase();

  const allSame = values.every(
   (value) => String(value).toLowerCase() === firstValue
  );

  return allSame ? values[0] : null;
 }

 _getAlbumGenreText() {
  const genres = new Set();

  this.currentAlbumTracks.forEach((track) => {
   const raw = String(track?.genre || '').trim();

   if (!raw) return;

   raw
    .split(/[,;/|]+/)
    .map((genre) => genre.trim())
    .filter(Boolean)
    .forEach((genre) => genres.add(genre));
  });

  if (genres.size === 0) {
   return '';
  }

  return Array.from(genres)
   .slice(0, 2)
   .map((genre) => (
    genre.charAt(0).toUpperCase() + genre.slice(1)
   ))
   .join(' · ');
 }

 _getTechnicalMetadataText() {
  const codec = this._getUniformValue('codec');
  const container = this._getUniformValue('container');
  const bitsPerSample = this._getUniformValue('bitsPerSample');
  const sampleRate = this._getUniformValue('sampleRate');

  const parts = [];

  const formatValue = codec || container;

  if (formatValue) {
   parts.push(String(formatValue).toUpperCase());
  }

  if (bitsPerSample) {
   parts.push(`${bitsPerSample}-bit`);
  }

  if (sampleRate) {
   const khz = Number(sampleRate) / 1000;

   if (Number.isFinite(khz) && khz > 0) {
    const formattedKhz = Number.isInteger(khz)
     ? String(khz)
     : khz.toFixed(1).replace(/\.0$/, '');

    parts.push(`${formattedKhz} kHz`);
   }
  }

  return parts.join(' · ');
 }

 renderLeftMeta(albumObj) {
  const coverBox = document.getElementById('album-cover-box');
  const titleEl = document.getElementById('album-meta-title');
  const artistEl = document.getElementById('album-meta-artist');
  const line1 = document.getElementById('album-meta-line1');
  const line2 = document.getElementById('album-meta-line2');
  const line3 = document.getElementById('album-meta-line3');

 const findCoverBtn = document.getElementById('album-find-cover-btn');

 if (findCoverBtn) {
 findCoverBtn.classList.toggle('hidden', Boolean(albumObj.coverPath));
 findCoverBtn.disabled = false;
 }

  if (coverBox) {
   if (albumObj.coverPath) {
    coverBox.className = 'album-cover-box';
    coverBox.style.backgroundImage =
     `url("media://${encodeURIComponent(albumObj.coverPath)}")`;
    coverBox.innerHTML = '';
   } else {
    coverBox.className = 'album-cover-box default-cover';
    coverBox.style.backgroundImage = 'none';
    coverBox.innerHTML = `
     <svg class="icon icon-lg" viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
     </svg>
    `;
   }
  }

  if (titleEl) {
   titleEl.textContent =
    albumObj.title ||
    'Unknown Album';
  }

  if (artistEl) {
   artistEl.textContent =
    albumObj.albumArtist ||
    albumObj.artist ||
    this._getDisplayArtist(this.currentAlbumTracks[0]);
  }

  const year =
   albumObj.year ||
   this._getUniformValue('year') ||
   '';

  const genreText = this._getAlbumGenreText();
  const metadataParts = [];

  if (year) {
   metadataParts.push(String(year));
  }

  if (genreText) {
   metadataParts.push(genreText);
  }

  if (line1) {
   line1.textContent = metadataParts.join(' · ');
  }

  const totalSeconds = this.currentAlbumTracks.reduce(
   (sum, track) => sum + (Number(track.duration) || 0),
   0
  );

  if (line2) {
   const parts = [
    this._formatTracksCount(this.currentAlbumTracks.length)
   ];

   if (totalSeconds > 0) {
    parts.push(window.formatTime(totalSeconds));
   }

   line2.textContent = parts.join(' · ');
  }

  if (line3) {
   const technicalText = this._getTechnicalMetadataText();
   line3.textContent = technicalText;
   line3.style.display = technicalText ? '' : 'none';
  }
 }

 _compareAlbumOrder(a, b) {
 if (window.AlbumOrder) {
 return window.AlbumOrder.compare(
  a,
  b,
  this.albumOrderContext,
  (track) => this._getDisplayTitle(track),
  (track) => this._getTrackFilename(track)
 );
 }

 const discA = Number(a?.discNumber) > 0
  ? Number(a.discNumber)
  : 1;
 const discB = Number(b?.discNumber) > 0
  ? Number(b.discNumber)
  : 1;

 if (discA !== discB) {
  return discA - discB;
 }

 const trackNumberA = Number(a?.trackNumber);
 const trackNumberB = Number(b?.trackNumber);
 const hasTrackA = Number.isFinite(trackNumberA) && trackNumberA > 0;
 const hasTrackB = Number.isFinite(trackNumberB) && trackNumberB > 0;

 if (
  hasTrackA &&
  hasTrackB &&
  trackNumberA !== trackNumberB
 ) {
  return trackNumberA - trackNumberB;
 }

 const titleA = this._getDisplayTitle(a);
 const titleB = this._getDisplayTitle(b);

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

 return this._getTrackFilename(a).localeCompare(
  this._getTrackFilename(b),
  undefined,
  {
   numeric: true,
   sensitivity: 'base'
  }
 );
 }

 getAlbumOrderTracks() {
  return [...this.currentAlbumTracks].sort(
   (a, b) => this._compareAlbumOrder(a, b)
  );
 }

 _filterTracks(list) {
  const query = String(this.activeSearchQuery || '')
   .trim()
   .toLowerCase();

  if (!query) {
   return list;
  }

  const convertedQuery = window.convertKeyboardLayout
   ? window.convertKeyboardLayout(query).toLowerCase()
   : '';

  const phoneticQuery = window.phoneticTranslit
   ? window.phoneticTranslit(query).toLowerCase()
   : '';

  const hypotheses = [
   query,
   convertedQuery,
   phoneticQuery
  ].filter((value, index, array) => (
   value &&
   array.indexOf(value) === index
  ));

  return list.filter((track) => {
   const title = this._getDisplayTitle(track).toLowerCase();
   const artist = this._getDisplayArtist(track).toLowerCase();
   const filename = this._getTrackFilename(track).toLowerCase();

   const combined = `${title} ${artist} ${filename}`;

   for (const hypothesis of hypotheses) {
    if (
     title.includes(hypothesis) ||
     artist.includes(hypothesis) ||
     filename.includes(hypothesis) ||
     combined.includes(hypothesis)
    ) {
     return true;
    }

    if (window.fuzzyMatch) {
     const titleMatch = window.fuzzyMatch(title, hypothesis);
     const artistMatch = window.fuzzyMatch(artist, hypothesis);
     const filenameMatch = window.fuzzyMatch(filename, hypothesis);

     if (
      titleMatch.match ||
      artistMatch.match ||
      filenameMatch.match
     ) {
      return true;
     }
    }
   }

   return false;
  });
 }

 getSortedTracks() {
  let list = this._filterTracks(
   [...this.currentAlbumTracks]
  );

  const multiplier = this.currentSort.asc ? 1 : -1;

  if (this.currentSort.field === 'trackNumber') {
   list.sort((a, b) => (
    this._compareAlbumOrder(a, b) * multiplier
   ));

   return list;
  }

  list.sort((a, b) => {
   const discA = Number(a?.discNumber) > 0
    ? Number(a.discNumber)
    : 1;

   const discB = Number(b?.discNumber) > 0
    ? Number(b.discNumber)
    : 1;

   if (discA !== discB) {
    return (discA - discB) * multiplier;
   }

   if (this.currentSort.field === 'title') {
    return this._getDisplayTitle(a).localeCompare(
     this._getDisplayTitle(b),
     undefined,
     {
      numeric: true,
      sensitivity: 'base'
     }
    ) * multiplier;
   }

   if (this.currentSort.field === 'date') {
    const valueA = Number(a?.addedAt) || 0;
    const valueB = Number(b?.addedAt) || 0;

    if (valueA !== valueB) {
     return (valueA - valueB) * multiplier;
    }
   }

   if (this.currentSort.field === 'duration') {
    const valueA = Number(a?.duration) || 0;
    const valueB = Number(b?.duration) || 0;

    if (valueA !== valueB) {
     return (valueA - valueB) * multiplier;
    }
   }

   return this._compareAlbumOrder(a, b);
  });

  return list;
 }

 _hasMultipleDiscs(tracks) {
 if (this.albumOrderContext) {
  return Boolean(this.albumOrderContext.hasMultipleDiscs);
 }

 const discs = new Set();

 tracks.forEach((track) => {
  const disc = Number(track?.discNumber) > 0
   ? Number(track.discNumber)
   : 1;
  discs.add(disc);
 });

 const explicitMultiDisc = tracks.some(
  (track) => Number(track?.discTotal) > 1
 );

 return explicitMultiDisc || discs.size > 1;
 }

 renderTracklist() {
  const body = document.getElementById('album-tracklist-body');
  if (!body) return;

  body.innerHTML = '';

  const sortedTracks = this.getSortedTracks();
  const hasMultipleDiscs = this._hasMultipleDiscs(sortedTracks);
  let currentDisc = null;

  sortedTracks.forEach((track, index) => {
 const resolvedOrder = window.AlbumOrder
 ? window.AlbumOrder.getResolvedTrackData(
  track,
  this.albumOrderContext
 )
 : null;

 const discNumber = resolvedOrder
 ? resolvedOrder.discNumber
 : (
  Number(track?.discNumber) > 0
   ? Number(track.discNumber)
   : 1
 );

   if (
    hasMultipleDiscs &&
    discNumber !== currentDisc
   ) {
    currentDisc = discNumber;

    const divider = document.createElement('div');
    divider.className = 'album-disc-divider';

    const template =
     window.i18n?.t('album_disc') ||
     'DISC {number}';

    divider.textContent = template.replace(
     '{number}',
     String(currentDisc)
    );

    body.appendChild(divider);
   }

   const row = document.createElement('div');
   const isPlaying =
    track.id === window.state?.currentTrackId;

 row.className =
 `album-track-row ${isPlaying ? 'playing' : ''}`;
 row.dataset.trackId = track.id || '';
 const resolvedTrackNumber = resolvedOrder?.trackNumber ?? null;
 const embeddedTrackNumber = Number(track?.trackNumber);

 const trackNumber = resolvedTrackNumber !== null
  ? resolvedTrackNumber
  : (
   Number.isFinite(embeddedTrackNumber) && embeddedTrackNumber > 0
    ? embeddedTrackNumber
    : null
  );

 const numberText = trackNumber !== null
  ? String(trackNumber).padStart(2, '0')
  : String(index + 1);

   const durationText =
    window.formatTime
     ? window.formatTime(track.duration)
     : '0:00';

   row.innerHTML = `
    <div class="col-index">${window.escapeHTML(numberText)}</div>
    <div class="col-title">${window.escapeHTML(this._getDisplayTitle(track))}</div>
    <div class="col-artist">${window.escapeHTML(this._getDisplayArtist(track))}</div>
    <div class="col-time">${window.escapeHTML(durationText)}</div>
   `;

 row.addEventListener('click', () => {
 if (!window.State) return;

 const albumPlaybackList =
 this.getAlbumOrderTracks();

 const startIndex =
 albumPlaybackList.findIndex(
 albumTrack =>
 albumTrack.id === track.id
 );

 if (startIndex === -1) return;

 const sourceId =
 `album:${this.currentAlbumInfo?.id || this.currentAlbumInfo?.key || this.currentAlbumInfo?.title || 'view'}`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginAlbum(
 sourceId
 );
 }

 window.State.playTrack(
 track,
 false,
 sourceId,
 albumPlaybackList
 );
 });

   row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.ContextMenu) {
     window.ContextMenu.showTrackMenu(
      e,
      track,
      this.getAlbumOrderTracks()
     );
    }
   });

   body.appendChild(row);
  });
 }

 syncPlayingState() {
  if (!this.isOpen) return;

  const body = document.getElementById('album-tracklist-body');
  if (!body) return;

  const currentTrackId = window.state?.currentTrackId || null;

  body.querySelectorAll('.album-track-row').forEach((row) => {
   const rowTrackId = row.dataset.trackId || null;
   row.classList.toggle(
    'playing',
    Boolean(currentTrackId && rowTrackId === currentTrackId)
   );
  });
 }

 playAll(shuffle = false) {
 const tracks =
 this.getAlbumOrderTracks();

 if (
 tracks.length === 0 ||
 !window.State
 ) {
 return;
 }

 const sourceId =
 `album:${this.currentAlbumInfo?.id || this.currentAlbumInfo?.key || this.currentAlbumInfo?.title || 'view'}`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginAlbum(
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
 const randomIndex =
 Math.floor(
 Math.random() * tracks.length
 );

 startTrack =
 tracks[randomIndex];
 }

 window.State.playTrack(
 startTrack,
 false,
 sourceId,
 tracks
 );

 window.State.updateModeUI();
 }

 filterTracks(query) {
  this.activeSearchQuery = query || '';
  this.renderTracklist();
 }
}

window.AlbumView = new AlbumViewManager();