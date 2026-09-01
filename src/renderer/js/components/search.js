/**
 * COSMIC PLAYER - TWO-TIERED SEARCH & KEYBOARD LAYOUT FIXER ENGINE
 * Двухуровневый поиск (Tier 1 Instant 0ms / Tier 2 Debounced Fuzzy), кэширование,
 * пословный конвертер раскладки клавиатуры и каскадный ESC.
 */
class SearchManager {
  constructor() {
    this.inputEl = null;
    this.clearBtnEl = null;
    this.dropdownEl = null;
    this.containerBox = null;
    this.spinnerEl = null;
    this.iconBoxEl = null;

    this.maxHistoryItems = 7;
    this.savedLibraryQuery = ''; // Запомненный запрос Музыки при уходе в Настройки
    this.searchCache = new Map(); // Кэш найденных результатов: Map<queryKey, track[]>
    this.fuzzyTimer = null;
  }

  init() {
    this.inputEl = document.getElementById('search-input');
    this.clearBtnEl = document.getElementById('search-clear-btn');
    this.dropdownEl = document.getElementById('search-history-dropdown');
    this.containerBox = document.getElementById('search-container-box');
    this.spinnerEl = document.getElementById('search-spinner');
    this.iconBoxEl = document.getElementById('search-icon-box');

    if (!this.inputEl) return;

    // 1. Поиск при каждом изменении поля ввода
    this.inputEl.addEventListener('input', (e) => {
      const val = e.target.value;
      this._toggleClearButton(val.length > 0);
      this.executeSearch(val);
    });

    // 2. История поиска
    this.inputEl.addEventListener('focus', () => {
      if (!this.isSettingsActive()) {
        this.renderHistoryDropdown();
      }
    });

    this.inputEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isSettingsActive()) {
        this.renderHistoryDropdown();
      }
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = this.inputEl.value.trim();
        if (query && !this.isSettingsActive()) {
          this.saveToHistory(query);
          this.hideHistoryDropdown();
        }
      }
    });

    // 3. Каскадный ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleCascadeEscape(e);
      }
    });

    // 4. Очистка поиска
    if (this.clearBtnEl) {
      this.clearBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSearch();
      });
    }

    // 5. Сброс фокуса вне поля поиска
    document.addEventListener('click', (e) => {
      if (this.containerBox && !this.containerBox.contains(e.target)) {
        this.hideHistoryDropdown();
      }
    });

    // Сортировка по колонкам
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', (e) => {
        const field = e.target.dataset.sort || e.target.closest('.sortable')?.dataset?.sort;
        if (!field) return;

        if (window.sortConfig.field === field) {
          window.sortConfig.asc = !window.sortConfig.asc;
        } else {
          window.sortConfig.field = field;
          window.sortConfig.asc = true;
        }

        if (Array.isArray(window.state.currentList)) {
          window.state.currentList.sort((a, b) => {
            const valA = a[field] || '';
            const valB = b[field] || '';
            if (valA < valB) return window.sortConfig.asc ? -1 : 1;
            if (valA > valB) return window.sortConfig.asc ? 1 : -1;
            return 0;
          });
        }

        if (window.Tracklist) window.Tracklist.render();
      });
    });
  }

 syncContext() {
 if (!this.inputEl) {
 this.inputEl = document.getElementById('search-input');
 }
 if (!this.inputEl) return;

 let placeholderKey = 'search';
 let fallbackText = 'Search track, artist, album...';

 if (this.isSettingsActive()) {
 placeholderKey = 'settings_search_placeholder';
 fallbackText = 'Search settings...';
 } else if (window.AlbumView?.isOpen) {
 placeholderKey = 'album_search_placeholder';
 fallbackText = 'Search tracks in album...';
 } else {
 const activeNav = window.state?.activeNav || 'library';

 if (activeNav !== 'library') {
 placeholderKey = 'playlist_search_placeholder';
 fallbackText = 'Search in playlist...';
 } else {
 const currentView = window.LibraryViews?.currentView || 'tracks';

 if (currentView === 'albums') {
 placeholderKey = 'albums_search_placeholder';
 fallbackText = 'Search albums...';
 } else if (currentView === 'artists') {
 placeholderKey = 'artists_search_placeholder';
 fallbackText = 'Search artists...';
 } else if (currentView === 'folders') {
 placeholderKey = 'folders_search_placeholder';
 fallbackText = 'Search folders...';
 } else {
 placeholderKey = 'search';
 fallbackText = 'Search track, artist, album...';
 }
 }
 }

 const translated = window.i18n?.t(placeholderKey);
 this.inputEl.placeholder =
 translated && translated !== placeholderKey
 ? translated
 : fallbackText;

 this.inputEl.setAttribute(
 'data-i18n-placeholder',
 placeholderKey
 );
 }

  isSettingsActive() {
    const settingsContainer = document.getElementById('settings-view-container');
    return settingsContainer && !settingsContainer.classList.contains('hidden');
  }

 handleCascadeEscape(e) {
 if (
 window.FullscreenPlayer &&
 window.FullscreenPlayer.isOpen
 ) {
 return;
 }

 const openModal =
 document.querySelector(
 '.modal-overlay:not(.hidden)'
 );

 if (openModal) {
 return;
 }

 const currentQuery =
 this.inputEl
 ? this.inputEl.value
 : '';

 // 1. Первый Esc всегда очищает активный поиск.
 if (currentQuery.length > 0) {
 e.preventDefault();
 e.stopPropagation();

 this.clearSearch();

 if (
 document.activeElement ===
 this.inputEl
 ) {
 this.inputEl.blur();
 }

 return;
 }

 // 2. Вложенные экраны используют NavigationHistory.
 if (
 window.NavigationHistory &&
 window.NavigationHistory.canGoBack()
 ) {
 e.preventDefault();
 e.stopPropagation();

 window.NavigationHistory.back();

 return;
 }

 // 3. Fallback для Album View без записи в NavigationHistory.
 if (
 window.AlbumView &&
 window.AlbumView.isOpen
 ) {
 e.preventDefault();
 e.stopPropagation();

 window.AlbumView.close();

 return;
 }

  if (
 window.ArtistView &&
 window.ArtistView.isOpen
 ) {
 e.preventDefault();
 e.stopPropagation();
 window.ArtistView.requestClose();
 return;
 }

 const inSettings =
 this.isSettingsActive();

 const activeNav =
 window.state?.activeNav ||
 'library';

 const currentLibraryView =
 window.LibraryViews?.currentView ||
 'tracks';

 // 4. Настройки закрываются с гарантированным возвратом в Library.
 if (inSettings) {
 e.preventDefault();
 e.stopPropagation();

 if (
 typeof window.exitSettings ===
 'function'
 ) {
 window.exitSettings();
 }

 if (window.Playlists) {
 const navLibraryEl =
 document.getElementById(
 'nav-library'
 );

 window.Playlists.switchNav(
 'library',
 navLibraryEl
 );
 }

 if (window.LibraryViews) {
 window.LibraryViews.switchView(
 'tracks'
 );
 }

 return;
 }

 // 5. Playlist / Queue возвращаются в Моя Музыка → Tracks.
 if (activeNav !== 'library') {
 e.preventDefault();
 e.stopPropagation();

 if (window.Playlists) {
 const navLibraryEl =
 document.getElementById(
 'nav-library'
 );

 window.Playlists.switchNav(
 'library',
 navLibraryEl
 );
 }

 if (window.LibraryViews) {
 window.LibraryViews.switchView(
 'tracks'
 );
 }

 return;
 }

 // 6. Albums / Artists / Folders являются соседними видами Library.
 // Esc из любого из них возвращает в основной список Tracks.
 if (currentLibraryView !== 'tracks') {
 e.preventDefault();
 e.stopPropagation();

 if (window.LibraryViews) {
 window.LibraryViews.switchView(
 'tracks'
 );
 }

 return;
 }

 // 7. Уже на Моя Музыка → Tracks:
 // Esc больше ничего не делает.
 }

  clearSearch() {
    if (this.inputEl) {
      this.inputEl.value = '';
      this._toggleClearButton(false);
      this.executeSearch('');
    }
  }

  clearCache() {
    this.searchCache.clear();
  }

  _toggleClearButton(show) {
    if (this.clearBtnEl) {
      this.clearBtnEl.classList.toggle('hidden', !show);
    }
  }

  _showSpinner(show) {
    if (this.spinnerEl && this.iconBoxEl) {
      this.spinnerEl.classList.toggle('hidden', !show);
      this.iconBoxEl.classList.toggle('hidden', show);
    }
  }

  getBaseListForActiveNav() {
    const activeNav = window.state?.activeNav || 'library';
    if (activeNav === 'library') {
      return window.state?.library || [];
    } else if (activeNav === 'queue') {
      return window.state?.queue || [];
    } else if (window.Playlists) {
      return window.Playlists.getPlaylistTracks(activeNav) || [];
    }
    return window.state?.library || [];
  }

  /**
   * Главный двухуровневый движок поиска
   */
 executeSearch(rawQuery) {
 if (this.fuzzyTimer) {
 clearTimeout(this.fuzzyTimer);
 this.fuzzyTimer = null;
 }
 const q = rawQuery ? rawQuery.trim().toLowerCase() : '';
 if (this.isSettingsActive()) {
 this._showSpinner(false);
 this.hideHistoryDropdown();
 if (window.SettingsView) {
 window.SettingsView.filterSettings(rawQuery);
 }
 return;
 }
 if (window.AlbumView && window.AlbumView.isOpen) {
      this._showSpinner(false);
      window.AlbumView.filterTracks(q);
      return;
    }
    const activeNav = window.state?.activeNav || 'library';
    const baseList = this.getBaseListForActiveNav();
    if (!q) {
      this._showSpinner(false);
      window.state.currentList = [...baseList];
      this._updateActiveView();
      return;
    }
    // Проверка кэша результатов поиска (0ms)
    const cacheKey = `${activeNav}|||${q}`;
    if (this.searchCache.has(cacheKey)) {
      this._showSpinner(false);
      window.state.currentList = [...this.searchCache.get(cacheKey)];
      this._updateActiveView();
      return;
    }
    // Подготовка гипотез
    const autoLayoutEnabled = window.state?.config?.autoLayoutFix ?? true;
    const convertedQ = (autoLayoutEnabled && window.convertKeyboardLayout)
      ? window.convertKeyboardLayout(q).toLowerCase()
      : '';
    const phoneticQ = window.phoneticTranslit ? window.phoneticTranslit(q) : '';
    const queryWordCount = q.split(/\s+/).length;
    const semanticWords = (queryWordCount <= 2 && window.getSemanticVariants)
      ? window.getSemanticVariants(q)
      : [];

    const labelDidYouMean = (window.i18n && window.i18n.t('search_did_you_mean') !== 'search_did_you_mean')
      ? window.i18n.t('search_did_you_mean')
      : 'Возможно вы имели в виду:';
    const labelFoundInLyrics = (window.i18n && window.i18n.t('search_found_in_lyrics') !== 'search_found_in_lyrics')
      ? window.i18n.t('search_found_in_lyrics')
      : 'Распознано по тексту:';

    // TIER 1: МГНОВЕННЫЙ ПОИСК С ОЦЕНКОЙ РЕЛЕВАНТНОСТИ (0ms)
    const directMatches = [];
    const didYouMeanMatches = [];
    const processedIds = new Set();

    for (const track of baseList) {
      if (!track) continue;
      const title = (track.title || '').toLowerCase();
      const artist = (track.artist || '').toLowerCase();
      const album = (track.album || '').toLowerCase();
      const pathStr = (track.path || '').toLowerCase();

      let directScore = 0;
      if (artist === q || title === q) directScore = 2000;
      else if (artist.startsWith(q) || title.startsWith(q)) directScore = 1500;
      else if (artist.includes(q) || title.includes(q)) directScore = 1000;
      else if (album.includes(q) || pathStr.includes(q)) directScore = 600;

      if (directScore > 0) {
        directMatches.push({ ...track, _score: directScore });
        processedIds.add(track.id);
        continue;
      }

      const matchConverted = convertedQ && convertedQ !== q && (
        title.includes(convertedQ) || artist.includes(convertedQ) || album.includes(convertedQ) || pathStr.includes(convertedQ)
      );
      const matchPhonetic = phoneticQ && phoneticQ !== q && (
        title.includes(phoneticQ) || artist.includes(phoneticQ) || album.includes(phoneticQ)
      );
      const matchSemantic = semanticWords.length > 0 && semanticWords.some(w => title.includes(w) || artist.includes(w) || album.includes(w));
      const isAcronymMatch = window.matchAcronym ? (
        window.matchAcronym(artist, q) || window.matchAcronym(title, q) || window.matchAcronym(`${artist} ${title}`, q)
      ) : false;

      if (matchConverted || matchPhonetic || matchSemantic || isAcronymMatch) {
        let altScore = 500;
        if (isAcronymMatch) altScore = 800;
        didYouMeanMatches.push({ ...track, _score: altScore });
        processedIds.add(track.id);
      }
    }

    directMatches.sort((a, b) => (b._score || 0) - (a._score || 0));
    didYouMeanMatches.sort((a, b) => (b._score || 0) - (a._score || 0));

    const initialList = [...directMatches];
    if (didYouMeanMatches.length > 0) {
      initialList.push({ isSectionHeader: true, text: labelDidYouMean });
      initialList.push(...didYouMeanMatches);
    }
    if (initialList.length > 0) {
      window.state.currentList = initialList;
      this._updateActiveView();
    }

    // TIER 2: ФОНОВЫЙ ПОИСК И FUZZY
    this._showSpinner(true);
    this.fuzzyTimer = setTimeout(async () => {
      const remainingTracks = baseList.filter(t => t && !processedIds.has(t.id));
      const fuzzyDidYouMean = [];

      for (const track of remainingTracks) {
        const scoreTitle = window.fuzzyMatch(track.title, q).score;
        const scoreArtist = window.fuzzyMatch(track.artist, q).score;
        let scoreConvTitle = 0, scoreConvArtist = 0;
        if (convertedQ && convertedQ !== q) {
          scoreConvTitle = window.fuzzyMatch(track.title, convertedQ).score;
          scoreConvArtist = window.fuzzyMatch(track.artist, convertedQ).score;
        }
        let scorePhoneticTitle = 0, scorePhoneticArtist = 0;
        if (phoneticQ && phoneticQ !== q) {
          scorePhoneticTitle = window.fuzzyMatch(track.title, phoneticQ).score;
          scorePhoneticArtist = window.fuzzyMatch(track.artist, phoneticQ).score;
        }
        const maxFuzzy = Math.max(scoreTitle, scoreArtist, scoreConvTitle, scoreConvArtist, scorePhoneticTitle, scorePhoneticArtist);
        if (maxFuzzy >= 55) {
          fuzzyDidYouMean.push({ track: { ...track, _score: maxFuzzy * 3 }, score: maxFuzzy });
          processedIds.add(track.id);
        }
      }

      fuzzyDidYouMean.sort((a, b) => b.score - a.score);
      const fuzzyTracks = fuzzyDidYouMean.map(r => r.track);

      const directSet = new Set(directMatches.map(m => m.id));
      const tracksToSearchLyrics = baseList.filter(t => t && !directSet.has(t.id));
      let lyricsGroupedMatches = [];
      let realMatchedLine = '';

      if (tracksToSearchLyrics.length > 0 && window.api?.os?.searchInLyrics) {
        const matchedResults = await window.api.os.searchInLyrics({
          query: q,
          convertedQuery: convertedQ,
          phoneticQuery: phoneticQ,
          tracks: tracksToSearchLyrics
        });
        if (Array.isArray(matchedResults) && matchedResults.length > 0) {
          const matchedMap = new Map(matchedResults.map(r => [r.id, { line: r.matchedLine, score: r.score || 0 }]));
          
          lyricsGroupedMatches = tracksToSearchLyrics
            .filter(t => matchedMap.has(t.id))
            .map(t => ({ ...t, _lrcScore: matchedMap.get(t.id).score }))
            .sort((a, b) => (b._lrcScore || 0) - (a._lrcScore || 0));

          if (lyricsGroupedMatches.length > 0) {
            const topId = lyricsGroupedMatches[0].id;
            realMatchedLine = matchedMap.get(topId)?.line || '';
          }
        }
      }

      const finalList = [...directMatches];
      const allDidYouMean = [...didYouMeanMatches, ...fuzzyTracks];
      if (allDidYouMean.length > 0) {
        finalList.push({ isSectionHeader: true, text: labelDidYouMean });
        finalList.push(...allDidYouMean);
      }
      if (lyricsGroupedMatches.length > 0) {
        const lyricsHeader = realMatchedLine ? `${labelFoundInLyrics} "${realMatchedLine}"` : labelFoundInLyrics;
        finalList.push({ isSectionHeader: true, text: lyricsHeader });
        finalList.push(...lyricsGroupedMatches);
      }

      this.searchCache.set(cacheKey, finalList);
      window.state.currentList = finalList;
      this._showSpinner(false);
      this._updateActiveView();
    }, 150);
  }

  _updateActiveView() {
    const currentView = window.LibraryViews?.currentView || 'tracks';
    if (currentView !== 'tracks' && window.LibraryViews) {
      window.LibraryViews.renderGrid(currentView);
    } else if (window.Tracklist) {
      const body = document.getElementById('tracklist-body');
      if (body) body.scrollTop = 0;
      window.Tracklist.render();
    }
  }

  getHistory() {
    if (!window.state?.config) return [];
    return window.state.config.lastState?.searchHistory || [];
  }

  saveToHistory(query) {
    if (!query || !window.state?.config) return;
    let history = this.getHistory();
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    if (history.length > this.maxHistoryItems) {
      history = history.slice(0, this.maxHistoryItems);
    }

    window.state.config.lastState = window.state.config.lastState || {};
    window.state.config.lastState.searchHistory = history;
    window.api.db.saveConfig(window.state.config);
  }

  removeFromHistory(query) {
    if (!window.state?.config) return;
    let history = this.getHistory();
    history = history.filter(item => item !== query);
    window.state.config.lastState.searchHistory = history;
    window.api.db.saveConfig(window.state.config);
    this.renderHistoryDropdown();
  }

  clearAllHistory() {
    if (!window.state?.config) return;
    window.state.config.lastState.searchHistory = [];
    window.api.db.saveConfig(window.state.config);
    this.hideHistoryDropdown();
  }

  renderHistoryDropdown() {
    if (!this.dropdownEl) return;
    const history = this.getHistory();
    if (history.length === 0) {
      this.hideHistoryDropdown();
      return;
    }

    this.dropdownEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'search-history-header';
    header.innerHTML = `
      <span>RECENT SEARCHES</span>
      <button class="search-history-clear-all" id="btn-clear-search-history">Clear</button>
    `;
    this.dropdownEl.appendChild(header);

    header.querySelector('#btn-clear-search-history')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearAllHistory();
    });

    history.forEach(itemText => {
      const item = document.createElement('div');
      item.className = 'search-history-item';
      item.innerHTML = `
        <span>${window.escapeHTML(itemText)}</span>
        <button class="remove-history-btn" title="Remove">✕</button>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.inputEl) {
          this.inputEl.value = itemText;
          this._toggleClearButton(true);
          this.executeSearch(itemText);
          this.hideHistoryDropdown();
        }
      });

      item.querySelector('.remove-history-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFromHistory(itemText);
      });

      this.dropdownEl.appendChild(item);
    });

    this.dropdownEl.classList.remove('hidden');
  }

  hideHistoryDropdown() {
    if (this.dropdownEl) {
      this.dropdownEl.classList.add('hidden');
    }
  }
}

window.Search = new SearchManager();