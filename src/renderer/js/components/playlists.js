/**
 * COSMIC PLAYER - PLAYLISTS MANAGER
 * Управление плейлистами, закрепами, генерацией обложек и перетаскиванием
 */
class PlaylistsManager {
  constructor() {
    this.draggedPlId = null;
  }

  init() {
    document.getElementById('nav-library')?.addEventListener('click', (e) => this.switchNav('library', e.currentTarget));
    document.getElementById('nav-queue')?.addEventListener('click', (e) => this.switchNav('queue', e.currentTarget));

    const plModal = document.getElementById('playlist-modal');
    const plInput = document.getElementById('playlist-name-input');

    const closePlaylistModal = () => {
      const hasText = plInput && plInput.value.trim() !== '';
      if (hasText) {
        if (typeof showConfirm === 'function') {
          showConfirm(
            'Несохранённые изменения',
            'Вы начали вводить название плейлиста. Закрыть окно без сохранения?',
            true,
            (confirmed) => {
              if (confirmed) {
                if (plInput) plInput.value = '';
                plModal?.classList.add('hidden');
              }
            }
          );
        } else {
          if (plInput) plInput.value = '';
          plModal?.classList.add('hidden');
        }
      } else {
        if (plInput) plInput.value = '';
        plModal?.classList.add('hidden');
      }
    };

    document.getElementById('btn-create-playlist')?.addEventListener('click', () => {
      if (plInput) plInput.value = '';
      plModal?.classList.remove('hidden');
      setTimeout(() => plInput?.focus(), 50);
    });

    document.getElementById('btn-close-playlist')?.addEventListener('click', closePlaylistModal);

    plInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePlaylistModal();
      }
    });

    document.getElementById('btn-save-playlist')?.addEventListener('click', () => {
      const name = plInput ? plInput.value.trim() : '';
      if (name) {
        window.state.playlists.push({ id: Date.now().toString(), name, tracks: [], pinned: false });
        window.api.db.savePlaylists(window.state.playlists);
        this.render();
        plModal?.classList.add('hidden');
        if (plInput) plInput.value = '';
        if (window.Toast) window.Toast.success(`Плейлист "${name}" создан`);
      }
    });

    this.render();
  }

  /** Динамический поиск обложки из последнего добавленного трека в плейлисте */
  getPlaylistCoverPath(pl) {
    if (!pl || !pl.tracks || pl.tracks.length === 0) return null;
    for (let i = pl.tracks.length - 1; i >= 0; i--) {
      const trackId = pl.tracks[i];
      const track = window.state.library.find(t => t.id === trackId);
      if (track && track.coverPath) return track.coverPath;
    }
    return null;
  }

  /** Закрепить / Открепить плейлист */
  togglePin(plId) {
    const pl = window.state.playlists.find(p => p.id === plId);
    if (!pl) return;
    pl.pinned = !pl.pinned;
    this._sortPlaylists();
    window.api.db.savePlaylists(window.state.playlists);
    this.render();
    if (window.Toast) {
      const msgKey = pl.pinned ? 'toast_pl_pinned' : 'toast_pl_unpinned';
      const defaultText = pl.pinned ? `Плейлист «${pl.name}» закреплен` : `Плейлист «${pl.name}» откреплен`;
      const translated = window.i18n?.t(msgKey)?.replace('{name}', pl.name) || defaultText;
      window.Toast.info(translated);
    }
  }

  _sortPlaylists() {
    if (!window.state.playlists) return;
    const pinned = window.state.playlists.filter(p => p.pinned);
    const unpinned = window.state.playlists.filter(p => !p.pinned);
    window.state.playlists = [...pinned, ...unpinned];
  }

  /** Переключение разделов левого сайдбара */
  switchNav(target, el) {
    document.querySelectorAll('#sidebar-music-view .nav-item, #sidebar-music-view .playlist-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    window.state.activeNav = target;
     if (window.Search) {
 window.Search.syncContext();
 }
    if (target === 'library') window.state.currentList = [...window.state.library];
    else if (target === 'queue') window.state.currentList = [...window.state.queue];
    else window.state.currentList = this.getPlaylistTracks(target);

    const libraryTabs = document.getElementById('library-tabs');
    const gridView = document.getElementById('library-grid-view');
    const tracklistView = document.getElementById('tracklist-view');
    const settingsContainer = document.getElementById('settings-view-container');
    const mainHeaderBar = document.getElementById('main-header-bar');

    if (settingsContainer) settingsContainer.classList.add('hidden');
    if (mainHeaderBar) mainHeaderBar.classList.remove('hidden');

    if (target === 'library') {
      if (libraryTabs) libraryTabs.classList.remove('hidden');
      if (window.LibraryViews) {
        // Принудительно возвращаем на таблицу треков при клике на "Моя Музыка"
        window.LibraryViews.switchView('tracks');
      }
    } else {
      if (libraryTabs) libraryTabs.classList.add('hidden');
      if (gridView) gridView.classList.add('hidden');
      if (tracklistView) tracklistView.classList.remove('hidden');
      const body = document.getElementById('tracklist-body');
      if (body) body.scrollTop = 0;
      if (window.Tracklist) window.Tracklist.render();
    }
  }

  /** Подсветка играющего плейлиста и добавление анимированного эквалайзера (Spotify Style) */
 updatePlayingHighlight() {
 document.querySelectorAll('.playing-eq-bars').forEach(el => el.remove());
 document.querySelectorAll('#sidebar-music-view .nav-item, #sidebar-music-view .playlist-item').forEach(n => n.classList.remove('playing-source'));
 const source = window.state.playbackSource;
 let targetEl = null;
 if (source === 'library') targetEl = document.getElementById('nav-library');
 else if (source) targetEl = document.querySelector(`.playlist-item[data-id="${source}"]`);
 if (targetEl) {
 targetEl.classList.add('playing-source');
 const rightContainer = targetEl.querySelector('.playlist-item-right') || targetEl;
 if (!rightContainer.querySelector('.playing-eq-bars')) {
 const eqHtml = document.createElement('div');
 eqHtml.className = 'playing-eq-bars';
 eqHtml.innerHTML = `<span class="bar bar1"></span><span class="bar bar2"></span><span class="bar bar3"></span>`;
 rightContainer.appendChild(eqHtml);
 }
 }
 }

  getPlaylistTracks(plId) {
    const pl = window.state.playlists.find(p => p.id === plId);
    if (!pl) return [];
    return pl.tracks.map(id => window.state.library.find(t => t.id === id)).filter(Boolean);
  }

  removeTrackFromPlaylist(playlistId, trackId) {
    const pl = window.state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    pl.tracks = pl.tracks.filter(id => id !== trackId);
    window.api.db.savePlaylists(window.state.playlists);

    if (window.state.activeNav === playlistId) {
      window.state.currentList = this.getPlaylistTracks(playlistId);
      if (window.Tracklist) window.Tracklist.render();
    }
    this.render();
    if (window.Toast) window.Toast.info(`Удалено из плейлиста "${pl.name}"`);
  }

  /** Очистка несуществующих ID треков из всех плейлистов (только если библиотека не пуста!) */
  cleanOrphanTracks() {
    if (!window.state.library || window.state.library.length === 0 || !window.state.playlists) return;
    const validIds = new Set(window.state.library.map(t => t.id));
    let isChanged = false;
    window.state.playlists.forEach(pl => {
      const orig = pl.tracks.length;
      pl.tracks = pl.tracks.filter(id => validIds.has(id));
      if (pl.tracks.length !== orig) isChanged = true;
    });
    if (isChanged) {
      window.api.db.savePlaylists(window.state.playlists);
      this.render();
    }
  }

  render() {
    const container = document.getElementById('playlists-container');
    if (!container) return;
    container.innerHTML = '';

    if (!window.state.playlists) window.state.playlists = [];
    const pinnedList = window.state.playlists.filter(p => p.pinned);
    const unpinnedList = window.state.playlists.filter(p => !p.pinned);

    const renderItem = (pl) => {
      const li = document.createElement('li');
      li.className = 'playlist-item';
      if (window.state.activeNav === pl.id) li.classList.add('active');
      li.dataset.id = pl.id;
      li.setAttribute('draggable', 'true');

      const leftDiv = document.createElement('div');
      leftDiv.className = 'playlist-item-left';

      const coverPath = this.getPlaylistCoverPath(pl);
      const coverDiv = document.createElement('div');
      if (coverPath) {
        coverDiv.className = 'playlist-cover';
        coverDiv.style.backgroundImage = `url("media://${encodeURIComponent(coverPath)}")`;
      } else {
        coverDiv.className = 'playlist-cover playlist-cover-default';
        coverDiv.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'playlist-item-title';
      titleSpan.textContent = pl.name;

      leftDiv.appendChild(coverDiv);
      leftDiv.appendChild(titleSpan);

      const rightDiv = document.createElement('div');
      rightDiv.className = 'playlist-item-right';

      if (pl.pinned) {
        const pinSvg = document.createElement('div');
        pinSvg.className = 'playlist-pin-icon';
        pinSvg.title = window.i18n?.t('ctx_pl_unpin') || 'Открепить';
        pinSvg.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`;
        pinSvg.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePin(pl.id);
        });
        rightDiv.appendChild(pinSvg);
      }

      li.appendChild(leftDiv);
      li.appendChild(rightDiv);

      li.addEventListener('click', (e) => this.switchNav(pl.id, e.currentTarget));
      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (window.ContextMenu) window.ContextMenu.showPlaylistMenu(e, pl.id);
      });

      // Перетаскивание плейлистов для сортировки
      li.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        this.draggedPlId = pl.id;
        e.dataTransfer.setData('text/playlist-id', pl.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => li.classList.add('is-dragging'), 0);
      });

      li.addEventListener('dragover', (e) => {
        if (!this.draggedPlId || this.draggedPlId === pl.id) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = li.getBoundingClientRect();
        const isAbove = (e.clientY - rect.top) < (rect.height / 2);
        document.querySelectorAll('.playlist-item').forEach(el => {
          if (el !== li) el.classList.remove('drop-above', 'drop-below');
        });
        li.classList.toggle('drop-above', isAbove);
        li.classList.toggle('drop-below', !isAbove);
      });

      li.addEventListener('dragleave', (e) => {
        if (!li.contains(e.relatedTarget)) {
          li.classList.remove('drop-above', 'drop-below');
        }
      });

      li.addEventListener('drop', (e) => {
        if (!this.draggedPlId || this.draggedPlId === pl.id) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = li.getBoundingClientRect();
        const isAbove = (e.clientY - rect.top) < (rect.height / 2);
        this._reorderPlaylist(this.draggedPlId, pl.id, isAbove ? 'above' : 'below');
        this._clearDragStyles();
      });

      li.addEventListener('dragend', () => this._clearDragStyles());

      return li;
    };

    pinnedList.forEach(pl => container.appendChild(renderItem(pl)));

    if (pinnedList.length > 0 && unpinnedList.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'playlists-divider';
      container.appendChild(divider);
    }

    unpinnedList.forEach(pl => container.appendChild(renderItem(pl)));

    this.updatePlayingHighlight();
  }

  _clearDragStyles() {
    this.draggedPlId = null;
    document.querySelectorAll('.playlist-item').forEach(item => {
      item.classList.remove('is-dragging', 'drop-above', 'drop-below');
    });
  }

  _reorderPlaylist(sourceId, targetId, position) {
    const list = [...window.state.playlists];
    const sourceIdx = list.findIndex(p => p.id === sourceId);
    const targetIdx = list.findIndex(p => p.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const draggedPl = list[sourceIdx];
    const targetPl = list[targetIdx];
    const oldPinnedState = draggedPl.pinned;

    list.splice(sourceIdx, 1);
    let insertIdx = list.findIndex(p => p.id === targetId);
    if (position === 'below') insertIdx += 1;

    draggedPl.pinned = targetPl.pinned;
    list.splice(insertIdx, 0, draggedPl);

    window.state.playlists = list;
    this._sortPlaylists();
    window.api.db.savePlaylists(window.state.playlists);
    this.render();

    if (window.Toast) {
      if (oldPinnedState !== draggedPl.pinned) {
        const msgKey = draggedPl.pinned ? 'toast_pl_pinned' : 'toast_pl_unpinned';
        const defaultText = draggedPl.pinned ? `Плейлист «${draggedPl.name}» закреплен` : `Плейлист «${draggedPl.name}» откреплен`;
        const translated = window.i18n?.t(msgKey)?.replace('{name}', draggedPl.name) || defaultText;
        window.Toast.info(translated);
      } else {
        const msg = window.i18n?.t('toast_pl_reordered') || 'Порядок плейлистов обновлен';
        window.Toast.info(msg);
      }
    }
  }
}

window.Playlists = new PlaylistsManager();