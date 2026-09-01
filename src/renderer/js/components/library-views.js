/**
 * COSMIC PLAYER - LIBRARY VIEWS ENGINE (TRACKS, ALBUMS, ARTISTS, FOLDERS)
 * Модуль управления видами библиотеки, сортировкой и сеткой обложек
 */
class LibraryViewsManager {
  constructor() {
    this.currentView = 'tracks'; // 'tracks', 'albums', 'artists', 'folders'
    this.sortConfig = {
      tracks: { field: 'addedAt', order: 'asc' },
      albums: { field: 'title', order: 'asc' },
      artists: { field: 'name', order: 'asc' },
      folders: { field: 'name', order: 'asc' }
    };
    this.sortTimer = null;
    this.gracePeriod = 350; // Задержка увода мыши (350мс)
  }

  init() {
    const tabs = document.querySelectorAll('.library-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.dataset.view || 'tracks';
        this.switchView(view, null);
      });
    });
    this._bindSortControls();
  }

  _bindSortControls() {
    const wrapper = document.getElementById('sort-dropdown-wrapper');
    const btnToggle = document.getElementById('btn-sort-toggle');
    const menu = document.getElementById('sort-popup-menu');
    if (!wrapper || !btnToggle || !menu) return;

    const hideMenu = () => {
      menu.classList.add('hidden');
      btnToggle.classList.remove('active');
      if (this.sortTimer) {
        clearTimeout(this.sortTimer);
        this.sortTimer = null;
      }
    };

    const startCloseTimer = () => {
      if (this.sortTimer) clearTimeout(this.sortTimer);
      this.sortTimer = setTimeout(() => hideMenu(), this.gracePeriod);
    };

    const cancelCloseTimer = () => {
      if (this.sortTimer) {
        clearTimeout(this.sortTimer);
        this.sortTimer = null;
      }
    };

    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCloseTimer();
      const isHidden = menu.classList.contains('hidden');
      if (isHidden) {
        this._renderSortMenu();
        menu.classList.remove('hidden');
        btnToggle.classList.add('active');
      } else {
        hideMenu();
      }
    });

    // Предотвращаем закрытие меню при кликах внутри
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Увод курсора скрывает меню с задержкой
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

  _getSortFieldOptions(view) {
    if (view === 'albums') {
      return [
        { id: 'title', label: 'Album Title' },
        { id: 'artist', label: 'Artist Name' },
        { id: 'year', label: 'Release Year' },
        { id: 'tracksCount', label: 'Tracks Count' }
      ];
    } else if (view === 'artists') {
      return [
        { id: 'artist', label: 'Artist Name' },
        { id: 'tracksCount', label: 'Tracks Count' }
      ];
    } else if (view === 'folders') {
      return [
        { id: 'folder', label: 'Folder Name' },
        { id: 'tracksCount', label: 'Tracks Count' }
      ];
    }
    // tracks
    return [
      { id: 'date', label: 'Date Added' },
      { id: 'title', label: 'Track Title' },
      { id: 'artist', label: 'Artist Name' },
      { id: 'album', label: 'Album Title' },
      { id: 'duration', label: 'Duration' }
    ];
  }

  _renderSortMenu() {
    const menu = document.getElementById('sort-popup-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const cfg = this.sortConfig[this.currentView] || { field: 'name', order: 'asc' };
    const fieldOpts = this._getSortFieldOptions(this.currentView);
    // 1. Заголовок "СОРТИРОВАТЬ ПО"
    const h1 = document.createElement('div');
    h1.className = 'sort-menu-header';
    h1.textContent = window.i18n?.t('sort_by') || 'СОРТИРОВАТЬ ПО';
    menu.appendChild(h1);
    // 2. Список полей
    fieldOpts.forEach(opt => {
      const item = document.createElement('div');
      const isActive = cfg.field === opt.id;
      item.className = `sort-menu-item ${isActive ? 'active' : ''}`;
      const translatedLabel = window.i18n?.t(`sort_${opt.id}`) || opt.label;
      item.innerHTML = `<span class="item-check">✓</span><span>${translatedLabel}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        cfg.field = opt.id;
        if (this.currentView === 'tracks' && window.sortConfig) {
          window.sortConfig.field = opt.id;
        }
        this.switchView(this.currentView, null);
        this._renderSortMenu();
      });
      menu.appendChild(item);
    });
    // 3. Разделитель
    const divider = document.createElement('div');
    divider.className = 'ctx-divider';
    menu.appendChild(divider);
    // 4. Заголовок "ПОРЯДОК"
    const h2 = document.createElement('div');
    h2.className = 'sort-menu-header';
    h2.textContent = window.i18n?.t('sort_order') || 'ПОРЯДОК';
    menu.appendChild(h2);
    // 5. Переключатели порядка
    const orderOpts = [
      { id: 'asc', label: window.i18n?.t('sort_asc') || 'По возрастанию' },
      { id: 'desc', label: window.i18n?.t('sort_desc') || 'По убыванию' }
    ];

    orderOpts.forEach(opt => {
      const item = document.createElement('div');
      const isActive = cfg.order === opt.id;
      item.className = `sort-menu-item ${isActive ? 'active' : ''}`;
      item.innerHTML = `<span class="item-check">✓</span><span>${opt.label}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        cfg.order = opt.id;
        if (this.currentView === 'tracks' && window.sortConfig) {
          window.sortConfig.asc = opt.id === 'asc';
        }
        this.switchView(this.currentView, null);
        this._renderSortMenu(); // Обновление активного состояния без закрытия меню
      });
      menu.appendChild(item);
    });
  }

  updateHeaderInfo(count = 0) {
    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');
    const searchQuery = window.Search?.inputEl?.value?.trim() || '';
    const isSearching = searchQuery.length > 0;
    const cfg = this.sortConfig[this.currentView] || { field: 'name', order: 'asc' };
    const opts = this._getSortFieldOptions(this.currentView);
    const activeOpt = opts.find(o => o.id === cfg.field) || opts[0];
    const orderLabel = cfg.order === 'asc'
      ? (window.i18n?.t('sort_asc') || 'по возрастанию')
      : (window.i18n?.t('sort_desc') || 'по убыванию');
    const sortedByStr = window.i18n?.t('sorted_by') || 'Отсортировано по';
    const foundByStr = window.i18n?.t('found_by_query') || 'Найдено по запросу';
    const activeOptLabel = window.i18n?.t(`sort_${activeOpt.id}`) || activeOpt.label;
    const lang = window.i18n?.currentLang || 'en';

    const getPluralStr = (cnt, singularKey, pluralKey, ruOne, ruFew, ruMany) => {
      if (lang === 'ru') {
        let word = ruMany;
        if (cnt % 10 === 1 && cnt % 100 !== 11) word = ruOne;
        else if ([2, 3, 4].includes(cnt % 10) && ![12, 13, 14].includes(cnt % 100)) word = ruFew;
        return `${cnt} ${word}`;
      }
      const itemLabel = cnt === 1 
        ? (window.i18n?.t(singularKey) || 'item') 
        : (window.i18n?.t(pluralKey) || 'items');
      return `${cnt} ${itemLabel}`;
    };

    if (this.currentView === 'tracks') {
      if (titleEl) {
        if (window.state.activeNav === 'library') {
          titleEl.textContent = window.i18n?.t('nav_library') || 'Моя Музыка';
        } else if (window.state.activeNav === 'queue') {
          titleEl.textContent = window.i18n?.t('nav_queue') || 'Очередь';
        } else if (window.state.playlists) {
          const pl = window.state.playlists.find(p => p.id === window.state.activeNav);
          if (pl) titleEl.textContent = pl.name;
        }
      }
      if (subtitleEl) {
        const countStr = getPluralStr(count, 'col_track', 'tab_tracks', 'трек', 'трека', 'треков');
        subtitleEl.textContent = isSearching
          ? `${countStr} • ${foundByStr} "${searchQuery}"`
          : `${countStr} • ${sortedByStr} ${activeOptLabel.toLowerCase()} (${orderLabel.toLowerCase()})`;
      }
    } else if (this.currentView === 'albums') {
      if (titleEl) titleEl.textContent = window.i18n?.t('tab_albums') || 'Альбомы';
      if (subtitleEl) {
        const countStr = getPluralStr(count, 'tab_albums', 'tab_albums', 'альбом', 'альбома', 'альбомов');
        subtitleEl.textContent = isSearching
          ? `${countStr} • ${foundByStr} "${searchQuery}"`
          : `${countStr} • ${sortedByStr} ${activeOptLabel.toLowerCase()} (${orderLabel.toLowerCase()})`;
      }
    } else if (this.currentView === 'artists') {
      if (titleEl) titleEl.textContent = window.i18n?.t('tab_artists') || 'Артисты';
      if (subtitleEl) {
        const countStr = getPluralStr(count, 'col_artist', 'tab_artists', 'артист', 'артиста', 'артистов');
        subtitleEl.textContent = isSearching
          ? `${countStr} • ${foundByStr} "${searchQuery}"`
          : `${countStr} • ${sortedByStr} ${activeOptLabel.toLowerCase()} (${orderLabel.toLowerCase()})`;
      }
    } else if (this.currentView === 'folders') {
      if (titleEl) titleEl.textContent = window.i18n?.t('tab_folders') || 'Папки';
      if (subtitleEl) {
        const countStr = getPluralStr(count, 'tab_folders', 'tab_folders', 'папка', 'папки', 'папок');
        subtitleEl.textContent = isSearching
          ? `${countStr} • ${foundByStr} "${searchQuery}"`
          : `${countStr} • ${sortedByStr} ${activeOptLabel.toLowerCase()} (${orderLabel.toLowerCase()})`;
      }
    }
  }

 switchView(view = 'tracks', customList = null) {
 this.currentView = view;
 if (window.Search) {
 window.Search.syncContext();
 }
    const tracklistView = document.getElementById('tracklist-view');
    const gridView = document.getElementById('library-grid-view');
    if (!tracklistView || !gridView) return;

    document.querySelectorAll('.library-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === (customList ? 'tracks' : view));
    });

    if (view === 'tracks') {
      gridView.classList.add('hidden');
      tracklistView.classList.remove('hidden');
      if (customList && Array.isArray(customList)) {
        window.state.currentList = [...customList];
      } else {
        let baseList = window.state.library;
        if (window.state.activeNav === 'queue') {
          baseList = window.state.queue;
        } else if (window.state.activeNav !== 'library' && window.Playlists) {
          baseList = window.Playlists.getPlaylistTracks(window.state.activeNav) || [];
        }
        window.state.currentList = [...baseList];
      }

      const cfg = this.sortConfig.tracks;
      if (cfg && cfg.field) {
        window.state.currentList.sort((a, b) => {
          let valA = a[cfg.field] ?? '';
          let valB = b[cfg.field] ?? '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
          if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const body = document.getElementById('tracklist-body');
      if (body) body.scrollTop = 0;
      if (window.Tracklist) window.Tracklist.render();
      this.updateHeaderInfo(window.state.currentList.filter(t => !t.isSectionHeader).length);
    } else {
      tracklistView.classList.add('hidden');
      gridView.classList.remove('hidden');
      this.renderGrid(view);
    }
  }

  renderGrid(view) {
    const gridView = document.getElementById('library-grid-view');
    if (!gridView) return;
    gridView.innerHTML = '';
    const library = window.state?.library || [];
    if (view === 'albums') {
      this._renderAlbumsGrid(gridView, library);
    } else if (view === 'artists') {
      this._renderArtistsGrid(gridView, library);
    } else if (view === 'folders') {
      this._renderFoldersGrid(gridView, library);
    }
  }

  _renderAlbumsGrid(container, library) {
 const uniqueMap = new Map();
 const rawList = window.state.currentList || library || [];

 rawList.forEach(track => {
 if (
  track &&
  track.id &&
  !track.isSectionHeader &&
  !uniqueMap.has(track.id)
 ) {
  uniqueMap.set(track.id, track);
 }
 });

 const listToRender = Array.from(uniqueMap.values());

 let albumsArray = window.AlbumIdentity
 ? window.AlbumIdentity.buildReleases(listToRender)
 : [];

 if (!window.AlbumIdentity) {
 console.error(
  '[LibraryViews] AlbumIdentityResolver is not available.'
 );
 }
    this.updateHeaderInfo(albumsArray.length);
    if (albumsArray.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; opacity:0.5; padding: 40px;">No albums found</div>';
      return;
    }
    const cfg = this.sortConfig.albums;
    const searchQuery = window.Search?.inputEl?.value?.trim()?.toLowerCase() || '';
    const convertedQ = window.convertKeyboardLayout ? window.convertKeyboardLayout(searchQuery).toLowerCase() : '';
    const isSearching = searchQuery.length > 0;
    const renderAlbumCard = (album) => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.setAttribute('draggable', 'true');
      const coverUrl = album.coverPath ? `media://${encodeURIComponent(album.coverPath)}` : '';
      const coverStyle = coverUrl ? `style="background-image: url('${coverUrl}')"` : '';
      const yearStr = album.year ? ` • ${album.year}` : '';
      card.innerHTML = `
        <div class="grid-card-cover" ${coverStyle}>
          ${!coverUrl ? '<svg class="icon cover-placeholder-icon" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>' : ''}
          <button class="grid-card-play-btn" title="Play Album">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="grid-card-meta">
          <div class="grid-card-title">${window.escapeHTML(album.title)}</div>
          <div class="grid-card-subtitle">${window.escapeHTML(album.artist)}${yearStr}</div>
        </div>
      `;

       if (album.coverPath && window.CoverColor) {
 const paletteCoverUrl = `media://${encodeURIComponent(album.coverPath)}`;
 window.CoverColor.extractPalette(paletteCoverUrl).then((palette) => {
 if (!palette || !card.isConnected) return;
 card.style.setProperty('--album-card-accent', palette.accent);
 card.style.setProperty('--album-card-accent-rgb', palette.accentRgb);
 card.style.setProperty('--album-card-accent-text', palette.accentText);
 card.classList.add('album-card-has-accent');
 });
 }
      
 card.querySelector('.grid-card-play-btn')?.addEventListener('click', (e) => {
 e.stopPropagation();

 if (
 !Array.isArray(album.tracks) ||
 album.tracks.length === 0 ||
 !window.State
 ) {
 return;
 }

 const albumOrderContext =
 window.AlbumOrder
 ? window.AlbumOrder.createContext(album.tracks)
 : null;

 const albumPlaybackList =
 [...album.tracks].sort((a, b) => {
 if (!window.AlbumOrder) {
 return 0;
 }

 const getDisplayTitle = (track) => {
 const title =
 String(track?.title || '').trim();

 if (
 title &&
 title.toLowerCase() !== 'unknown track' &&
 title.toLowerCase() !== 'unknown title'
 ) {
 return title;
 }

 if (!track?.path) {
 return (
 window.i18n?.t('unknown_track') ||
 'Unknown Track'
 );
 }

 const normalized =
 String(track.path).replace(/\\/g, '/');

 const fileName =
 normalized.substring(
 normalized.lastIndexOf('/') + 1
 );

 return (
 fileName.replace(/\.[^.]+$/, '') ||
 window.i18n?.t('unknown_track') ||
 'Unknown Track'
 );
 };

 const getTrackFilename = (track) => {
 if (!track?.path) return '';

 const normalized =
 String(track.path).replace(/\\/g, '/');

 const fileName =
 normalized.substring(
 normalized.lastIndexOf('/') + 1
 );

 return fileName.replace(/\.[^.]+$/, '');
 };

 return window.AlbumOrder.compare(
 a,
 b,
 albumOrderContext,
 getDisplayTitle,
 getTrackFilename
 );
 });

 const sourceId =
 `album:${album.id || album.key || album.title || 'grid'}`;

 if (window.PlaybackContext) {
 window.PlaybackContext.beginAlbum(
 sourceId
 );
 }

 let startTrack =
 albumPlaybackList[0];

 if (
 window.state.shuffle &&
 albumPlaybackList.length > 1
 ) {
 const randomIndex =
 Math.floor(
 Math.random() *
 albumPlaybackList.length
 );

 startTrack =
 albumPlaybackList[randomIndex];
 }

 window.State.playTrack(
 startTrack,
 false,
 sourceId,
 albumPlaybackList
 );
 });
      card.addEventListener('click', () => {
        if (window.AlbumView) {
          window.AlbumView.openAlbum(album);
        } else {
          this.switchView('tracks', album.tracks);
        }
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.ContextMenu && album.tracks && album.tracks.length > 0) {
          window.ContextMenu.showTrackMenu(e, album.tracks[0], album.tracks);
        }
      });
      return card;
    };
    if (!isSearching && (cfg.field === 'artist' || cfg.field === 'year')) {
      const groupMap = new Map();
      albumsArray.forEach(album => {
        let groupKey = cfg.field === 'artist' ? (album.artist || 'Unknown Artist') : (album.year ? String(album.year) : 'Неизвестный год');
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey).push(album);
      });
      let sortedGroupKeys = Array.from(groupMap.keys());
      sortedGroupKeys.sort((a, b) => {
        if (a < b) return cfg.order === 'asc' ? -1 : 1;
        if (a > b) return cfg.order === 'asc' ? 1 : -1;
        return 0;
      });
      sortedGroupKeys.forEach(groupKey => {
        const groupAlbums = groupMap.get(groupKey);
        groupAlbums.sort((a, b) => a.title.localeCompare(b.title));
        const allGroupTracks = [];
        groupAlbums.forEach(alb => allGroupTracks.push(...alb.tracks));
        const groupHeader = document.createElement('div');
        groupHeader.className = 'grid-group-header';
        groupHeader.innerHTML = `
          <span class="grid-group-title">${window.escapeHTML(groupKey)}</span>
          <button class="grid-group-play-btn" title="Воспроизвести всю группу">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        `;
        groupHeader.querySelector('.grid-group-play-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (allGroupTracks.length > 0) {
            const sourceId = `group:${groupKey}`;
            window.State.playTrack(allGroupTracks[0], false, sourceId, allGroupTracks);
          }
        });
        container.appendChild(groupHeader);
        groupAlbums.forEach(album => {
          container.appendChild(renderAlbumCard(album));
        });
      });
    } else {
      if (isSearching) {
        albumsArray.forEach(album => {
          let maxTrackScore = 0;
          album.tracks.forEach(t => {
            if (t._score && t._score > maxTrackScore) maxTrackScore = t._score;
          });
          const aTitle = album.title.toLowerCase();
          let titleBonus = 0;
          if (aTitle === searchQuery) titleBonus = 3000;
          else if (aTitle.startsWith(searchQuery)) titleBonus = 2000;
          else if (aTitle.includes(searchQuery)) titleBonus = 1000;
          else if (convertedQ && aTitle.includes(convertedQ)) titleBonus = 800;
          album._relevance = titleBonus + maxTrackScore;
        });
        albumsArray.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
      } else {
        albumsArray.sort((a, b) => {
          let valA = cfg.field === 'tracksCount' ? a.tracks.length : (a[cfg.field] ?? '');
          let valB = cfg.field === 'tracksCount' ? b.tracks.length : (b[cfg.field] ?? '');
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
          if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
          return 0;
        });
      }
      albumsArray.forEach(album => {
        container.appendChild(renderAlbumCard(album));
      });
    }
  }


  
 _renderArtistsGrid(container, library) {
 const rawList =
 window.state.currentList ||
 library ||
 [];

 const listToRender =
 rawList.filter(
 track =>
 track &&
 !track.isSectionHeader
 );

 let artistsArray = [];

 if (
 window.ArtistIdentity &&
 typeof window.ArtistIdentity.getEntities === 'function'
 ) {
 artistsArray =
 window.ArtistIdentity.getEntities(
 listToRender
 );
 } else {
 console.error(
 '[LibraryViews] ArtistIdentityResolver is not available.'
 );
 }

 this.updateHeaderInfo(
 artistsArray.length
 );

 if (artistsArray.length === 0) {
 const emptyText =
 window.i18n?.t('no_artists_found') ||
 'No artists found';

 container.innerHTML =
 `<div style="grid-column: 1/-1; text-align:center; opacity:0.5; padding: 40px;">${window.escapeHTML(emptyText)}</div>`;

 return;
 }

 const cfg =
 this.sortConfig.artists;

 const searchQuery =
 window.Search?.inputEl?.value
 ?.trim()
 ?.toLowerCase() || '';

 const convertedQ =
 window.convertKeyboardLayout
 ? window.convertKeyboardLayout(
 searchQuery
 ).toLowerCase()
 : '';

 const isSearching =
 searchQuery.length > 0;

 if (isSearching) {
 artistsArray.forEach(artist => {
 let maxTrackScore = 0;

 artist.tracks.forEach(track => {
 if (
 track._score &&
 track._score > maxTrackScore
 ) {
 maxTrackScore =
 track._score;
 }
 });

 const artistName =
 artist.name.toLowerCase();

 let nameBonus = 0;

 if (artistName === searchQuery) {
 nameBonus = 3000;
 } else if (
 artistName.startsWith(searchQuery)
 ) {
 nameBonus = 2000;
 } else if (
 artistName.includes(searchQuery)
 ) {
 nameBonus = 1000;
 } else if (
 convertedQ &&
 artistName.includes(convertedQ)
 ) {
 nameBonus = 800;
 }

 artist._relevance =
 nameBonus + maxTrackScore;
 });

 artistsArray.sort(
 (a, b) =>
 (b._relevance || 0) -
 (a._relevance || 0)
 );
 } else {
 artistsArray.sort((a, b) => {
 let valA =
 cfg.field === 'tracksCount'
 ? a.tracks.length
 : (a.name ?? '');

 let valB =
 cfg.field === 'tracksCount'
 ? b.tracks.length
 : (b.name ?? '');

 if (typeof valA === 'string') {
 valA = valA.toLowerCase();
 }

 if (typeof valB === 'string') {
 valB = valB.toLowerCase();
 }

 if (valA < valB) {
 return cfg.order === 'asc'
 ? -1
 : 1;
 }

 if (valA > valB) {
 return cfg.order === 'asc'
 ? 1
 : -1;
 }

 return 0;
 });
 }

 artistsArray.forEach(artist => {
 const card =
 document.createElement('div');

 card.className =
 'grid-card artist-card';

 card.dataset.artistId =
 artist.id;

 card.setAttribute(
 'draggable',
 'true'
 );

 const coverUrl =
 artist.coverPath
 ? `media://${encodeURIComponent(artist.coverPath)}`
 : '';

 const coverStyle =
 coverUrl
 ? `style="background-image: url('${coverUrl}')"`
 : '';

 const tracksLabel =
 window.i18n?.t('artist_tracks_count') ||
 '{count} tracks';

 card.innerHTML = `
 <div class="grid-card-cover" ${coverStyle}>
 ${!coverUrl ? '<svg class="icon cover-placeholder-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' : ''}
 <button class="grid-card-play-btn" data-i18n-tooltip="artist_play">
 <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
 </button>
 </div>
 <div class="grid-card-meta" style="text-align: center;">
 <div class="grid-card-title">${window.escapeHTML(artist.name)}</div>
 <div class="grid-card-subtitle">${window.escapeHTML(tracksLabel.replace('{count}', artist.tracks.length))}</div>
 </div>
 `;

 card
 .querySelector('.grid-card-play-btn')
 ?.addEventListener('click', (e) => {
 e.stopPropagation();

 if (
 artist.tracks.length === 0 ||
 !window.State
 ) {
 return;
 }

 const sourceId =
 `artist:${artist.id}`;

 window.State.playTrack(
 artist.tracks[0],
 false,
 sourceId,
 artist.tracks
 );
 });

 card.addEventListener('click', () => {
 if (
 window.ArtistView &&
 typeof window.ArtistView.openArtist === 'function'
 ) {
 window.ArtistView.openArtist(
 artist,
 {
 type: 'library',
 searchState:
 window.NavigationHistory
 ?.captureSearchState(),
 libraryView:
 window.LibraryViews?.currentView ||
 'artists',
 libraryScrollTop:
 container.scrollTop || 0
 }
 );

 return;
 }

 this.switchView(
 'tracks',
 artist.tracks
 );
 });

 card.addEventListener(
 'contextmenu',
 (e) => {
 e.preventDefault();
 e.stopPropagation();

 if (
 window.ContextMenu &&
 artist.tracks.length > 0
 ) {
 window.ContextMenu.showTrackMenu(
 e,
 artist.tracks[0],
 artist.tracks
 );
 }
 }
 );

 container.appendChild(card);
 });
 }

  _renderFoldersGrid(container, library) {
    const folderMap = new Map();
    const listToRender = window.state.currentList || library || [];

    listToRender.forEach(track => {
      if (!track || !track.path || track.isSectionHeader) return;
      const parts = track.path.replace(/\\/g, '/').split('/');
      parts.pop();
      const folderPath = parts.join('/');
      const folderName = parts.pop() || folderPath;
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, {
          name: folderName,
          path: folderPath,
          coverPath: track.coverPath,
          tracks: []
        });
      }
      folderMap.get(folderPath).tracks.push(track);
    });

    let foldersArray = Array.from(folderMap.values());
    this.updateHeaderInfo(foldersArray.length);

    if (foldersArray.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; opacity:0.5; padding: 40px;">No music folders connected</div>';
      return;
    }

    const cfg = this.sortConfig.folders;
    const searchQuery = window.Search?.inputEl?.value?.trim()?.toLowerCase() || '';
    const convertedQ = window.convertKeyboardLayout ? window.convertKeyboardLayout(searchQuery).toLowerCase() : '';
    const isSearching = searchQuery.length > 0;

    if (isSearching) {
      foldersArray.forEach(folder => {
        let maxTrackScore = 0;
        folder.tracks.forEach(t => {
          if (t._score && t._score > maxTrackScore) maxTrackScore = t._score;
        });
        const fName = folder.name.toLowerCase();
        let nameBonus = 0;
        if (fName === searchQuery) nameBonus = 3000;
        else if (fName.startsWith(searchQuery)) nameBonus = 2000;
        else if (fName.includes(searchQuery)) nameBonus = 1000;
        else if (convertedQ && fName.includes(convertedQ)) nameBonus = 800;

        folder._relevance = nameBonus + maxTrackScore;
      });

      foldersArray.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
    } else {
      foldersArray.sort((a, b) => {
        let valA = cfg.field === 'tracksCount' ? a.tracks.length : (a.name ?? '');
        let valB = cfg.field === 'tracksCount' ? b.tracks.length : (b.name ?? '');
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
        if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    foldersArray.forEach(folder => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.setAttribute('draggable', 'true');
      const coverUrl = folder.coverPath ? `media://${encodeURIComponent(folder.coverPath)}` : '';
      const coverStyle = coverUrl ? `style="background-image: url('${coverUrl}')"` : '';
      card.innerHTML = `
        <div class="grid-card-cover" ${coverStyle}>
          ${!coverUrl ? '<svg class="icon cover-placeholder-icon" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>' : ''}
          <button class="grid-card-play-btn" title="Play Folder">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="grid-card-meta">
          <div class="grid-card-title">${window.escapeHTML(folder.name)}</div>
          <div class="grid-card-subtitle">${folder.tracks.length} files</div>
        </div>
      `;
      card.querySelector('.grid-card-play-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const fullBaseList = window.Search ? window.Search.getBaseListForActiveNav() : window.state.library;
        window.State.playTrack(folder.tracks[0], false, window.state.activeNav, fullBaseList);
      });
      card.addEventListener('click', () => {
        this.switchView('tracks', folder.tracks);
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.ContextMenu && folder.tracks && folder.tracks.length > 0) {
          window.ContextMenu.showTrackMenu(e, folder.tracks[0], folder.tracks);
        }
      });
      container.appendChild(card);
    });
  }
}

window.LibraryViews = new LibraryViewsManager();