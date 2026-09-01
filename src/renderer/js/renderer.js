/**
 * ORPHIRA - MAIN RENDERER ENTRY POINT
 * Главная точка входа браузерного процесса Renderer: инициализация событий DOM и контроллеров
 */

window.addEventListener('beforeunload', () => {
  if (window.State?.saveQueueToConfig) {
    window.State.saveQueueToConfig();
  }
});

let isMiniPlayer = false;
let wasNormalLyricsOpen = false;

/** Переключение компоновки элементов при смене режима обычного / мини-плеера */
function applyMiniPlayerUI(active) {
  window.isMiniPlayer = active;
}

window.applyMiniPlayerUI = applyMiniPlayerUI;

function initWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => window.api.window.control('minimize'));
  document.getElementById('btn-maximize')?.addEventListener('click', () => window.api.window.control('maximize'));
  document.getElementById('btn-close')?.addEventListener('click', () => window.api.window.control('close'));

  // Кнопка настроек в Titlebar переключает сайдбар в режим Настроек
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    document.getElementById('btn-mode-settings')?.click();
  });

  const titlebarCenter = document.querySelector('.titlebar-center');
  if (titlebarCenter) {
    titlebarCenter.addEventListener('dblclick', () => window.api.window.control('maximize'));
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      window.api.window.control('toggle-fullscreen');
    }
  });
}

function initPlayerControls() {
  const btnPlay = document.getElementById('btn-play-pause');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const volume = document.getElementById('ui-volume');
  const btnMute = document.getElementById('btn-mute');

  btnPlay?.addEventListener('click', () => {
    if (window.AudioEngine.isPlaying) {
      window.AudioEngine.pause();
    } else {
      if (window.state.currentIndex !== -1 && !window.AudioEngine.audioElement.src) {
        window.State.playTrack(window.state.currentIndex, false);
      } else {
        window.AudioEngine.play();
      }
    }
  });

  btnNext?.addEventListener('click', () => window.State.playNext());
  btnPrev?.addEventListener('click', () => window.State.playPrev());

  btnShuffle?.addEventListener('click', () => {
    window.state.shuffle = !window.state.shuffle;
    window.state.config.lastState.shuffle = window.state.shuffle;
    window.api.db.saveConfig(window.state.config);
    if (window.state.shuffle) {
      const currentTrack = window.state.playbackList.find(t => t.id === window.state.currentTrackId);
      window.State.generateShuffledList(currentTrack);
    }
    window.State.updateModeUI();
  });

  btnRepeat?.addEventListener('click', () => {
    window.state.repeat = (window.state.repeat + 1) % 3;
    window.state.config.lastState.repeat = window.state.repeat;
    window.api.db.saveConfig(window.state.config);
    window.State.updateModeUI();
  });

  // Логика управления громкостью и динамической иконкой громкости
  const svgVolHigh = `<svg class="icon" id="icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const svgVolMute = `<svg class="icon" id="icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

  const updateVolumeIcon = (val) => {
    if (!btnMute) return;
    btnMute.innerHTML = parseFloat(val) === 0 ? svgVolMute : svgVolHigh;
  };

  volume?.addEventListener('input', (e) => {
    const val = e.target.value;
    window.AudioEngine.setVolume(val / 100);
    window.state.config.lastState.volume = val;
    window.api.db.saveConfig(window.state.config);
    updateVolumeIcon(val);
    if (window.FullscreenPlayer) window.FullscreenPlayer.syncVolumeUI();
  });

  btnMute?.addEventListener('click', () => {
    if (parseFloat(volume.value) > 0) {
      volume.dataset.lastVol = volume.value;
      volume.value = 0;
      window.AudioEngine.setVolume(0);
      updateVolumeIcon(0);
    } else {
      const last = volume.dataset.lastVol || 50;
      volume.value = last;
      window.AudioEngine.setVolume(last / 100);
      updateVolumeIcon(last);
    }
    if (window.FullscreenPlayer) window.FullscreenPlayer.syncVolumeUI();
  });

  // Переключение текста песни с бесшовной версткой
  document.getElementById('btn-lyrics-toggle')?.addEventListener('click', () => {
    const lyricsPanel = document.getElementById('lyrics-panel');
    let isOpen = false;
    if (window.isMiniPlayer) {
      document.body.classList.toggle('mini-lyrics-open');
      lyricsPanel?.classList.remove('hidden');
      isOpen = document.body.classList.contains('mini-lyrics-open');
    } else {
      lyricsPanel?.classList.toggle('hidden');
      isOpen = !lyricsPanel?.classList.contains('hidden');
    }
    const currentTrack = window.state.library.find(t => t.id === window.state.currentTrackId);
    if (currentTrack && window.Lyrics) {
      window.Lyrics.parseAndRender(currentTrack);
      if (isOpen) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.Lyrics.scrollToCurrentLine(true);
          });
        });
      }
    }
  });

  document.getElementById('btn-close-lyrics')?.addEventListener('click', () => {
    document.getElementById('lyrics-panel')?.classList.add('hidden');
    document.body.classList.remove('mini-lyrics-open');
  });
}

/** Автономное управление выпадающим меню скорости */
function initSpeedControl() {
  const speedToggleBtn = document.getElementById('btn-speed-toggle');
  const speedPopup = document.getElementById('speed-popup');
  const speedWrapper = document.getElementById('speed-control-wrapper');
  const speedInput = document.getElementById('ui-speed');
  const speedText = document.getElementById('btn-speed-text');
  const speedResetBtn = document.getElementById('btn-speed-reset');
  const speedChips = document.querySelectorAll('.speed-chip');
  if (!speedToggleBtn || !speedPopup || !speedInput) return;

  let timer = null;
  const gracePeriod = 350;

  const hidePopup = () => {
    speedPopup.classList.add('hidden');
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const startCloseTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => hidePopup(), gracePeriod);
  };

  const cancelCloseTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const setSpeed = (val) => {
    const num = Math.max(0.2, Math.min(2.0, parseFloat(val) || 1.0));
    const formatted = `${num.toFixed(2).replace(/\.00$/, '.0')}x`;
    speedInput.value = num;
    if (speedText) speedText.textContent = formatted;
    speedChips.forEach(chip => {
      const chipVal = parseFloat(chip.dataset.speed);
      chip.classList.toggle('active', Math.abs(chipVal - num) < 0.01);
    });
    if (window.AudioEngine) window.AudioEngine.setPlaybackRate(num);
    if (window.state?.config?.lastState) {
      window.state.config.lastState.playbackRate = num;
      window.api.db.saveConfig(window.state.config);
    }
  };

  speedToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelCloseTimer();
    speedPopup.classList.toggle('hidden');
  });

  speedPopup.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => hidePopup());

  if (speedWrapper) {
    speedWrapper.addEventListener('mouseleave', () => {
      if (!speedPopup.classList.contains('hidden')) {
        startCloseTimer();
      }
    });
    speedWrapper.addEventListener('mouseenter', () => {
      cancelCloseTimer();
    });
  }

  speedInput.addEventListener('input', (e) => setSpeed(e.target.value));
  speedChips.forEach(chip => chip.addEventListener('click', () => setSpeed(chip.dataset.speed)));
  speedResetBtn?.addEventListener('click', () => setSpeed(1.0));
}

// Главная инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
  try {
    window.SplashProgress?.init();
    window.SplashProgress?.setStage('splash_starting', 2);

    // 1. Инициализация главного состояния (загрузка БД, библиотеки и конфигурации)
 if (window.State) {
 await window.State.init();
 }
 if (
 window.ReferenceFullscreenPlayerTheme
 ) {
 window.ReferenceFullscreenPlayerTheme
 .applyConfiguredTheme();
 }

    // 2. Инициализация локализации с гарантированной загрузкой JSON-файла
    if (window.i18n) {
      const activeLang = window.state?.config?.language || 'en';
      await window.i18n.setLanguage(activeLang);
    }

 if (window.UpdateUI) {
 await window.UpdateUI.init();
 }
 
    const appName = window.state?.appIdentity?.name || 'Orphira';
    document.title = appName;

    const titlebarTitle = document.querySelector('.titlebar-title');
    if (titlebarTitle) {
      titlebarTitle.textContent = appName;
    }

    const splashAppName = document.getElementById('splash-app-name');
    if (splashAppName) {
      splashAppName.textContent = appName;
    }

    if (window.SplashProgress) {
      window.SplashProgress.refreshLanguage();
      window.SplashProgress.setStage('splash_interface', 74);
    }

    if (window.Playlists) window.Playlists.cleanOrphanTracks();
    initStars();
    initWindowControls();
    initPlayerControls();
    initSpeedControl();

// Инициализация новых компонентов
if (window.Equalizer) window.Equalizer.init();
if (window.SettingsView) window.SettingsView.init();
if (window.LibraryViews) window.LibraryViews.init();
if (window.QueuePanel) window.QueuePanel.init();
if (window.PluginRuntime) await window.PluginRuntime.init();

  window.SplashProgress?.setStage(
 'splash_audio',
 82
 );

 // Глобальная функция выхода из настроек
function exitSettings() {
  const btnSettings = document.getElementById('btn-mode-settings');
  const musicView = document.getElementById('sidebar-music-view');
  const settingsView = document.getElementById('sidebar-settings-view');
  const settingsContainer = document.getElementById('settings-view-container');
  const mainHeaderBar = document.getElementById('main-header-bar');

  btnSettings?.classList.remove('active');
  settingsView?.classList.add('hidden');
  settingsContainer?.classList.add('hidden');
  musicView?.classList.remove('hidden');
  mainHeaderBar?.classList.remove('hidden');

  const libraryTabs = document.getElementById('library-tabs');
  const gridView = document.getElementById('library-grid-view');
  const tracklistView = document.getElementById('tracklist-view');
  if (window.state.activeNav === 'library') {
    if (libraryTabs) libraryTabs.classList.remove('hidden');
    if (window.LibraryViews) {
      window.LibraryViews.switchView(window.LibraryViews.currentView || 'tracks');
    }
  } else {
    if (libraryTabs) libraryTabs.classList.add('hidden');
    if (gridView) gridView.classList.add('hidden');
    if (tracklistView) tracklistView.classList.remove('hidden');
    const body = document.getElementById('tracklist-body');
    if (body) body.scrollTop = 0;
    if (window.Tracklist) window.Tracklist.render();
  }
  if (window.Search) {
    if (window.Search.inputEl) {
window.Search.inputEl.placeholder = window.i18n?.t('search') || 'Search track, artist, album...';
      const queryToRestore = window.Search.savedLibraryQuery || '';
      window.Search.inputEl.value = queryToRestore;
      window.Search._toggleClearButton(queryToRestore.length > 0);
      window.Search.executeSearch(queryToRestore);
    }
  }
}
window.exitSettings = exitSettings;

const btnSettings = document.getElementById('btn-mode-settings');
const settingsView = document.getElementById('sidebar-settings-view');
const settingsContainer = document.getElementById('settings-view-container');
const musicView = document.getElementById('sidebar-music-view');

btnSettings?.addEventListener('click', () => {
  const isSettingsOpen = settingsContainer && !settingsContainer.classList.contains('hidden');
  if (isSettingsOpen) {
    exitSettings();
    return;
  }
  if (window.Search) {
    if (!window.Search.isSettingsActive() && window.Search.inputEl) {
      window.Search.savedLibraryQuery = window.Search.inputEl.value;
    }
    window.Search.clearSearch();

  }
  btnSettings.classList.add('active');
  settingsView?.classList.remove('hidden');
  musicView?.classList.add('hidden');

  // Скрываем верхнюю панель "Моя Музыка" при входе в Настройки
  document.getElementById('main-header-bar')?.classList.add('hidden');
  document.getElementById('library-tabs')?.classList.add('hidden');
  document.getElementById('tracklist-view')?.classList.add('hidden');
  document.getElementById('library-grid-view')?.classList.add('hidden');
  document.getElementById('empty-state')?.classList.add('hidden');
  settingsContainer?.classList.remove('hidden');
  if (window.Search) {
 window.Search.syncContext();
}

  document.querySelectorAll('#sidebar-settings-view .nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector('#sidebar-settings-view .nav-item[data-settings-cat="app"]')?.classList.add('active');
  if (window.SettingsView) {
    window.SettingsView.renderCategory('app');
  }
});

 document.getElementById('btn-close-settings')?.addEventListener('click', exitSettings);
  
  if (window.Timeline) {
    window.Timeline.init({
      onTrackEnd: () => window.State.playNext(),
      onTimeUpdate: (cTime) => window.Lyrics?.syncHighlight(cTime)
    });
  }


    if (window.Tracklist) window.Tracklist.init();
    if (window.Playlists) window.Playlists.init();
    if (window.Search) window.Search.init();
    if (window.DragDrop) window.DragDrop.init();
    if (window.ContextMenu) window.ContextMenu.init();
    if (window.Modals) window.Modals.init();
    if (window.IpcBridge) window.IpcBridge.init();

     window.SplashProgress?.setStage(
 'splash_session',
 90
 );

    // Восстановление последнего проигрываемого трека с точной позицией времени
    if (window.state.config.lastState?.trackId) {
      const trackIndex = window.state.library.findIndex(t => t.id === window.state.config.lastState.trackId);
      if (trackIndex !== -1) {
        const track = window.state.library[trackIndex];
        window.state.currentIndex = trackIndex;
        window.state.currentTrackId = track.id;
        if (window.state.config.lastState?.currentQueueId) {
          window.state.currentQueueId = window.state.config.lastState.currentQueueId;
        }
        window.State.loadTrackToUI(track, false);
        let restoredTime = window.state.config.lastState.currentTime || 0;
        if (track.duration && restoredTime >= track.duration - 1.5) {
          restoredTime = 0;
        }
        window.AudioEngine.loadTrack(track.path, false, false).then(() => {
          const audio = window.AudioEngine.audioElement;
          if (audio) {
            const applyTime = () => {
              try {
                audio.currentTime = restoredTime;
              } catch (e) {}
              if (window.Timeline) window.Timeline.updateUI(restoredTime, track.duration);
              if (window.FullscreenPlayer) window.FullscreenPlayer.syncProgress(restoredTime, track.duration);
            };
            if (audio.readyState >= 1) applyTime();
            else audio.addEventListener('loadedmetadata', applyTime, { once: true });
          }
        });
      }
    } 

    if (window.state.shuffle) window.State.generateShuffledList();

 window.SplashProgress?.setStage(
 'splash_session',
 96
 );

    window.State.updateModeUI();
    if (window.Tracklist) window.Tracklist.render();
    if (window.Playlists) window.Playlists.render();

 if (window.SplashProgress) {
 window.SplashProgress.complete();

 await window.SplashProgress.waitUntilComplete();
 }

 if (
 typeof window.hideSplash ===
 'function'
 ) {
 window.hideSplash();
 }

 } catch (error) {
 console.error(
 '[Renderer Startup]',
 error
 );

 if (window.api?.logError) {
 window.api.logError(
 error?.stack ||
 error?.toString() ||
 String(error)
 );
 }
 }
});