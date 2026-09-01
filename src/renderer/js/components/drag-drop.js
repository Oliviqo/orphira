/**
 * COSMIC PLAYER - DRAG & DROP MANAGER
 * Перетаскивание папок, файлов .m3u и перенос треков между плейлистами
 */
window.pendingImport = null;

class DragDropManager {
  init() {
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      let dragCounter = 0;
      const isExternalFileDrag = (e) => {
        const types = Array.from(e.dataTransfer?.types || []);
        return types.includes('Files');
      };

      dropZone.addEventListener('dragenter', (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        dragCounter++;
        dropZone.classList.add('drag-active');
      });

      dropZone.addEventListener('dragover', (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
      });

      dropZone.addEventListener('dragleave', (e) => {
        if (!isExternalFileDrag(e)) return;
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dropZone.classList.remove('drag-active');
        }
      });

      dropZone.addEventListener('drop', async (e) => {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
        const files = Array.from(e.dataTransfer.files || []);
        
        const rawPaths = files.map(f => {
          try {
            if (f.path) return f.path;
            if (window.api?.os?.getPathForFile) return window.api.os.getPathForFile(f);
          } catch (err) {}
          return f.path || '';
        }).filter(Boolean);

        // Проверка через Главный процесс Electron
        let validPaths = rawPaths;
        if (window.api?.os?.validatePaths) {
          validPaths = await window.api.os.validatePaths(rawPaths);
        }

        if (validPaths.length === 0) {
          if (window.Toast) {
            window.Toast.warn('Поддерживаются только аудиофайлы и папки с музыкой');
          }
          return;
        }

        if (validPaths.length > 0) {
          const m3uFile = validPaths.find(p => /\.(m3u|m3u8)$/i.test(p));
            if (m3uFile) {
                const content = await window.api.os.readLyrics(m3uFile);
                const playlistTracks = window.parseM3U(content, m3uFile);
                if (playlistTracks.length > 0) {
              this.saveImportedPathsToConfig(playlistTracks);
              window.api.scanner.start(playlistTracks);
              return;
            }
          }
          window.pendingImport = {
            paths: validPaths,
            name: files[0].name || 'Imported Files',
            action: null
          };
          const titleEl = document.getElementById('import-title');
          if (titleEl) titleEl.textContent = `Detected: "${window.pendingImport.name}"`;
          document.getElementById('import-modal')?.classList.remove('hidden');
        }
      });
    }

    // Дроп трека на кнопку "Моя Музыка" (Удаляет трек из текущего плейлиста)
    const navLibrary = document.getElementById('nav-library');
    if (navLibrary) {
      navLibrary.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (window.state.activeNav !== 'library' && window.state.activeNav !== 'queue') {
          navLibrary.classList.add('drag-active');
        }
      });
      navLibrary.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      navLibrary.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        if (!navLibrary.contains(e.relatedTarget)) {
          navLibrary.classList.remove('drag-active');
        }
      });
      navLibrary.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navLibrary.classList.remove('drag-active');
        const trackId = e.dataTransfer.getData('text/plain');
        const currentPlId = window.state.activeNav;
        if (trackId && currentPlId !== 'library' && currentPlId !== 'queue') {
          if (window.Playlists) {
            window.Playlists.removeTrackFromPlaylist(currentPlId, trackId);
          }
        }
      });
    }

    // Дроп треков на плейлисты в сайдбаре
    const plContainer = document.getElementById('playlists-container');
    if (plContainer) {
      plContainer.addEventListener('dragover', (e) => {
        if (window.Playlists && window.Playlists.draggedPlId) return;
        e.preventDefault();
        e.stopPropagation();
        const item = e.target.closest('.playlist-item');
        document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drag-active'));
        if (item) item.classList.add('drag-active');
      });
      plContainer.addEventListener('dragleave', (e) => {
        if (window.Playlists && window.Playlists.draggedPlId) return;
        e.stopPropagation();
        const item = e.target.closest('.playlist-item');
        if (item && !item.contains(e.relatedTarget)) {
          item.classList.remove('drag-active');
        }
      });
    plContainer.addEventListener('drop', (e) => {
      if (window.Playlists && window.Playlists.draggedPlId) return;
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drag-active'));
      const rawData = e.dataTransfer.getData('text/plain');
      const plId = e.target.closest('.playlist-item')?.dataset.id;
      if (rawData && plId) {
        const pl = window.state.playlists.find(p => p.id === plId);
        if (pl) {
          let trackIds = [];
          try {
            const parsed = JSON.parse(rawData);
            trackIds = Array.isArray(parsed) ? parsed : [rawData];
          } catch (err) {
            trackIds = [rawData];
          }
          let addedCount = 0;
          trackIds.forEach(id => {
            if (id && !pl.tracks.includes(id)) {
              pl.tracks.push(id);
              addedCount++;
            }
          });
          if (addedCount > 0) {
            window.api.db.savePlaylists(window.state.playlists);
            if (window.Playlists) window.Playlists.render();
            if (window.Toast) {
              const msg = trackIds.length > 1 
                ? `Добавлено ${addedCount} трек(ов) в "${pl.name}"` 
                : `Добавлено в плейлист "${pl.name}"`;
              window.Toast.success(msg);
            }
          }
        }
      }
    });
    }

    // Обработчики модального окна импорта
    document.getElementById('btn-import-lib')?.addEventListener('click', () => {
      if (window.pendingImport) {
        this.saveImportedPathsToConfig(window.pendingImport.paths);
        window.api.scanner.start(window.pendingImport.paths);
        document.getElementById('import-modal')?.classList.add('hidden');
      }
    });

    document.getElementById('btn-import-pl')?.addEventListener('click', () => {
      if (window.pendingImport) {
        window.pendingImport.action = 'playlist';
        this.saveImportedPathsToConfig(window.pendingImport.paths);
        window.api.scanner.start(window.pendingImport.paths);
        document.getElementById('import-modal')?.classList.add('hidden');
      }
    });

    document.getElementById('btn-import-cancel')?.addEventListener('click', () => {
      window.pendingImport = null;
      document.getElementById('import-modal')?.classList.add('hidden');
    });
  }

  saveImportedPathsToConfig(paths) {
    if (!window.state.config.libraryPaths) window.state.config.libraryPaths = [];
    let updated = false;
    const AUDIO_FILE_REGEX = /\.(mp3|flac|wav|ogg|m4a|aac|opus|m3u|m3u8)$/i;

    paths.forEach(p => {
      if (!p || typeof p !== 'string') return;
      let folderPath = p;
      if (AUDIO_FILE_REGEX.test(p)) {
        const normalized = p.replace(/\\/g, '/');
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash !== -1) {
          folderPath = normalized.substring(0, lastSlash);
        }
      }
      if (folderPath && !window.state.config.libraryPaths.includes(folderPath)) {
        window.state.config.libraryPaths.push(folderPath);
        updated = true;
      }
    });

    if (updated) {
      window.api.db.saveConfig(window.state.config);
      if (window.Modals) window.Modals.renderFolderList();
    }
  }
}

window.DragDrop = new DragDropManager();