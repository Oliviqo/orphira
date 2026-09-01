/**
 * COSMIC PLAYER - VIRTUALIZED TRACKLIST MANAGER
 * Виртуализированный рендеринг таблицы треков
 */

class TracklistManager {
  init() {
    this.container = document.getElementById('tracklist-body');
    if (!this.container) return;

    let spacer = document.getElementById('vs-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'vs-spacer';
      spacer.style.width = '100%';
      this.container.appendChild(spacer);
    }

    this.container.addEventListener('scroll', () => this.render());

    // ПРАВИЛО 6: Воспроизведение запускает полные списки плейлиста/папки/альбома, сохраняя порядок и очередь
    this.container.addEventListener('click', (e) => {
      const row = e.target.closest('.track-row');
      if (!row) return;
      const index = parseInt(row.dataset.index, 10);
      if (!isNaN(index)) {
        const track = window.state.currentList[index];
        if (track) {
          row.classList.remove('row-activated');
          void row.offsetWidth; // Анимация подсветки
          row.classList.add('row-activated');
          setTimeout(() => row.classList.remove('row-activated'), 400);
          const currentTracksList = window.state.currentList || window.state.library;
          window.State.playTrack(track, false, window.state.activeNav, currentTracksList);
        }
      }
    });

    this.container.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.track-row');
      if (!row) return;
      e.preventDefault();
      const trackId = row.dataset.id;
      const track = window.state.currentList.find(t => t.id === trackId);
      if (track && window.ContextMenu) window.ContextMenu.showTrackMenu(e, track);
    });

    this.container.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.track-row');
      if (!row) return;
      e.dataTransfer.setData('text/plain', row.dataset.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
  }

  render() {
    const container = document.getElementById('tracklist-body');
    const spacer = document.getElementById('vs-spacer');
    const emptyState = document.getElementById('empty-state');
    if (!container || !spacer) return;
    const tracklistView = document.getElementById('tracklist-view');
    const isTracklistVisible = tracklistView && !tracklistView.classList.contains('hidden');
    const isSettingsVisible = !document.getElementById('settings-view-container')?.classList.contains('hidden');

    // Динамическое обновление крупного названия раздела/плейлиста и статуса сортировки
    const titleEl = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');
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
      const count = (window.state.currentList || []).filter(t => !t.isSectionHeader).length;
      const sortField = window.sortConfig?.field;
      const lang = window.i18n?.currentLang || 'en';
      let sortText = window.i18n?.t('sort_date') || 'добавлению';
      if (sortField === 'title') sortText = window.i18n?.t('sort_title') || 'названию';
      else if (sortField === 'artist') sortText = window.i18n?.t('sort_artist') || 'артисту';
      else if (sortField === 'album') sortText = window.i18n?.t('sort_album') || 'альбому';
      else if (sortField === 'duration') sortText = window.i18n?.t('sort_duration') || 'длительности';
      
      let countStr = `${count} items`;
      if (lang === 'ru') {
        let word = 'треков';
        if (count % 10 === 1 && count % 100 !== 11) word = 'трек';
        else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) word = 'трека';
        countStr = `${count} ${word}`;
      } else {
        const itemWord = count === 1 ? (window.i18n?.t('col_track') || 'track') : (window.i18n?.t('tab_tracks') || 'tracks');
        countStr = `${count} ${itemWord}`;
      }
      const sortedByStr = window.i18n?.t('sorted_by') || 'Отсортировано по';
      subtitleEl.textContent = `${countStr} • ${sortedByStr} ${sortText.toLowerCase()}`;
    }

    if (window.state.currentList.length === 0) {
      if (emptyState) {
        const searchInput = document.getElementById('search-input');
        const query = searchInput ? searchInput.value.trim() : '';
        const emptyIcon = emptyState.querySelector('.icon');
        const emptyText = emptyState.querySelector('div[data-i18n], div:not(.icon)');
        const folderSvg = `<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2zm0 12H4V8h16v10z"/></svg>`;
        const searchSvg = `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 11.99 14 9.5 14z"/></svg>`;
        const playlistSvg = `<svg viewBox="0 0 24 24"><path d="M19 9H2v2h17V9zm0-4H2v2h17V5zM2 15h11v-2H2v2zm13-2v7l5-3.5-5-3.5z"/></svg>`;

        if (query.length > 0) {
          if (emptyIcon) emptyIcon.innerHTML = searchSvg;
          if (emptyText) {
            emptyText.innerHTML = `<div style="font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Ничего не найдено</div><div style="font-size: 12.5px; opacity: 0.6;">по запросу "${window.escapeHTML(query)}"</div>`;
          }
          emptyState.classList.remove('hidden');
        } else if (window.state.activeNav === 'library' && isTracklistVisible && !isSettingsVisible) {
          if (emptyIcon) emptyIcon.innerHTML = folderSvg;
          if (emptyText) {
            const txt = window.i18n?.t('empty_drag_drop') || 'Перетащите папки или .m3u8 файлы сюда';
            emptyText.innerHTML = `<div style="font-size: 14px; font-weight: 600;">${txt}</div>`;
          }
          emptyState.classList.remove('hidden');
        } else if (window.state.activeNav !== 'library' && window.state.activeNav !== 'queue' && isTracklistVisible && !isSettingsVisible) {
          if (emptyIcon) emptyIcon.innerHTML = playlistSvg;
          if (emptyText) {
            const titleText = window.i18n?.t('empty_playlist_title') || 'Плейлист пуст';
            const descText = window.i18n?.t('empty_playlist_desc') || 'Перетащите сюда треки из библиотеки или добавьте их через контекстное меню трека';
            emptyText.innerHTML = `<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px; color: var(--text-primary);">${titleText}</div><div style="font-size: 12.5px; opacity: 0.6; max-width: 320px; line-height: 1.4; text-align: center;">${descText}</div>`;
          }
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }
      spacer.style.height = '0px';
      Array.from(container.children).forEach(c => { if (c.id !== 'vs-spacer') container.removeChild(c); });
      return;
    } else {
      if (emptyState) emptyState.classList.add('hidden');
    }
    spacer.style.height = `${window.state.currentList.length * window.state.rowHeight}px`;
    const st = container.scrollTop;
    let start = Math.max(0, Math.floor(st / window.state.rowHeight) - window.state.renderBuffer);
    let end = Math.min(
      window.state.currentList.length - 1,
      Math.floor((st + container.clientHeight) / window.state.rowHeight) + window.state.renderBuffer
    );

    // === ВОТ ТОТ САМЫЙ НОВЫЙ БЛОК ===
    if (window.LibraryViews) {
      window.LibraryViews.updateHeaderInfo(window.state.currentList.filter(t => !t.isSectionHeader).length);
    }
    // =================================

    Array.from(container.children).forEach(c => { if (c.id !== 'vs-spacer') container.removeChild(c); });
    const fragment = document.createDocumentFragment();
    const svgPlaySmall = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    for (let i = start; i <= end; i++) {
      const track = window.state.currentList[i];
      if (!track) continue;
      if (track.isSectionHeader) {
        const headerRow = document.createElement('div');
        headerRow.className = 'tracklist-section-title';
        headerRow.style.position = 'absolute';
        headerRow.style.top = `${i * window.state.rowHeight}px`;
        headerRow.style.width = '100%';
        headerRow.style.height = `${window.state.rowHeight}px`;
        headerRow.textContent = track.text;
        fragment.appendChild(headerRow);
        continue;
      }
      const isPlaying = track.id === window.state.currentTrackId;
      const row = document.createElement('div');
      row.className = `track-row ${isPlaying ? 'playing' : ''}`;
      row.style.position = 'absolute';
      row.style.top = `${i * window.state.rowHeight}px`;
      row.style.width = '100%';
      row.style.height = `${window.state.rowHeight}px`;
      row.setAttribute('draggable', 'true');
      row.dataset.id = track.id;
      row.dataset.index = i;

      const coverUrl = track.coverPath ? `media://${encodeURIComponent(track.coverPath)}` : '';
      const imgHtml = track.coverPath
        ? `<div class="row-cover" style="background-image: url('${coverUrl}')"></div>`
        : `<div class="row-cover"><svg class="icon icon-sm" style="margin:8px; opacity:0.5" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`;
      row.innerHTML = `
        <div class="col-index">${isPlaying ? svgPlaySmall : (i + 1)}</div>
        <div class="col-img">${imgHtml}</div>
        <div class="col-title">${window.escapeHTML(track.title)}</div>
        <div class="col-artist">${window.escapeHTML(track.artist)}</div>
        <div class="col-album">${window.escapeHTML(track.album)}</div>
        <div class="col-time">${window.formatTime(track.duration)}</div>
      `;
      fragment.appendChild(row);
    }
    container.appendChild(fragment);
  }
}

window.Tracklist = new TracklistManager();