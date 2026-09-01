/**
 * COSMIC PLAYER - CONTEXT MENU MANAGER
 * Контекстные меню для треков и плейлистов
 */

window.contextPlaylistId = null;

class ContextMenuManager {
  constructor() {
    this.closeTimer = null;
    this.gracePeriod = 350;
    this.activeTrackRow = null;
    this.trackMenu = null;
    this.plMenu = null;
  }

  init() {
    this.trackMenu = document.getElementById('custom-context-menu');
    this.plMenu = document.getElementById('playlist-context-menu');

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) this.hideAll();
    });

    if (this.trackMenu) {
      this.trackMenu.addEventListener('mouseenter', () => this._cancelCloseTimer());
      this.trackMenu.addEventListener('mouseleave', () => this._startCloseTimer());
    }
    if (this.plMenu) {
      this.plMenu.addEventListener('mouseenter', () => this._cancelCloseTimer());
      this.plMenu.addEventListener('mouseleave', () => this._startCloseTimer());
    }

    document.getElementById('ctx-play-next')?.addEventListener('click', () => {
      const targets = (window.state.contextTracks && window.state.contextTracks.length > 0)
        ? window.state.contextTracks
        : (window.state.contextTrack ? [window.state.contextTrack] : []);
      if (targets.length > 0 && window.State) {
        window.State.addToQueueNext(targets);
        this.hideAll();
      }
    });

    document.getElementById('ctx-add-queue-end')?.addEventListener('click', () => {
      const targets = (window.state.contextTracks && window.state.contextTracks.length > 0)
        ? window.state.contextTracks
        : (window.state.contextTrack ? [window.state.contextTrack] : []);
      if (targets.length > 0 && window.State) {
        window.State.addToQueueEnd(targets);
        this.hideAll();
      }
    });

    document.getElementById('ctx-remove-playlist')?.addEventListener('click', () => {
      const track = window.state.contextTrack;
      const currentPlId = window.state.activeNav;
      if (track && currentPlId !== 'library' && currentPlId !== 'queue') {
        if (window.Playlists) window.Playlists.removeTrackFromPlaylist(currentPlId, track.id);
      }
      this.hideAll();
    });

    document.getElementById('ctx-show-folder')?.addEventListener('click', () => {
      const track = window.state.contextTrack;
      this.hideAll();
      if (track && track.path) window.api.os.showItem(track.path);
    });

    document.getElementById('ctx-delete-disk')?.addEventListener('click', () => {
      const trackToDelete = window.state.contextTrack;
      this.hideAll();
      if (trackToDelete) {
        showConfirm('DANGER: Delete from Disk', `Are you sure you want to permanently delete "${trackToDelete.title}"?`, true, async (yes) => {
          if (yes) {
            const isCurrentPlaying = trackToDelete.id === window.state.currentTrackId;

            // Если удаляемый трек играет прямо сейчас — останавливаем плеер и освобождаем файл
            if (isCurrentPlaying && window.AudioEngine) {
              window.AudioEngine.pause();
              if (window.AudioEngine.playerA?.audio) window.AudioEngine.playerA.audio.src = '';
              if (window.AudioEngine.playerB?.audio) window.AudioEngine.playerB.audio.src = '';
            }

            // 1. Корректировка Shuffle-колоды
            if (Array.isArray(window.state.playbackShuffledList)) {
              const deleteShuffledIdx = window.state.playbackShuffledList.findIndex(t => t.id === trackToDelete.id);
              if (deleteShuffledIdx !== -1) {
                if (deleteShuffledIdx < window.state.playbackShuffledIndex) {
                  window.state.playbackShuffledIndex--;
                }
                window.state.playbackShuffledList = window.state.playbackShuffledList.filter(t => t.id !== trackToDelete.id);
              }
            }

            // 2. Вырезаем трек из всех списков
            window.state.library = window.state.library.filter(t => t.id !== trackToDelete.id);
            window.state.queue = window.state.queue.filter(t => t.id !== trackToDelete.id);
            window.state.playbackList = window.state.playbackList.filter(t => t.id !== trackToDelete.id);
            window.api.db.saveLibrary(window.state.library);

            // 3. Если играл этот трек — переключаем на следующий
            if (isCurrentPlaying) {
              if (window.state.playbackList.length > 0) {
                window.State.playNext();
              } else {
                window.state.currentTrackId = null;
                window.state.currentIndex = -1;
                window.State.loadTrackToUI(null, true);
              }
            }

            // 4. Обновляем отображение UI
            if (window.Playlists) {
              window.Playlists.cleanOrphanTracks();
              window.Playlists.switchNav(window.state.activeNav, document.querySelector('.active'));
            }
            if (window.Tracklist) window.Tracklist.render();

            if (window.Toast) window.Toast.warn(`Файл "${trackToDelete.title}" удален`);

            // 5. Физическое удаление файла с диска
            await window.api.os.trashItem(trackToDelete.path);
          }
        });
      }
    });

        document.getElementById('ctx-pl-add-queue-next')?.addEventListener('click', () => {
      const plId = window.contextPlaylistId;
      this.hideAll();
      if (plId && window.Playlists && window.State) {
        const tracks = window.Playlists.getPlaylistTracks(plId);
        if (tracks && tracks.length > 0) {
          window.State.addToQueueNext(tracks);
        }
      }
    });

    document.getElementById('ctx-pl-add-queue-end')?.addEventListener('click', () => {
      const plId = window.contextPlaylistId;
      this.hideAll();
      if (plId && window.Playlists && window.State) {
        const tracks = window.Playlists.getPlaylistTracks(plId);
        if (tracks && tracks.length > 0) {
          window.State.addToQueueEnd(tracks);
        }
      }
    });

    document.getElementById('ctx-pl-rename')?.addEventListener('click', () => {
      const pl = window.state.playlists.find(p => p.id === window.contextPlaylistId);
      this.hideAll();
      if (pl) {
        showPrompt('Rename Playlist:', pl.name, (newName) => {
          if (newName && newName.trim() !== '') {
            pl.name = newName.trim();
            window.api.db.savePlaylists(window.state.playlists);
            if (window.Playlists) window.Playlists.render();
             if (
 window.PluginRuntime
 ?.ready
 ) {
 window.PluginRuntime.emit(
 'library.ready',
 {
 count:
 window.state
 ?.library
 ?.length ||
 0
 }
 );

 window.PluginRuntime.emit(
 'queue.changed',
 {
 count:
 window.state
 ?.queue
 ?.length ||
 0
 }
 );
 }
          }
        });
      }
    });

    document.getElementById('ctx-pl-pin')?.addEventListener('click', () => {
      const pl = window.state.playlists.find(p => p.id === window.contextPlaylistId);
      this.hideAll();
      if (pl && window.Playlists) window.Playlists.togglePin(pl.id);
    });

    document.getElementById('ctx-pl-download-covers')?.addEventListener('click', () => {
      const plId = window.contextPlaylistId;
      this.hideAll();
      if (plId && window.Modals?.openBatchModal) {
        window.Modals.openBatchModal('covers', plId);
      }
    });

    document.getElementById('ctx-pl-enrich-meta')?.addEventListener('click', () => {
      const plId = window.contextPlaylistId;
      this.hideAll();
      if (plId && window.Modals?.openBatchModal) {
        window.Modals.openBatchModal('metadata', plId);
      }
    });

    document.getElementById('ctx-pl-clear-cache')?.addEventListener('click', () => {
      const pl = window.state.playlists.find(p => p.id === window.contextPlaylistId);
      this.hideAll();
      if (pl) {
        const modal = document.getElementById('clear-cache-modal');
        if (modal) {
          modal.dataset.plId = pl.id;

          const titleEl = modal.querySelector('.modal-header span');
          const descEl = modal.querySelector('p');
          if (titleEl) titleEl.textContent = `Очистка данных: «${pl.name}»`;
          if (descEl) descEl.textContent = `Выберите, что именно вы хотите удалить для треков из плейлиста «${pl.name}». Музыкальные файлы на ПК останутся нетронутыми.`;

          const cbLib = document.getElementById('cb-cache-library')?.closest('label');
          const cbFolders = document.getElementById('cb-cache-folders')?.closest('label');
          if (cbLib) cbLib.style.display = 'none';
          if (cbFolders) cbFolders.style.display = 'none';

          modal.classList.remove('hidden');
        }
      }
    });

    document.getElementById('ctx-pl-delete')?.addEventListener('click', () => {      const pl = window.state.playlists.find(p => p.id === window.contextPlaylistId);
      this.hideAll();
      if (pl) {
        showConfirm('Delete Playlist', `Delete playlist "${pl.name}"? The tracks will remain in your library.`, false, (yes) => {
          if (yes) {
            window.state.playlists = window.state.playlists.filter(p => p.id !== window.contextPlaylistId);
            window.api.db.savePlaylists(window.state.playlists);
            if (window.Playlists) {
              window.Playlists.render();
              if (window.state.activeNav === window.contextPlaylistId) {
                window.Playlists.switchNav('library', document.getElementById('nav-library'));
              }
            }
          }
        });
      }
    });
  }

  showTrackMenu(e, track, tracksArray = null) {
    this._cancelCloseTimer();
    window.state.contextTrack = track;
    window.state.contextTracks = (Array.isArray(tracksArray) && tracksArray.length > 0)
      ? tracksArray
      : (track ? [track] : []);
    this._highlightTrackRow(e.target.closest('.track-row'));
    if (!this.trackMenu) return;

    let left = e.pageX;
    let top = e.pageY;
    const menuWidth = 190;
    const menuHeight = 180;

    // ИСПРАВЛЕНИЕ: Проверка границ экрана
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

    this.trackMenu.style.left = `${left}px`;
    this.trackMenu.style.top = `${top}px`;

    const removeBtn = document.getElementById('ctx-remove-playlist');
    const isInsidePlaylist = window.state.activeNav !== 'library' && window.state.activeNav !== 'queue';
    if (removeBtn) {
      if (isInsidePlaylist) removeBtn.classList.remove('hidden');
      else removeBtn.classList.add('hidden');
    }

    const subMenu = document.getElementById('ctx-playlist-submenu');
    if (subMenu) {
      subMenu.innerHTML = '';
      const targets = (window.state.contextTracks && window.state.contextTracks.length > 0)
        ? window.state.contextTracks
        : (track ? [track] : []);

      // Если плейлистов больше 4 — добавляем быстрый поиск
      if (window.state.playlists.length > 4) {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'ctx-pl-search';
        searchInput.placeholder = 'Поиск плейлиста...';
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('input', (e) => {
          const filterQ = e.target.value.trim().toLowerCase();
          const convQ = window.convertKeyboardLayout ? window.convertKeyboardLayout(filterQ).toLowerCase() : '';
          
          subMenu.querySelectorAll('li:not(.ctx-search-container)').forEach(li => {
            const name = (li.textContent || '').toLowerCase();
            const match = !filterQ || name.includes(filterQ) || (convQ && name.includes(convQ)) || (window.fuzzyMatch && window.fuzzyMatch(name, filterQ).match);
            li.style.display = match ? 'block' : 'none';
          });
        });
        subMenu.appendChild(searchInput);
      }

      window.state.playlists.forEach(pl => {
        const li = document.createElement('li');
        li.textContent = pl.name;
        li.addEventListener('click', () => {
          let addedCount = 0;
          targets.forEach(t => {
            if (t && t.id && !pl.tracks.includes(t.id)) {
              pl.tracks.push(t.id);
              addedCount++;
            }
          });
          if (addedCount > 0) {
            window.api.db.savePlaylists(window.state.playlists);
            if (window.Playlists) window.Playlists.render();
            if (window.Toast) {
              const msg = targets.length > 1
                ? `Добавлено ${addedCount} трек(ов) в плейлист "${pl.name}"`
                : `Добавлено в плейлист "${pl.name}"`;
              window.Toast.success(msg);
            }
          } else if (window.Toast) {
            window.Toast.info(`Все треки уже в плейлисте "${pl.name}"`);
          }
          this.hideAll();
        });
        subMenu.appendChild(li);
      });

      if (window.state.playlists.length === 0) {
        subMenu.innerHTML = '<li style="opacity:0.5">No playlists</li>';
      }
    }

     this._renderPluginTrackActions(
 track
 );

    if (this.plMenu) {
      this.plMenu.classList.remove('visible');
      this.plMenu.classList.add('hidden');
    }
    this.trackMenu.classList.remove('hidden');
    this.trackMenu.classList.add('visible');
  

    
  }



  showPlaylistMenu(e, plId) {
    this._cancelCloseTimer();
    window.contextPlaylistId = plId;

    const pinBtn = document.getElementById('ctx-pl-pin');
    if (pinBtn) {
      const pl = window.state.playlists.find(p => p.id === plId);
      if (pl) {
        const key = pl.pinned ? 'ctx_pl_unpin' : 'ctx_pl_pin';
        const fallback = pl.pinned ? 'Открепить плейлист' : 'Закрепить плейлист';
        pinBtn.textContent = window.i18n?.t(key) || fallback;
      }
    }

    if (!this.plMenu) return;
    let left = e.pageX;
    let top = e.pageY;
    this.plMenu.style.left = `${left}px`;
    this.plMenu.style.top = `${top}px`;

    if (this.trackMenu) {
      this.trackMenu.classList.remove('visible');
      this.trackMenu.classList.add('hidden');
    }
    this.plMenu.classList.remove('hidden');
    this.plMenu.classList.add('visible');
  }

  hideAll() {
    this._cancelCloseTimer();
    this._clearHighlight();
    if (this.trackMenu) {
      this.trackMenu.classList.remove('visible');
      this.trackMenu.classList.add('hidden');
    }
    if (this.plMenu) {
      this.plMenu.classList.remove('visible');
      this.plMenu.classList.add('hidden');
    }
  }

  _highlightTrackRow(rowEl) {
    this._clearHighlight();
    if (rowEl) {
      this.activeTrackRow = rowEl;
      this.activeTrackRow.classList.add('context-active');
      this.activeTrackRow._onMouseLeave = () => this._startCloseTimer();
      this.activeTrackRow._onMouseEnter = () => this._cancelCloseTimer();
      this.activeTrackRow.addEventListener('mouseleave', this.activeTrackRow._onMouseLeave);
      this.activeTrackRow.addEventListener('mouseenter', this.activeTrackRow._onMouseEnter);
    }
  }

  _clearHighlight() {
    if (this.activeTrackRow) {
      if (this.activeTrackRow._onMouseLeave) {
        this.activeTrackRow.removeEventListener('mouseleave', this.activeTrackRow._onMouseLeave);
      }
      if (this.activeTrackRow._onMouseEnter) {
        this.activeTrackRow.removeEventListener('mouseenter', this.activeTrackRow._onMouseEnter);
      }
      this.activeTrackRow.classList.remove('context-active');
      this.activeTrackRow = null;
    }
  }

  _startCloseTimer() {
    this._cancelCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.hideAll();
    }, this.gracePeriod);
  }

  _cancelCloseTimer() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

 _renderPluginTrackActions(
 track
 ) {
 if (!this.trackMenu) {
 return;
 }

 this.trackMenu
 .querySelectorAll(
 '.plugin-context-action'
 )
 .forEach(
 element =>
 element.remove()
 );

 const actions =
 window.PluginRuntime
 ?.getContextActions?.() ||
 [];

 if (
 actions.length === 0
 ) {
 return;
 }

 const divider =
 document.createElement(
 'div'
 );

 divider.className =
 'ctx-divider plugin-context-action';

 this.trackMenu
 .appendChild(
 divider
 );

 for (
 const action
 of actions
 ) {
 const item =
 document.createElement(
 'li'
 );

 item.className =
 'plugin-context-action';

 item.textContent =
 action.title;

 item.addEventListener(
 'click',
 async () => {
 this.hideAll();

 await window.PluginRuntime
 ?.invokeCallback(
 action,
 {
 track:
 window
 .OrphiraPluginApi
 .safeTrack(track)
 }
 );
 }
 );

 this.trackMenu
 .appendChild(item);
 }
 }
  
}

window.ContextMenu = new ContextMenuManager();