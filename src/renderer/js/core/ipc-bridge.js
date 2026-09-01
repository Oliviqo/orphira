/**
 * COSMIC PLAYER - IPC BRIDGE MANAGER
 * Слушатель событий от главного процесса Electron и реактивное обновление UI
 */
class IpcBridgeManager {
  init() {
    // Инкрементальное удаление трека наблюдателем без пересканирования всей папки
    if (window.api?.watcher) {
 window.api.watcher.onRemoved(({ trackId, updatedLibrary }) => {
 const isCurrentPlaying = trackId === window.state.currentTrackId;

 // 1. Корректировка Shuffle-колоды
 if (Array.isArray(window.state.playbackShuffledList)) {
 const deleteShuffledIdx = window.state.playbackShuffledList.findIndex(t => t.id === trackId);

 if (deleteShuffledIdx !== -1) {
 if (deleteShuffledIdx <= window.state.playbackShuffledIndex) {
 window.state.playbackShuffledIndex = Math.max(
 -1,
 window.state.playbackShuffledIndex - 1
 );
 }

 window.state.playbackShuffledList =
 window.state.playbackShuffledList.filter(t => t.id !== trackId);
 }
 }

 // 2. Очистка основных списков
 window.state.library = updatedLibrary || [];
 window.state.queue = window.state.queue.filter(t => t.id !== trackId);
 window.state.playbackList = window.state.playbackList.filter(t => t.id !== trackId);

 if (window.Playlists) {
 window.Playlists.cleanOrphanTracks();
 }

 // 3. Если играющий трек удален извне
 if (isCurrentPlaying) {
 if (window.AudioEngine) {
 window.AudioEngine.pause();

 if (window.AudioEngine.playerA?.audio) {
 window.AudioEngine.playerA.audio.src = '';
 }

 if (window.AudioEngine.playerB?.audio) {
 window.AudioEngine.playerB.audio.src = '';
 }
 }

 if (window.state.playbackList.length > 0) {
 window.State.playNext();
 } else {
 window.state.currentTrackId = null;
 window.state.currentIndex = -1;
 window.State.loadTrackToUI(null, true);
 }
 }

 this.refreshUI();
 });

      // Инкрементальное добавление одиночного нового трека
      window.api.watcher.onAdded(({ track, updatedLibrary }) => {
        window.state.library = updatedLibrary || [];
        
        // Подсветка / визуальное уведомление пользователя
        if (window.Toast && track) {
          window.Toast.success(`Добавлен новый трек: ${track.artist} — ${track.title}`);
        }
        
        this.refreshUI();
      });

      // Инкрементальное обновление тегов одиночного трека
      window.api.watcher.onUpdated(({ track, updatedLibrary }) => {
        window.state.library = updatedLibrary || [];
        if (track && track.id === window.state.currentTrackId) {
          if (window.State?.loadTrackToUI) {
            window.State.loadTrackToUI(track, false);
          }
        }
        this.refreshUI();
      });
    }

    // Прогресс сканирования папок
    window.api.scanner.onProgress((data) => {
      const titleEl = document.getElementById('ui-title');
      if (titleEl) titleEl.textContent = `Scanning: ${data.current}/${data.total}`;
    });

    // Завершение сканирования
    window.api.scanner.onComplete((newLib) => {
      window.state.library = newLib;
      if (window.state.activeNav === 'library') {
        window.state.currentList = [...window.state.library];
      }
      if (window.Playlists) window.Playlists.cleanOrphanTracks();
      if (window.pendingImport && window.pendingImport.action === 'playlist') {
        const importedPaths = window.pendingImport.paths || [];
        const importedTracks = newLib.filter(track => {
          if (!track || !track.path) return false;
          const normTrackPath = track.path.replace(/\\/g, '/').toLowerCase();
          return importedPaths.some(p => {
            let normImportPath = p.replace(/\\/g, '/').toLowerCase();
            if (normTrackPath === normImportPath) return true;
            if (!normImportPath.endsWith('/')) {
              normImportPath += '/';
            }
            return normTrackPath.startsWith(normImportPath);
          });
        });
        const newPlaylist = {
          id: Date.now().toString(),
          name: window.pendingImport.name,
          tracks: importedTracks.map(t => t.id)
        };
        window.state.playlists.push(newPlaylist);
        window.api.db.savePlaylists(window.state.playlists);
        if (window.Playlists) window.Playlists.render();
        if (window.Toast) window.Toast.success(`Плейлист "${newPlaylist.name}" создан!`);
      }
      window.pendingImport = null;
      this.refreshUI();
    });

 if (
 window.api?.scanner?.onLibraryDataUpdated
 ) {
 window.api.scanner.onLibraryDataUpdated(
 (updatedLibrary) => {
 if (!Array.isArray(updatedLibrary)) {
 return;
 }

 window.state.library =
 updatedLibrary;

 const freshById =
 new Map(
 updatedLibrary
 .filter(track => track?.id)
 .map(track => [
 track.id,
 track
 ])
 );

 if (
 Array.isArray(
 window.state.playbackList
 )
 ) {
 window.state.playbackList =
 window.state.playbackList.map(track => {
 const fresh =
 freshById.get(track?.id);

 return fresh || track;
 });
 }

 if (
 Array.isArray(
 window.state.playbackShuffledList
 )
 ) {
 window.state.playbackShuffledList =
 window.state.playbackShuffledList.map(
 track => {
 const fresh =
 freshById.get(track?.id);

 return fresh || track;
 }
 );
 }

 if (
 Array.isArray(window.state.queue)
 ) {
 window.state.queue =
 window.state.queue.map(track => {
 const fresh =
 freshById.get(track?.id);

 if (!fresh) return track;

 return {
 ...fresh,
 queueId: track.queueId,
 played: track.played
 };
 });
 }

 const currentTrack =
 window.state.currentTrackId
 ? freshById.get(
 window.state.currentTrackId
 )
 : null;

 if (
 currentTrack &&
 window.State?.loadTrackToUI
 ) {
 window.State.loadTrackToUI(
 currentTrack,
 false
 );
 }

  if (
 window.ArtistView?.isOpen &&
 window.ArtistView.currentArtist &&
 window.ArtistIdentity
 ) {
 const refreshedArtist =
 window.ArtistIdentity.findById(
 window.ArtistView.currentArtist.id
 );

 if (refreshedArtist) {
 window.ArtistView.currentArtist =
 refreshedArtist;

 window.ArtistView.render();

 if (
 typeof window.ArtistView
 ._applyArtistPalette ===
 'function'
 ) {
 window.ArtistView
 ._applyArtistPalette(
 refreshedArtist
 );
 }
 }
 }

 const settingsVisible =
 !document
 .getElementById(
 'settings-view-container'
 )
 ?.classList.contains('hidden');

 if (
 window.AlbumView?.isOpen &&
 window.AlbumView.currentAlbumInfo
 ) {
 const currentIds =
 new Set(
 (
 window.AlbumView.currentAlbumTracks ||
 []
 )
 .map(track => track?.id)
 .filter(Boolean)
 );

 window.AlbumView.currentAlbumTracks =
 updatedLibrary.filter(
 track => currentIds.has(track.id)
 );

 window.AlbumView.currentAlbumInfo.tracks =
 [
 ...window.AlbumView.currentAlbumTracks
 ];

 const refreshedRelease =
 window.AlbumIdentity?.findReleaseByTrackId(
 updatedLibrary,
 window.AlbumView
 .currentAlbumTracks?.[0]?.id
 );

 if (refreshedRelease) {
 window.AlbumView.currentAlbumInfo =
 refreshedRelease;

 window.AlbumView.currentAlbumTracks =
 [...refreshedRelease.tracks];
 }

 window.AlbumView.renderLeftMeta(
 window.AlbumView.currentAlbumInfo
 );

 window.AlbumView.renderTracklist();

 if (
 typeof window.AlbumView
 ._applyAlbumPalette === 'function'
 ) {
 window.AlbumView._applyAlbumPalette(
 window.AlbumView.currentAlbumInfo
 );
 }
 } else if (settingsVisible) {
 if (window.SettingsView) {
 window.SettingsView.renderCategory(
 window.SettingsView.currentCat ||
 'tools'
 );
 }
 } else if (
 window.state.activeNav === 'library'
 ) {
 if (window.LibraryViews) {
 window.LibraryViews.switchView(
 window.LibraryViews.currentView ||
 'tracks'
 );
 }
 } else if (
 window.state.activeNav === 'queue'
 ) {
 window.state.currentList =
 [...window.state.queue];

 if (window.Tracklist) {
 window.Tracklist.render();
 }
 } else if (window.Playlists) {
 window.state.currentList =
 window.Playlists.getPlaylistTracks(
 window.state.activeNav
 );

 if (window.Tracklist) {
 window.Tracklist.render();
 }
 }

 if (window.Playlists) {
 window.Playlists.render();
 }

 if (window.QueuePanel) {
 window.QueuePanel.update();
 }

 if (window.Search) {
 window.Search.clearCache();
 }
 }
 );
 }

 // Медиа-клавиши клавиатуры и трея
 window.api.media.onPlayPause(() => document.getElementById('btn-play-pause')?.click());
 window.api.media.onNext(() => window.State.playNext());
 window.api.media.onPrev(() => window.State.playPrev());
 if (window.api?.media?.onToggleMute) {
 window.api.media.onToggleMute(() => document.getElementById('btn-mute')?.click());
 }

    // Открытие внешних файлов через ОС
    window.api.events.onExternalFile((path) => {
      const t = window.state.library.find(x => x.path === path);
      if (t) window.State.playTrack(window.state.library.indexOf(t));
    });

    // Анимации потери и получения фокуса окном
    window.api.window.onBlurAnim(() => document.body.classList.add('window-fade'));
    window.api.window.onFocus(() => document.body.classList.remove('window-fade'));
    if (window.api?.window?.onFullscreenChange) {
      window.api.window.onFullscreenChange((isFS) => {
        document.body.classList.toggle('is-window-fullscreen', isFS);
      });
    }

    // Подготовка к уходу ОС в сон: ставим на паузу и сохраняем точную позицию трека
    if (window.api?.events?.onPowerSuspend) {
      window.api.events.onPowerSuspend(() => {
        if (window.AudioEngine) {
          window.AudioEngine.pause();
          const audio = window.AudioEngine.audioElement;
          if (audio && window.state?.config?.lastState) {
            window.state.config.lastState.currentTime = audio.currentTime;
            window.api.db.saveConfig(window.state.config);
          }
        }
      });
    }
  }

  /**
   * Единый метод реактивного обновления интерфейса при любых изменениях в файловой системе
   */
  refreshUI() {
    // 1. Если активен текстовый поиск — сбрасываем кэш и перевыполняем его
    const searchQuery = window.Search?.inputEl?.value?.trim() || '';
    if (searchQuery.length > 0 && window.Search) {
      window.Search.searchCache.clear();
      window.Search.executeSearch(searchQuery);
      return;
    }

    // 2. Если открыт раздел "Моя Музыка"
    if (window.state.activeNav === 'library') {
      if (window.LibraryViews) {
        window.LibraryViews.switchView(window.LibraryViews.currentView || 'tracks');
      } else {
        window.state.currentList = [...window.state.library];
        if (window.Tracklist) window.Tracklist.render();
      }
    } else if (window.state.activeNav === 'queue') {
      if (window.Tracklist) window.Tracklist.render();
    } else if (window.Playlists) {
      window.state.currentList = window.Playlists.getPlaylistTracks(window.state.activeNav);
      if (window.Tracklist) window.Tracklist.render();
    }

    // 3. Синхронизация списков плейлистов, очереди и статистики настроек
    if (window.Playlists) window.Playlists.render();
    if (window.QueuePanel) window.QueuePanel.update();
  }
}

window.IpcBridge = new IpcBridgeManager();