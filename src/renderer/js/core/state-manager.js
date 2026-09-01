/**
 * COSMIC PLAYER - STATE MANAGER
 * Менеджер логики состояния
 */
class StateManager {
 async init() {
 window.SplashProgress?.setStage(
 'splash_starting',
 5
 );

 window.SplashProgress?.setStage(
 'splash_config',
 12
 );

 let loadedConfig = null;

 try {
 loadedConfig =
 await window.api.db.getConfig();
 } catch (error) {
 console.error(
 '[StateManager] Не удалось загрузить конфигурацию:',
 error
 );
 }

 if (
 !loadedConfig ||
 typeof loadedConfig !== 'object' ||
 Array.isArray(loadedConfig)
 ) {
 loadedConfig = {
 lastState: {}
 };
 }

 if (
 !loadedConfig.lastState ||
 typeof loadedConfig.lastState !== 'object'
 ) {
 loadedConfig.lastState = {};
 }

 window.state.config =
 loadedConfig;

 this.applyConfig(
 window.state.config
 );

 if (window.api?.app?.getIdentity) {
 try {
 window.state.appIdentity =
 await window.api.app.getIdentity();

 window.state.appVersion =
 window.state.appIdentity?.version ||
 '';
 } catch (error) {
 console.warn(
 '[StateManager] Не удалось получить идентичность приложения:',
 error
 );
 }
 } else if (window.api?.app?.getVersion) {
 try {
 window.state.appVersion =
 await window.api.app.getVersion();
 } catch (error) {
 console.warn(
 '[StateManager] Не удалось получить версию приложения:',
 error
 );
 }
 }

 window.SplashProgress?.setStage(
 'splash_library',
 25
 );

 window.state.library =
 await window.api.db.getLibrary();

 if (
 window.api?.shuffleDiagnostics
 ?.writeLibrary
 ) {
 const analyticsLibrary =
 window.state.library.map(
 track => ({
 ...track,
 analyticsArtistCredits:
 window.ArtistIdentity
 ?.getTrackCredits(
 track
 )
 ?.map(
 credit =>
 credit.name
 ) || [
 track.artist ||
 'Unknown Artist'
 ]
 })
 );

 window.api.shuffleDiagnostics
 .writeLibrary(
 analyticsLibrary
 );

 }

 window.SplashProgress?.setStage(
 'splash_playlists',
 52
 );

 window.state.playlists =
 await window.api.db.getPlaylists();

 window.SplashProgress?.setStage(
 'splash_interface',
 62
 );

 window.state.currentList =
 [...window.state.library];

 window.state.playbackList =
 [...window.state.library];

 window.state.playbackSource =
 'library';

 const remember =
 window.state.config?.rememberQueue ??
 true;

 const savedQueue =
 window.state.config?.lastState?.queue;

 const savedQueueId =
 window.state.config?.lastState?.currentQueueId;

 if (
 remember &&
 Array.isArray(savedQueue) &&
 savedQueue.length > 0
 ) {
 window.state.queue =
 savedQueue
 .map(item => {
 const targetId =
 typeof item === 'object' &&
 item !== null
 ? item.id
 : item;

 const targetQueueId =
 typeof item === 'object' &&
 item !== null
 ? item.queueId
 : null;

 const isPlayed =
 typeof item === 'object' &&
 item !== null
 ? Boolean(item.played)
 : false;

 const track =
 window.state.library.find(
 t => t.id === targetId
 );

 if (!track) return null;

 return {
 ...track,
 queueId:
 targetQueueId ||
 (
 'q_' +
 Math.random()
 .toString(36)
 .substring(2, 9) +
 '_' +
 Date.now()
 ),
 played: isPlayed
 };
 })
 .filter(Boolean);

 window.state.currentQueueId =
 savedQueueId || null;
 } else {
 window.state.queue = [];
 window.state.currentQueueId = null;
 }

 if (window.state.shuffle) {
 this.generateShuffledList();
 }

 window.SplashProgress?.setStage(
 'splash_interface',
 68
 );
 }

  saveQueueToConfig() {
    if (!window.state?.config) return;
    window.state.config.lastState = window.state.config.lastState || {};
    const remember = window.state.config?.rememberQueue ?? true;
    if (remember) {
      window.state.config.lastState.queue = (window.state.queue || []).map(t => ({
        id: t.id,
        queueId: t.queueId,
        played: Boolean(t.played)
      })).filter(item => item && item.id);
      window.state.config.lastState.currentQueueId = window.state.currentQueueId || null;
    } else {
      window.state.config.lastState.queue = [];
      window.state.config.lastState.currentQueueId = null;
    }
    window.api.db.saveConfig(window.state.config);
  }
 
  applyConfig(config) {
    document.documentElement.setAttribute('data-theme', config.theme || 'dark');
    window.applyFont(config.font || 'outfit');
    if (config.fontSize) {
      document.documentElement.style.zoom = `${config.fontSize / 100}`;
    }
    const savedSpeed = config.lastState?.playbackRate ?? 1.0;
    const speedInput = document.getElementById('ui-speed');
    const speedBtn = document.getElementById('btn-speed-text');
    if (speedInput) speedInput.value = savedSpeed;
    if (speedBtn) speedBtn.textContent = `${savedSpeed.toFixed(2).replace(/\.00$/, '.0')}x`;
    if (window.AudioEngine) window.AudioEngine.setPlaybackRate(savedSpeed);
    const vol = config.lastState?.volume ?? 50;
    const volInput = document.getElementById('ui-volume');
    if (volInput) volInput.value = vol;
    if (window.AudioEngine) window.AudioEngine.setVolume(vol / 100);
    window.state.shuffle = config.lastState?.shuffle || false;
    window.state.repeat = config.lastState?.repeat || 0;
    this.updateModeUI();
  }
 // Инициализация отображения кнопок Shuffle и Repeat
 updateModeUI() {
 if (window.FullscreenPlayer && typeof window.FullscreenPlayer.syncModeButtons === 'function') {
 window.FullscreenPlayer.syncModeButtons();
 }
 const sBtn = document.getElementById('btn-shuffle');
 const rBtn = document.getElementById('btn-repeat');
 if (!sBtn || !rBtn) return;
 if (window.state.shuffle) sBtn.classList.add('active');
 else sBtn.classList.remove('active');
 const repeatPlaylistSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17
2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
 const repeatOneSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4
4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10l1.5-1v5"/><path d="M10.5 14h3"/></svg>`;
 if (window.state.repeat === 1) {
 rBtn.classList.add('active');
 rBtn.innerHTML = repeatPlaylistSVG;
 } else if (window.state.repeat === 2) {
 rBtn.classList.add('active');
 rBtn.innerHTML = repeatOneSVG;
 } else {
 rBtn.innerHTML = repeatPlaylistSVG;
 rBtn.classList.remove('active');
 }
 }
 generateShuffledList(startTrack = null, ignoreCurrentTrack = false) {
 if (!window.state.playbackList || window.state.playbackList.length === 0) {
 window.state.playbackShuffledList = [];
 window.state.playbackShuffledIndex = -1;
 return;
 }
 const list = [...window.state.playbackList];
 let firstTrack = startTrack;
 if (!firstTrack && !ignoreCurrentTrack && window.state.currentTrackId) {
 firstTrack = list.find(t => t.id === window.state.currentTrackId);
 }
 if (firstTrack) {
 const rest = list.filter(t => t.id !== firstTrack.id);
 const shuffledRest = window.fisherYatesShuffle(rest);
 window.state.playbackShuffledList = [firstTrack, ...shuffledRest];
 window.state.playbackShuffledIndex = 0;
 } else {
 window.state.playbackShuffledList = window.fisherYatesShuffle(list);
 window.state.playbackShuffledIndex = 0;
 }

  if (
 window.api?.shuffleDiagnostics
 ?.writeDeck &&
 window.state
 .playbackShuffledList
 .length > 0
 ) {
 window.api.shuffleDiagnostics
 .writeDeck(
 window.state.playbackShuffledList.map(
 track => ({
 ...track,
 analyticsArtistCredits:
 window.ArtistIdentity
 ?.getTrackCredits(
 track
 )
 ?.map(
 credit =>
 credit.name
 ) || [
 track.artist ||
 'Unknown Artist'
 ]
 })
 ),
 {
 source:
 window.state.playbackSource ||
 'library',
 currentTrackId:
 window.state.currentTrackId ||
 null
 }
 );
 }

 }
 
  addToQueueNext(tracksInput) {
    if (!tracksInput) return;
    const rawTracks = Array.isArray(tracksInput) ? tracksInput : [tracksInput];
    if (rawTracks.length === 0) return;
    if (!window.state.queue) window.state.queue = [];

    const tracks = rawTracks.map(t => ({
      ...t,
      queueId: 'q_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      played: false
    }));

    let insertIdx = 0;
    if (window.state.queue.length > 0) {
      if (window.state.currentQueueId) {
        const curIdx = window.state.queue.findIndex(t => t.queueId === window.state.currentQueueId);
        if (curIdx !== -1) {
          insertIdx = curIdx + 1;
        } else {
          insertIdx = window.state.queue.length;
        }
      } else {
        const lastPlayedIdx = window.state.queue.findLastIndex(t => t.played);
        if (lastPlayedIdx !== -1) {
          insertIdx = lastPlayedIdx + 1;
        } else {
          insertIdx = 0;
        }
      }
    }

    window.state.queue.splice(insertIdx, 0, ...tracks);
    this.saveQueueToConfig();
    if (window.QueuePanel) window.QueuePanel.update();
    if (window.Toast) {
      const rawName = tracks.length === 1 ? `"${tracks[0].title}"` : `${tracks.length} tracks`;
      const tmpl = window.i18n?.t('toast_play_next') || "Play Next: {name}";
      window.Toast.success(tmpl.replace('{name}', rawName));
    }
  }

  addToQueueEnd(tracksInput) {
    if (!tracksInput) return;
    const rawTracks = Array.isArray(tracksInput) ? tracksInput : [tracksInput];
    if (rawTracks.length === 0) return;
    if (!window.state.queue) window.state.queue = [];

    const tracks = rawTracks.map(t => ({
      ...t,
      queueId: 'q_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      played: false
    }));

    window.state.queue.push(...tracks);
    this.saveQueueToConfig();
    if (window.QueuePanel) window.QueuePanel.update();
    if (window.Toast) {
      const rawName = tracks.length === 1 ? `"${tracks[0].title}"` : `${tracks.length} tracks`;
      const tmpl = window.i18n?.t('toast_added_queue') || "Added to Queue: {name}";
      window.Toast.info(tmpl.replace('{name}', rawName));
    }
  }
  
  playNext() {
    const keepPlayed = window.state?.config?.queueKeepPlayed || false;

    if (window.state.queue && window.state.queue.length > 0) {
      let curIdx = -1;
      if (window.state.currentQueueId) {
        curIdx = window.state.queue.findIndex(t => t.queueId === window.state.currentQueueId);
        if (curIdx !== -1) {
          window.state.queue[curIdx].played = true;
        }
      }

      if (!keepPlayed) {
        if (curIdx !== -1) {
          window.state.queue.splice(0, curIdx + 1);
        } else if (window.state.queue[0].id === window.state.currentTrackId) {
          window.state.queue.shift();
        }
        if (window.state.queue.length > 0) {
          const nextQueueTrack = window.state.queue[0];
          this.saveQueueToConfig();
          if (window.QueuePanel) window.QueuePanel.update();
          return this.playTrack(nextQueueTrack, true);
        }
      } else {
        let searchStart = curIdx !== -1 ? curIdx + 1 : 0;
        const unplayedIdx = window.state.queue.findIndex((t, i) => i >= searchStart && !t.played);
        if (unplayedIdx !== -1) {
          const nextQueueTrack = window.state.queue[unplayedIdx];
          this.saveQueueToConfig();
          if (window.QueuePanel) window.QueuePanel.update();
          return this.playTrack(nextQueueTrack, true);
        }
      }
      this.saveQueueToConfig();
      if (window.QueuePanel) window.QueuePanel.update();
    }

    // Очередь полностью воспроизведена -> выход из очереди в основной список (playbackList)
    window.state.currentQueueId = null;

 if (
 window.PlaybackContext
 ?.isTemporaryActive()
 ) {
 const temporaryList =
 window.state.playbackList ||
 [];

 let temporaryFinished =
 false;

 if (window.state.shuffle) {
 const shuffledList =
 window.state
 .playbackShuffledList ||
 [];

 temporaryFinished =
 shuffledList.length === 0 ||
 window.state
 .playbackShuffledIndex >=
 shuffledList.length - 1;
 } else {
 temporaryFinished =
 temporaryList.length === 0 ||
 window.state.playbackIndex >=
 temporaryList.length - 1;
 }

 if (temporaryFinished) {
 window.PlaybackContext
 .restorePreviousAndContinue();

 return;
 }
 }

    if (window.state.repeat === 2 && window.state.currentTrackId) {
      const track = window.state.playbackList.find(t => t.id === window.state.currentTrackId);
      if (track) return this.playTrack(track);
    }

    if (window.state.shuffle) {
      if (!window.state.playbackShuffledList || window.state.playbackShuffledList.length === 0) {
        this.generateShuffledList();
      }
      let nextSIdx = window.state.playbackShuffledIndex + 1;
      if (nextSIdx >= window.state.playbackShuffledList.length) {
        if (window.state.repeat === 1) {
          this.generateShuffledList(null, true);
          nextSIdx = 0;
        } else {
          if (window.state.playbackSource !== 'library') {
            window.state.playbackSource = 'library';
            window.state.playbackList = [...window.state.library];
            this.generateShuffledList(null, true);
            nextSIdx = 0;
            if (window.Playlists?.updatePlayingHighlight) window.Playlists.updatePlayingHighlight();
          } else {
            this.generateShuffledList(null, true);
            nextSIdx = 0;
          }
        }
      }
      window.state.playbackShuffledIndex = nextSIdx;
      const nextTrack = window.state.playbackShuffledList[nextSIdx];
      if (nextTrack) this.playTrack(nextTrack);
      return;
    }

    if (window.state.playbackList.length === 0) return;
    let nextIdx = window.state.playbackIndex + 1;
    if (nextIdx >= window.state.playbackList.length) {
      if (window.state.repeat === 1) {
        nextIdx = 0;
      } else {
        if (window.state.playbackSource !== 'library') {
          window.state.playbackSource = 'library';
          window.state.playbackList = [...window.state.library];
          nextIdx = 0;
          if (window.Playlists?.updatePlayingHighlight) window.Playlists.updatePlayingHighlight();
        } else {
          nextIdx = 0;
        }
      }
    }
    this.playTrack(nextIdx);
  }

  async playTrack(target, fromQueue = false, newSourceId = null, newSourceList = null) {

  const normalizedSourceId =
 newSourceId
 ? String(newSourceId)
 : '';

 const isTemporarySource =
 normalizedSourceId.startsWith(
 'album:'
 ) ||
 normalizedSourceId.startsWith(
 'artist:'
 );

 if (
 normalizedSourceId &&
 !isTemporarySource &&
 window.PlaybackContext
 ?.isTemporaryActive()
 ) {
 window.PlaybackContext
 .discardAllTemporaryContexts();
 }

 let isFromQueue =
 Boolean(fromQueue);
    if (newSourceId && newSourceList) {
      window.state.currentQueueId = null; // Сбрасываем указатель старой очереди
      const isSourceChanged = (newSourceId !== window.state.playbackSource);
      const isListChanged = (newSourceList.length !== window.state.playbackList.length);
      window.state.playbackSource = newSourceId;
      window.state.playbackList = [...newSourceList];
 if (
 window.state.shuffle &&
 (
 isSourceChanged ||
 isListChanged ||
 !window.state.playbackShuffledList.length
 )
 ) {
 const startTrk =
 typeof target === 'object'
 ? target
 : newSourceList[target];

 this.generateShuffledList(
 startTrk
 );
 } else if (!window.state.shuffle) {
 window.state.playbackShuffledList = [];
 window.state.playbackShuffledIndex = -1;
 }
      if (window.Playlists?.updatePlayingHighlight) {
        window.Playlists.updatePlayingHighlight();
      }
    }
    let track;
    if (isFromQueue && window.state.queue.length > 0) {
      if (typeof target === 'object' && target !== null) {
        track = target;
      } else if (typeof target === 'number') {
        track = window.state.queue[target] || window.state.queue[0];
      } else {
        track = window.state.queue[0];
      }
    } else if (typeof target === 'object' && target !== null) {
      track = target;
    } else if (typeof target === 'number') {
      const listToUse = window.state.playbackList;
      if (target < 0 || target >= listToUse.length) return;
      track = listToUse[target];
    }
    if (!track) return;
    // Встраивание трека из таблицы в очередь происходит ТОЛЬКО если сейчас АКТИВНО играет очередь (currentQueueId !== null)
    if (!isFromQueue && window.state.queue && window.state.queue.length > 0 && window.state.currentQueueId) {
      const queueTrack = {
        ...track,
        queueId: 'q_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        played: false
      };
      const curQueueIdx = window.state.queue.findIndex(t => t.queueId === window.state.currentQueueId);
      let insertIdx = 0;
      if (curQueueIdx !== -1) {
        window.state.queue[curQueueIdx].played = true;
        insertIdx = curQueueIdx + 1;
      } else {
        insertIdx = window.state.queue.length;
      }
      window.state.queue.splice(insertIdx, 0, queueTrack);
      track = queueTrack;
      isFromQueue = true;
      window.state.playbackSource = 'queue';
    }
    // Отмечаем историю сыгранных элементов в очереди
    if (isFromQueue && window.state.queue.length > 0) {
      const curIdx = window.state.queue.findIndex(t => t.queueId === track.queueId);
      if (curIdx !== -1) {
        for (let i = 0; i < curIdx; i++) {
          window.state.queue[i].played = true;
        }
        window.state.queue[curIdx].played = false;
      }
    }
    window.state.playbackIndex = window.state.playbackList.findIndex(t => t.id === track.id);
    window.state.currentIndex = window.state.currentList.findIndex(t => t.id === track.id);
    window.state.currentTrackId = track.id;
    window.state.currentQueueId = isFromQueue ? (track.queueId || null) : null;
    // Сохранение положения в колоде Shuffle
    if (window.state.shuffle && !isFromQueue) {
      if (!window.state.playbackShuffledList || window.state.playbackShuffledList.length === 0) {
        this.generateShuffledList(track);
      } else {
        const existingIdx = window.state.playbackShuffledList.findIndex(t => t.id === track.id);
        if (existingIdx !== -1) {
          window.state.playbackShuffledIndex = existingIdx;
        } else {
          const insertPos = Math.max(0, window.state.playbackShuffledIndex + 1);
          window.state.playbackShuffledList.splice(insertPos, 0, track);
          window.state.playbackShuffledIndex = insertPos;
        }
      }
    }
    const crossfadeSec = window.state?.config?.crossfadeDuration ?? 2;
    const useCrossfade = (crossfadeSec > 0) && (window.AudioEngine?.isPlaying || false);
    if (window.Timeline) {
      window.Timeline.resetTime(0);
    }
    if (window.AudioEngine) {
      await window.AudioEngine.loadTrack(track.path, true, useCrossfade);
    }
 this.loadTrackToUI(track, true);
 if (window.Tracklist) window.Tracklist.render();
 if (window.QueuePanel) window.QueuePanel.update();
 if (window.AlbumView) window.AlbumView.syncPlayingState();

 if (
 window.ArtistView &&
 typeof window.ArtistView
 .syncPlayingState ===
 'function'
 ) {
 window.ArtistView
 .syncPlayingState();
 }

    if (window.state.config?.lastState) {
      window.state.config.lastState.trackId = track.id;
      window.state.config.lastState.currentTime = 0;
      this.saveQueueToConfig();
    }
  }

  playPrev() {
    const audio = window.AudioEngine?.audioElement;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      if (window.Timeline) window.Timeline.updateUI(0, window.Timeline.getDuration());
      return;
    }

    // 1. Если текущий играющий трек из ОЧЕРЕДИ — возвращаемся по истории очереди
    if (window.state.queue && window.state.queue.length > 0 && window.state.currentQueueId) {
      const curQueueIdx = window.state.queue.findIndex(t => t.queueId === window.state.currentQueueId);
      if (curQueueIdx > 0) {
        const prevQueueTrack = window.state.queue[curQueueIdx - 1];
        if (prevQueueTrack) {
          return this.playTrack(prevQueueTrack, true);
        }
      } else if (curQueueIdx === 0) {
        // На первом треке очереди: выходим из очереди к текущему зафиксированному треку плейлиста
        window.state.currentQueueId = null;
        const targetTrack = window.state.shuffle && window.state.playbackShuffledList.length > 0
          ? window.state.playbackShuffledList[window.state.playbackShuffledIndex]
          : window.state.playbackList[window.state.playbackIndex];
        if (targetTrack) {
          return this.playTrack(targetTrack);
        }
      }
    }

    // 2. Обычный режим воспроизведения (колода Shuffle или стандартный список)
    if (window.state.shuffle) {
      if (!window.state.playbackShuffledList || window.state.playbackShuffledList.length === 0) {
        this.generateShuffledList();
      }
      let prevSIdx = window.state.playbackShuffledIndex - 1;
      if (prevSIdx < 0) prevSIdx = window.state.playbackShuffledList.length - 1;
      window.state.playbackShuffledIndex = prevSIdx;
      const prevTrack = window.state.playbackShuffledList[prevSIdx];
      if (prevTrack) this.playTrack(prevTrack);
      return;
    }

    if (window.state.playbackList.length === 0) return;
    let prevIdx = window.state.playbackIndex - 1;
    if (prevIdx < 0) prevIdx = window.state.playbackList.length - 1;
    this.playTrack(prevIdx);
  }
 loadTrackToUI(track, updateLyrics = false) {
 const titleEl = document.getElementById('ui-title');
 const artistEl = document.getElementById('ui-artist');
 const coverEl = document.getElementById('ui-cover');
 if (track) {
 if (titleEl) titleEl.textContent = track.title;
 if (artistEl) artistEl.textContent = track.artist;
 if (window.Timeline) window.Timeline.setDuration(track.duration);
 if (coverEl) {
 coverEl.style.backgroundImage = track.coverPath
 ? `url("media://${encodeURIComponent(track.coverPath)}")`
 : `var(--bg-gradient)`;
 }
 // Передача данных на экран блокировки Windows
 if (window.MediaSession) {
 window.MediaSession.update(track);
 }
 // Синхронизация данных полноэкранного оверлея
 if (window.FullscreenPlayer) {
 window.FullscreenPlayer.syncAllUI(track);

 if (
 window.ReferenceFullscreenPlayerTheme
 ) {
 window.ReferenceFullscreenPlayerTheme
 .sync(track);
 }

 }
 const rawTitle = track.artist ? `${track.title} - ${track.artist}` : track.title;
 const MAX_LEN = 45;
 const formattedTitle = rawTitle.length > MAX_LEN
 ? rawTitle.substring(0, MAX_LEN - 3).trim() + '...'
 : rawTitle;
 if (window.api?.window?.setTitle) {
 window.api.window.setTitle(formattedTitle);
 }
 } else {
 const appName =
 window.state?.appIdentity?.name ||
 'Orphira';

 if (titleEl) {
 titleEl.textContent =
 appName;
 }

 if (artistEl) {
 artistEl.textContent =
 '...';
 }

 if (
 window.api?.window?.setTitle
 ) {
 window.api.window.setTitle(
 appName
 );
 }
 }
 if (updateLyrics && window.Lyrics && track) {
 window.Lyrics.parseAndRender(track);
 }
 }
 
  updatePlayButtonUI() {
    if (window.FullscreenPlayer) {
      window.FullscreenPlayer.syncPlayButton();
      window.FullscreenPlayer.syncModeButtons();
    }
    if (window.QueuePanel) {
      window.QueuePanel.update();
    }
    const btnPlay = document.getElementById('btn-play-pause');
    if (!btnPlay) return;
    const isPlaying = window.AudioEngine?.isPlaying;
    if (isPlaying) {
      document.body.classList.remove('is-paused-state');
    } else {
      document.body.classList.add('is-paused-state');
    }
    btnPlay.classList.toggle('is-playing', !!isPlaying);
  }
}
window.State = new StateManager();
