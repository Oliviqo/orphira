/**
 * COSMIC PLAYER - MODALS MANAGER
 * Управление окнами выбора очистки кэша, пакетных операций, импорта и эквалайзера
 */
class ModalsManager {
  constructor() {
    this.currentBatchType = 'covers';
    this.dropdownTimers = new Map();
    this.gracePeriod = 350; // Грейс-период закрытия при уходе мыши (350мс, как в context-menu)
  }

  init() {
    // Кнопка открытия Дебагера
    document.getElementById('btn-open-debug')?.addEventListener('click', () => {
      if (window.api?.debug?.open) window.api.debug.open();
    });

    // Закрытие модалок по клику на оверлей (с защитой от выделения текста с выходом за границы)
    let overlayMouseDownTarget = null;
    document.addEventListener('mousedown', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
        overlayMouseDownTarget = e.target;
      } else {
        overlayMouseDownTarget = null;
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
        if (overlayMouseDownTarget === e.target) {
          const modalId = e.target.id;
          if (modalId === 'playlist-modal') {
            document.getElementById('btn-close-playlist')?.click();
          } else if (modalId === 'prompt-modal') {
            document.getElementById('btn-prompt-cancel')?.click();
          } else {
            e.target.classList.add('hidden');
          }
        }
      }
      overlayMouseDownTarget = null;
    });

    // Дропдауны с контекстной логикой автозакрытия и подсветкой выборки
    this.setupDropdown('theme-dropdown', 'theme');
    this.setupDropdown('font-dropdown', 'font', (val) => {
      if (window.applyFont) window.applyFont(val);
    });
    this.setupDropdown('lang-dropdown', 'language', () => {
      if (window.i18n) window.i18n.updateDOM();
      this.renderFolderList();
    });

    // =========================================================================
    // ВЫБОРОЧНАЯ ОЧИСТКА КЭША С ЧЕКБОКСАМИ (ГЛОБАЛЬНАЯ ИЛИ ДЛЯ ПЛЕЙЛИСТА)
    // =========================================================================
    const btnClearCache = document.getElementById('btn-clear-cache');
    if (btnClearCache) {
      btnClearCache.addEventListener('click', () => {
        const modal = document.getElementById('clear-cache-modal');
        if (modal) {
          delete modal.dataset.plId;
          const titleEl = modal.querySelector('.modal-header span');
          const descEl = modal.querySelector('p');
          if (titleEl) titleEl.textContent = window.i18n?.t('clear_cache_modal_title') || "Selective Cache Cleanup";
          if (descEl) descEl.textContent = window.i18n?.t('clear_cache_modal_desc') || "Select the items you want to clean up. Your actual music files on disk will NOT be deleted.";
          const cbLib = document.getElementById('cb-cache-library')?.closest('label');
          const cbFolders = document.getElementById('cb-cache-folders')?.closest('label');
          if (cbLib) cbLib.style.display = 'flex';
          if (cbFolders) cbFolders.style.display = 'flex';
          modal.classList.remove('hidden');
        }
      });
    }

 document.getElementById('btn-close-acoustid-modal')?.addEventListener('click', () => {
 document.getElementById('acoustid-info-modal')?.classList.add('hidden');
 });

 // Глобальный перехватчик кликов по ссылкам внутри модальных окон
 document.getElementById('acoustid-info-modal')?.addEventListener('click', (e) => {
 const link = e.target.closest('a[href]');
 if (link) {
 e.preventDefault();
 e.stopPropagation();
 const url = link.getAttribute('href');
 if (url && window.api?.os?.openExternal) {
 window.api.os.openExternal(url);
 }
 }
 });

 document.getElementById('btn-acoustid-register-link')?.addEventListener('click', () => {
 if (window.api?.os?.openExternal) {
 window.api.os.openExternal('https://acoustid.org/new-app');
 }
 });

    document.getElementById('btn-close-clear-cache')?.addEventListener('click', () => {
      document.getElementById('clear-cache-modal')?.classList.add('hidden');
    });
    document.getElementById('btn-cancel-clear-cache')?.addEventListener('click', () => {
      document.getElementById('clear-cache-modal')?.classList.add('hidden');
    });

  document.getElementById('btn-confirm-clear-cache')?.addEventListener('click', async () => {
    const modal = document.getElementById('clear-cache-modal');
    const plId = modal?.dataset?.plId;
    let trackIds = null;
    if (plId && window.Playlists) {
      const plTracks = window.Playlists.getPlaylistTracks(plId) || [];
      trackIds = plTracks.map(t => t.id);
    }
    const options = {
      lyrics: document.getElementById('cb-cache-lyrics')?.checked || false,
      covers: document.getElementById('cb-cache-covers')?.checked || false,
      metadata: document.getElementById('cb-cache-metadata')?.checked || false,
      library: !plId && (document.getElementById('cb-cache-library')?.checked || false),
      folders: !plId && (document.getElementById('cb-cache-folders')?.checked || false),
      trackIds: trackIds
    };
    if (window.api?.db?.clearCacheSelective) {
      await window.api.db.clearCacheSelective(options);
      modal?.classList.add('hidden');

      if (options.folders && window.state.config) {
        window.state.config.libraryPaths = [];
        window.state.config.mainDirectory = null;
      }

      if (options.library || options.folders) {

 if (window.PlaybackContext) {
 window.PlaybackContext.reset();
 }

        // Принудительно останавливаем плеер и сбрасываем воспроизводимый файл
        if (window.AudioEngine) {
          window.AudioEngine.pause();
          if (window.AudioEngine.playerA?.audio) window.AudioEngine.playerA.audio.src = '';
          if (window.AudioEngine.playerB?.audio) window.AudioEngine.playerB.audio.src = '';
        }
        window.state.currentTrackId = null;
        window.state.currentIndex = -1;
        if (window.State?.loadTrackToUI) window.State.loadTrackToUI(null, true);

        if (options.library) {
          window.state.library = [];
          window.state.queue = [];
          if (window.State?.saveQueueToConfig) window.State.saveQueueToConfig();
        }
        window.state.currentList = [...window.state.library];
        window.state.playbackList = [...window.state.library];

        if (window.Tracklist) window.Tracklist.render();
        if (window.Playlists) window.Playlists.render();
        if (window.QueuePanel) window.QueuePanel.update();

        this.renderFolderList();
        if (window.SettingsView) {
          window.SettingsView.renderCategory(window.SettingsView.currentCat || 'library');
        }
      } else {
        const updatedLib = await window.api.db.getLibrary();
        window.state.library = updatedLib || [];
        if (window.state.playbackList) {
          window.state.playbackList = window.state.playbackList.map(pt => {
            const fresh = window.state.library.find(t => t.id === pt.id);
            return fresh || pt;
          });
        }
        if (window.state.queue) {
          window.state.queue = window.state.queue.map(qt => {
            const fresh = window.state.library.find(t => t.id === qt.id);
            return fresh ? { ...fresh, queueId: qt.queueId, played: qt.played } : qt;
          });
        }
        if (window.state.activeNav === 'library') {
          window.state.currentList = [...window.state.library];
        } else if (window.state.activeNav === 'queue') {
          window.state.currentList = [...window.state.queue];
        } else if (window.Playlists) {
          window.state.currentList = window.Playlists.getPlaylistTracks(window.state.activeNav);
        }
        if (window.Tracklist) window.Tracklist.render();
        if (window.Playlists) window.Playlists.render();
        if (window.QueuePanel) window.QueuePanel.update();
        if (window.state.currentTrackId) {
          const curTrack = window.state.library.find(t => t.id === window.state.currentTrackId);
          if (curTrack && window.State?.loadTrackToUI) {
            window.State.loadTrackToUI(curTrack, false);
          } else if (!curTrack) {
            if (window.AudioEngine) window.AudioEngine.pause();
            window.state.currentTrackId = null;
            window.state.currentIndex = -1;
            if (window.State?.loadTrackToUI) window.State.loadTrackToUI(null, true);
          }
        }
      }
      const msg = window.i18n?.t('toast_cache_cleared') || "Выбранный кэш успешно очищен";
      if (window.Toast) window.Toast.warn(msg);
    }
  });

 // =========================================================================
 // ПАКЕТНАЯ ЗАГРУЗКА ОБЛОЖЕК И МЕТАДАННЫХ
 // =========================================================================
 const batchModal = document.getElementById('batch-modal');
 const titlebarIndicator = document.getElementById('batch-titlebar-indicator');

 titlebarIndicator?.addEventListener('click', () => {
 if (window.Modals?.syncActiveBatchState) {
 window.Modals.syncActiveBatchState();
 }
 });

 document.getElementById('btn-open-covers-batch')?.addEventListener('click', () => {
 this.openBatchModal('covers', null);
 });
 document.getElementById('btn-open-meta-batch')?.addEventListener('click', () => {
 this.openBatchModal('metadata', null);
 });
 document.getElementById('btn-close-batch-modal')?.addEventListener('click', () => {
 batchModal?.classList.add('hidden');
 });
 document.getElementById('btn-batch-background')?.addEventListener('click', () => {
 batchModal?.classList.add('hidden');
 });
 document.getElementById('btn-batch-cancel')?.addEventListener('click', () => {
 if (window.api?.batch?.cancel) window.api.batch.cancel();
 batchModal?.classList.add('hidden');
 });

 // Кнопка "Только отсутствующие"
 document.getElementById('btn-batch-action-missing')?.addEventListener('click', async () => {
 this._setBatchUIProcessing(true);
 const plId = batchModal?.dataset?.plId;
 let trackIds = null;
 if (plId && window.Playlists) {
 const plTracks = window.Playlists.getPlaylistTracks(plId) || [];
 trackIds = plTracks.map(t => t.id);
 }
 if (this.currentBatchType === 'covers') {
 await window.api.batch.startCovers('missing', trackIds);
 } else {
 await window.api.batch.startMetadata(trackIds);
 }
 });

 // Кнопка "Заменить все"
 document.getElementById('btn-batch-action-all')?.addEventListener('click', async () => {
 this._setBatchUIProcessing(true);
 const plId = batchModal?.dataset?.plId;
 let trackIds = null;
 if (plId && window.Playlists) {
 const plTracks = window.Playlists.getPlaylistTracks(plId) || [];
 trackIds = plTracks.map(t => t.id);
 }
 await window.api.batch.startCovers('all', trackIds);
 });

 // Слушатель прогресса в реальном времени
 if (window.api?.batch?.onProgress) {
 window.api.batch.onProgress((data) => {
 this.updateBatchProgressUI(data);
 });
 }
 }

 _setBatchUIProcessing(isProcessing) {
 const progressContainer = document.getElementById('batch-progress-container');
 const btnMissing = document.getElementById('btn-batch-action-missing');
 const btnAll = document.getElementById('btn-batch-action-all');
 const btnBg = document.getElementById('btn-batch-background');
 if (isProcessing) {
 progressContainer?.classList.remove('hidden');
 if (btnMissing) btnMissing.style.display = 'none';
 if (btnAll) btnAll.style.display = 'none';
 if (btnBg) btnBg.classList.remove('hidden');
 } else {
 progressContainer?.classList.add('hidden');
 if (btnMissing) btnMissing.style.display = '';
 if (btnAll && this.currentBatchType === 'covers') btnAll.style.display = '';
 if (btnBg) btnBg.classList.add('hidden');
 }
 }

 updateBatchProgressUI(data) {
 const batchModal = document.getElementById('batch-modal');
 const titlebarIndicator = document.getElementById('batch-titlebar-indicator');
 const indicatorText = document.getElementById('batch-indicator-text');

 if (data.empty) {
 this._setBatchUIProcessing(false);
 if (titlebarIndicator) titlebarIndicator.classList.add('hidden');
 if (window.Toast) {
 const message = window.i18n?.t('batch_all_complete') || 'All tracks already contain the requested data';
 window.Toast.info(message);
 }
 return;
 }

 const percent = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
 const progressBar = document.getElementById('batch-progress-bar');
 const progressPercent = document.getElementById('batch-progress-percent');
 const progressText = document.getElementById('batch-progress-text');

 if (progressBar) progressBar.style.width = `${percent}%`;
 if (progressPercent) progressPercent.textContent = `${percent}%`;
 if (progressText) {
 const template = window.i18n?.t('batch_processed') || 'Processed: {current} / {total}';
 progressText.textContent = template.replace('{current}', String(data.current || 0)).replace('{total}', String(data.total || 0));
 }

 if (titlebarIndicator && indicatorText) {
 titlebarIndicator.classList.remove('hidden');
 const titleKey = data.type === 'covers' ? 'batch_running_covers' : 'batch_running_meta';
 const titleTmpl = window.i18n?.t(titleKey) || (data.type === 'covers' ? 'Downloading covers: {current} / {total}' : 'Enriching metadata: {current} / {total}');
 titlebarIndicator.title = titleTmpl.replace('{current}', String(data.current || 0)).replace('{total}', String(data.total || 0));
 indicatorText.textContent = `${percent}%`;
 }

 if (data.current >= data.total || data.canceled) {
 if (titlebarIndicator) titlebarIndicator.classList.add('hidden');
 this._setBatchUIProcessing(false);
 setTimeout(() => {
 batchModal?.classList.add('hidden');
 if (!window.Toast) return;
 if (data.canceled) {
 window.Toast.info(window.i18n?.t('batch_operation_canceled') || 'Operation canceled');
 return;
 }
 if (Number(data.acoustidSkippedCount) > 0) {
 window.Toast.warn(window.i18n?.t('toast_acoustid_key_required') || 'Some tracks require acoustic recognition, but no AcoustID API key is configured. Those tracks were skipped.');
 }
 if (Number(data.providerUnavailableCount) > 0) {
 window.Toast.warn(window.i18n?.t('toast_musicbrainz_unavailable') || 'MusicBrainz is currently unavailable. Some tracks could not be processed.');
 }
 if (Number(data.acoustidSkippedCount) === 0 && Number(data.providerUnavailableCount) === 0) {
 window.Toast.info(window.i18n?.t('batch_operation_complete') || 'Processing completed successfully');
 }
 }, 600);
 }
 }

 async syncActiveBatchState() {
 if (!window.api?.batch?.getStatus) return;
 const status = await window.api.batch.getStatus();
 if (status && status.running) {
 this.currentBatchType = status.type;
 this.openBatchModal(status.type, null, true);
 this._setBatchUIProcessing(true);
 this.updateBatchProgressUI({
 type: status.type,
 current: status.current,
 total: status.total,
 enrichedCount: status.enrichedCount,
 downloadedCount: status.downloadedCount,
 canceled: status.canceled
 });
 }
 }

 async openBatchModal(type, plId = null, isResuming = false) {
 this.currentBatchType = type;
 const batchModal = document.getElementById('batch-modal');
 if (!batchModal) return;

 if (!isResuming && window.api?.batch?.getStatus) {
 const activeStatus = await window.api.batch.getStatus();
 if (activeStatus && activeStatus.running) {
 this.openBatchModal(activeStatus.type, null, true);
 this._setBatchUIProcessing(true);
 this.updateBatchProgressUI(activeStatus);
 return;
 }
 }

 this._setBatchUIProcessing(false);

 if (plId) {
 batchModal.dataset.plId = plId;
 const pl = window.state.playlists.find(p => p.id === plId);
 const plName = pl ? pl.name : '';
 if (type === 'covers') {
 const titleTmpl = window.i18n?.t('batch_covers_pl_title') || 'HD Covers: «{name}»';
 const descTmpl = window.i18n?.t('batch_covers_pl_desc') || 'Search and download missing album art for tracks in playlist «{name}».';
 document.getElementById('batch-modal-title').textContent = titleTmpl.replace('{name}', plName);
 document.getElementById('batch-modal-desc').textContent = descTmpl.replace('{name}', plName);
 } else {
 const titleTmpl = window.i18n?.t('batch_meta_pl_title') || 'Metadata: «{name}»';
 const descTmpl = window.i18n?.t('batch_meta_pl_desc') || 'Fill in missing album names, release years, and genres for tracks in playlist «{name}».';
 document.getElementById('batch-modal-title').textContent = titleTmpl.replace('{name}', plName);
 document.getElementById('batch-modal-desc').textContent = descTmpl.replace('{name}', plName);
 }
 } else {
 delete batchModal.dataset.plId;
 if (type === 'covers') {
 document.getElementById('batch-modal-title').textContent = window.i18n?.t('batch_covers_title') || "Download HD Covers";
 document.getElementById('batch-modal-desc').textContent = window.i18n?.t('batch_covers_desc') || "Search and download missing album art from online sources.";
 } else {
 document.getElementById('batch-modal-title').textContent = window.i18n?.t('batch_meta_title') || "Enrich Metadata";
 document.getElementById('batch-modal-desc').textContent = window.i18n?.t('batch_meta_desc') || "Fill in missing albums, release years, and genres for your tracks.";
 }
 }

 if (type === 'covers') {
 document.getElementById('btn-batch-action-all')?.classList.remove('hidden');
 } else {
 document.getElementById('btn-batch-action-all')?.classList.add('hidden');
 }

 await this.updateBatchStats();
 batchModal.classList.remove('hidden');
 }

 async updateBatchStats() {
 if (!window.api?.batch?.getStats) return;

 const batchModal =
 document.getElementById('batch-modal');

 const plId =
 batchModal?.dataset?.plId;

 let trackIds = null;

 if (
 plId &&
 window.Playlists
 ) {
 const plTracks =
 window.Playlists.getPlaylistTracks(plId) ||
 [];

 trackIds =
 plTracks.map(track => track.id);
 }

 const statCount =
 document.getElementById('batch-stat-count');

 const statSize =
 document.getElementById('batch-stat-size');

 if (statCount) {
 statCount.textContent = '...';
 }

 if (statSize) {
 statSize.textContent = '...';
 }

 try {
 const stats =
 await window.api.batch.getStats(trackIds);

 if (!stats) return;

 if (
 this.currentBatchType === 'covers'
 ) {
 if (statCount) {
 const template =
 window.i18n?.t('batch_missing_format') ||
 '{missing} missing ({total} total)';

 statCount.textContent =
 template
 .replace(
 '{missing}',
 String(stats.missingCovers || 0)
 )
 .replace(
 '{total}',
 String(stats.totalTracks || 0)
 );
 }

 if (statSize) {
 if (stats.missingCovers > 0) {
 statSize.textContent =
 stats.estimatedCoversMissingFormatted ||
 '0 B';
 } else {
 const template =
 window.i18n?.t(
 'batch_replace_all_size'
 ) ||
 '~ {size} for Replace All';

 statSize.textContent =
 template.replace(
 '{size}',
 stats.estimatedCoversAllFormatted ||
 '0 B'
 );
 }
 }
 } else {
 if (statCount) {
 const template =
 window.i18n?.t(
 'batch_incomplete_format'
 ) ||
 '{missing} incomplete ({total} total)';

 statCount.textContent =
 template
 .replace(
 '{missing}',
 String(stats.missingMeta || 0)
 )
 .replace(
 '{total}',
 String(stats.totalTracks || 0)
 );
 }

 if (statSize) {
 statSize.textContent =
 window.i18n?.t(
 'batch_meta_estimated_size'
 ) ||
 'No additional media download';
 }
 }
 } catch (err) {
 if (statCount) {
 statCount.textContent = '0';
 }

 if (statSize) {
 statSize.textContent = '0 B';
 }
 }
 }

  setupDropdown(id, configKey, onSelectCallback) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    const selected = dropdown.querySelector('.dropdown-selected');
    const optionsContainer = dropdown.querySelector('.dropdown-options');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const initialVal = window.state.config[configKey] || 'outfit';
    dropdown.dataset.value = initialVal;

    const updateActiveOption = (val) => {
      options.forEach(opt => {
        if (opt.dataset.value === val) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });
    };
    updateActiveOption(initialVal);

    const initialOpt = Array.from(options).find(o => o.dataset.value === initialVal);
    if (initialOpt && selected) {
      selected.innerHTML = `${initialOpt.innerHTML} <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
    }

    const hideOptions = () => {
      optionsContainer?.classList.remove('show');
      if (this.dropdownTimers.has(id)) {
        clearTimeout(this.dropdownTimers.get(id));
        this.dropdownTimers.delete(id);
      }
    };

    const startCloseTimer = () => {
      this.cancelCloseTimer(id);
      const timer = setTimeout(() => {
        hideOptions();
      }, this.gracePeriod);
      this.dropdownTimers.set(id, timer);
    };

    selected?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = optionsContainer?.classList.contains('show');
      document.querySelectorAll('.dropdown-options.show').forEach(optEl => {
        if (optEl !== optionsContainer) optEl.classList.remove('show');
      });
      if (isOpen) {
        hideOptions();
      } else {
        optionsContainer?.classList.add('show');
      }
    });

    dropdown.addEventListener('mouseleave', () => {
      if (optionsContainer?.classList.contains('show')) {
        startCloseTimer();
      }
    });

    dropdown.addEventListener('mouseenter', () => {
      this.cancelCloseTimer(id);
    });

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        dropdown.dataset.value = val;
        if (selected) selected.innerHTML = `${opt.innerHTML} <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        hideOptions();
        updateActiveOption(val);
        window.state.config[configKey] = val;
        if (window.State) window.State.applyConfig(window.state.config);
        window.api.db.saveConfig(window.state.config);
        if (onSelectCallback) onSelectCallback(val);
      });
    });
  }

  cancelCloseTimer(id) {
    if (this.dropdownTimers.has(id)) {
      clearTimeout(this.dropdownTimers.get(id));
      this.dropdownTimers.delete(id);
    }
  }

  async removeConnectedFolder(folderPath) {
    if (!folderPath) return;
 if (window.state.config?.libraryPaths) {
  window.state.config.libraryPaths =
   window.state.config.libraryPaths.filter(
    path => path !== folderPath
   );

  if (
   window.state.config.mainDirectory ===
   folderPath
  ) {
   window.state.config.mainDirectory =
    window.state.config.libraryPaths[0] ||
    null;
  }

  await window.api.db.saveConfig(
   window.state.config
  );
 }
    const normFolder = folderPath.replace(/\\/g, '/').toLowerCase();
    const normFolderWithSlash = normFolder.endsWith('/') ? normFolder : normFolder + '/';

    if (Array.isArray(window.state.library)) {
      window.state.library = window.state.library.filter(track => {
        if (!track || !track.path) return false;
        const normTrack = track.path.replace(/\\/g, '/').toLowerCase();
        return !(normTrack === normFolder || normTrack.startsWith(normFolderWithSlash));
      });
      window.api.db.saveLibrary(window.state.library);
    }

    if (Array.isArray(window.state.playbackList)) {
      window.state.playbackList = window.state.playbackList.filter(pt => {
        return window.state.library.some(t => t.id === pt.id);
      });
    }

    if (window.state.activeNav === 'library') {
      window.state.currentList = [...window.state.library];
    } else if (window.state.activeNav === 'queue') {
      window.state.queue = window.state.queue.filter(t => {
        if (!t || !t.path) return false;
        const normTrack = t.path.replace(/\\/g, '/').toLowerCase();
        return !(normTrack === normFolder || normTrack.startsWith(normFolderWithSlash));
      });
      window.state.currentList = [...window.state.queue];
    } else if (window.Playlists) {
      window.state.currentList = window.Playlists.getPlaylistTracks(window.state.activeNav);
    }

    if (window.Playlists) {
      window.Playlists.cleanOrphanTracks();
      window.Playlists.render();
    }

    this.renderFolderList();
    if (window.Tracklist) {
      window.Tracklist.render();
    }

    const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
    if (window.Toast) {
      window.Toast.warn(`Папка "${folderName}" отключена`);
    }
  }

  renderFolderList() {
    const pathDisplay = document.getElementById('main-folder-path');
    if (!pathDisplay) return;
    pathDisplay.innerHTML = '';

    // Автоматическая санитаризация путей: превращаем случайно добавленные файлы .mp3 в пути к их папкам
    const rawPaths = window.state.config?.libraryPaths || [];
    const AUDIO_FILE_REGEX = /\.(mp3|flac|wav|ogg|m4a|aac|opus|m3u|m3u8)$/i;
    let pathsChanged = false;
    const cleanedPaths = [];

    rawPaths.forEach(p => {
      if (!p || typeof p !== 'string') return;
      let folderPath = p;
      if (AUDIO_FILE_REGEX.test(p)) {
        pathsChanged = true;
        const normalized = p.replace(/\\/g, '/');
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash !== -1) {
          folderPath = normalized.substring(0, lastSlash);
        }
      }
      if (folderPath && !cleanedPaths.includes(folderPath)) {
        cleanedPaths.push(folderPath);
      }
    });

    if (pathsChanged && window.state.config) {
      window.state.config.libraryPaths = cleanedPaths;
      if (window.api?.db?.saveConfig) {
        window.api.db.saveConfig(window.state.config);
      }
    }

    const paths = window.state.config?.libraryPaths || [];
    if (paths.length === 0) {
      pathDisplay.innerHTML = `<div style="opacity:0.5; margin-top:6px; font-size:11.5px;">${window.i18n?.t('no_folders_added') || 'No folders added'}</div>`;
      return;
    }
    const titleTemplate = window.i18n?.t('connected_folders') || 'Connected folders: {count}';
    const titleText = titleTemplate.replace('{count}', paths.length);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%; margin-top:8px;';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;';
    titleEl.textContent = titleText;
    wrapper.appendChild(titleEl);
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px; max-height:120px; overflow-y:auto; width:100%;';
    paths.forEach(p => {
      const item = document.createElement('div');
      item.className = 'connected-folder-item';
      const span = document.createElement('span');
      span.className = 'connected-folder-path';
      span.title = p;
      span.textContent = p;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-folder-btn';
      removeBtn.title = 'Отключить папку';
      removeBtn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeConnectedFolder(p);
      });
      item.appendChild(span);
      item.appendChild(removeBtn);
      listContainer.appendChild(item);
    });
    wrapper.appendChild(listContainer);
    pathDisplay.appendChild(wrapper);
  }
}

window.Modals = new ModalsManager();