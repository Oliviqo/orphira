const { ipcMain, dialog, shell, net, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const storage = require('./storage');
const pluginManager = require('./plugin-manager');

const {
 getPublicIdentity
} = require('./app-identity');

const log = require('electron-log');
let scanWorker = null;
function setupIpcHandlers(getMainWindow, initFolderWatcherFn, setupThumbarFn) {
 function startScan(paths) {
 if (scanWorker) {
 scanWorker.kill();
 scanWorker = null;
 }
 scanWorker = fork(path.join(__dirname, 'worker.js'));
 scanWorker.send({ type: 'START_SCAN', payload: { paths, coversPath: storage.getCoversPath() } });
 scanWorker.on('message', (msg) => {
 const mainWindow = getMainWindow();
 if (msg.type === 'PROGRESS') {
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send('scan-progress', msg.payload);
 }
 } else if (msg.type === 'COMPLETE') {
 const updatedLib = storage.mergeLibraryTracks(msg.payload);
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send('scan-complete', updatedLib);
 }
 scanWorker.kill();
 scanWorker = null;
 }
 });
 }
 ipcMain.handle('window-cmd', (event, cmd) => {
 const mainWindow = getMainWindow();
 if (!mainWindow) return;
    if (cmd === 'minimize') mainWindow.minimize();
 if (cmd === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
 if (cmd === 'close') mainWindow.close();
 if (cmd === 'toggle-fullscreen') mainWindow.setFullScreen(!mainWindow.isFullScreen());
 });
    ipcMain.handle('toggle-miniplayer', (event, isMini) => {
        const config = storage.getConfig();
        config.lastState = config.lastState || {};
        config.lastState.isMiniPlayer = isMini;
        storage.saveConfig(config);
        return true;
    });
    ipcMain.handle('expand-miniplayer', (event, isExpanded) => {
        return true;
    });
    ipcMain.handle('window-set-title', (event, title) => {
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.setTitle(
 title ||
 require('./app-identity').APP_NAME
 );
        }
    });
    ipcMain.handle('dialog-select-folder', async () => {
        const mainWindow = getMainWindow();
        const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });
    ipcMain.handle('os-validate-paths', async (event, paths) => {
        if (!Array.isArray(paths)) return [];
        const SUPPORTED_EXTENSIONS = /\.(mp3|flac|wav|ogg|m4a|aac|opus|m3u|m3u8)$/i;
        return paths.filter(p => {
            try {
                if (!p || typeof p !== 'string' || !fs.existsSync(p)) return false;
                const stat = fs.statSync(p);
                if (stat.isDirectory()) return true;
                return SUPPORTED_EXTENSIONS.test(p);
            } catch (e) {
                return false;
            }
        });
    });
ipcMain.handle('db-get-config', () => storage.getConfig());
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:get-identity', () => getPublicIdentity()); ipcMain.handle('batch:get-stats', (event, trackIds) => {
 const storageControl = require('./storage-control');
 return storageControl.getStorageStats(trackIds);
 });
 ipcMain.handle('batch:start-covers', async (event, mode, trackIds) => {
 const storageControl = require('./storage-control');
 const mainWindow = getMainWindow();
 const result = await storageControl.processBatchCovers(mode, trackIds, (progress) => {
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send('batch:progress', { type: 'covers', ...progress });
 }
 });
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send(
 'library-data-updated',
 result.updatedLibrary
 ); }
 return result;
 });
 ipcMain.handle('batch:start-metadata', async (event, trackIds) => {
 const storageControl = require('./storage-control');
 const mainWindow = getMainWindow();
 const result = await storageControl.processBatchMetadata(trackIds, (progress) => {
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send('batch:progress', { type: 'metadata', ...progress });
 }
 });
 if (mainWindow && !mainWindow.isDestroyed()) {
 mainWindow.webContents.send(
 'library-data-updated',
 result.updatedLibrary
 ); }
 return result;
 });

 ipcMain.handle('album:download-cover', async (event, trackIds) => {
 const storageControl = require('./storage-control');
 const mainWindow = getMainWindow();

 const result = await storageControl.downloadCoverForTracks(trackIds);

 if (
  result?.success &&
  mainWindow &&
  !mainWindow.isDestroyed()
 ) {
 mainWindow.webContents.send(
 'library-data-updated',
 result.updatedLibrary
 ); }

 return result;
 });

 ipcMain.handle('batch:get-status', () => {
 const storageControl = require('./storage-control');
 return storageControl.getBatchStatus();
});

 ipcMain.handle('batch:cancel', () => {
 const storageControl = require('./storage-control');
 storageControl.cancelBatch();
 return true;
 });
ipcMain.handle(
 'db:clear-cache-selective',
 async (
  event,
  {
   lyrics,
   covers,
   metadata,
   library,
   folders,
   trackIds
  }
 ) => {
  const lyricsCache =
   require('./lyrics-cache');

  const {
   clearEnrichedMetadata
  } = require('./track-metadata');

  const {
   resolveActiveLyricsPath
  } = require('./track-assets');

  let lib =
   storage.getLibrary() || [];

  let libModified = false;

  const hasTrackFilter =
   Array.isArray(trackIds) &&
   trackIds.length > 0;

  const targetIdSet =
   hasTrackFilter
    ? new Set(trackIds)
    : null;

  const isTarget =
   track =>
    !targetIdSet ||
    targetIdSet.has(track.id);

  if (lyrics) {
   if (hasTrackFilter) {
    const targetTracks =
     lib.filter(isTarget);

    targetTracks.forEach(track => {
     const keysToRemove = [
      track.path,
      `${track.artist}_${track.title}`,
      `${
       track.sourceMetadata?.artist ||
       track.artist ||
       ''
      }_${
       track.sourceMetadata?.title ||
       track.title ||
       ''
      }`,
      track.title,
      track.sourceMetadata?.title
     ]
      .filter(Boolean);

     const uniqueKeys =
      new Set(keysToRemove);

     uniqueKeys.forEach(key => {
      lyricsCache.remove(key);
     });

     if (
      track.downloadedLyricsPath &&
      fs.existsSync(
       track.downloadedLyricsPath
      )
     ) {
      try {
       fs.unlinkSync(
        track.downloadedLyricsPath
       );
      } catch (e) {}
     }

     track.downloadedLyricsPath =
      null;

track.lyricsPath =
      resolveActiveLyricsPath(
       track,
       null
      );

     libModified = true;
    });
   } else {
    lyricsCache.clear();

    lib.forEach(track => {
     track.downloadedLyricsPath =
      null;

track.lyricsPath =
      resolveActiveLyricsPath(
       track,
       null
      );
    });

    libModified = true;
   }
  }

  if (covers) {
   const downloadedPathsToCheck =
    new Set();

   lib.forEach(track => {
    if (!isTarget(track)) {
     return;
    }

    if (
     track.downloadedCoverPath
    ) {
     downloadedPathsToCheck.add(
      track.downloadedCoverPath
     );
    }

    track.downloadedCoverPath =
     null;

    track.coverPath =
     track.embeddedCoverPath ||
     null;

    libModified = true;
   });

   downloadedPathsToCheck.forEach(
    downloadedPath => {
     if (!downloadedPath) {
      return;
     }

     const stillUsed =
      lib.some(track =>
       track.downloadedCoverPath ===
        downloadedPath
      );

     if (stillUsed) {
      return;
     }

     try {
      if (
       fs.existsSync(
        downloadedPath
       )
      ) {
       fs.unlinkSync(
        downloadedPath
       );
      }
     } catch (e) {}
    }
   );
  }

  if (metadata) {
   lib.forEach(track => {
    if (!isTarget(track)) {
     return;
    }

    clearEnrichedMetadata(
     track
    );

    libModified = true;
   });
  }

if (
   library &&
   !hasTrackFilter
  ) {
   const {
    cleanupDownloadedAssets
   } = require('./track-assets');

   lib = [];

   storage.saveLibrary(
    []
   );

   cleanupDownloadedAssets(
    [],
    storage.getCoversPath()
   );

   libModified = false;
  } else if (libModified) {
   storage.saveLibrary(lib);
  }

  if (
   folders &&
   !hasTrackFilter
  ) {
   const config =
    storage.getConfig();

   config.libraryPaths = [];
   config.mainDirectory = null;

   storage.saveConfig(
    config
   );

   if (
    typeof initFolderWatcherFn ===
    'function'
   ) {
    initFolderWatcherFn(
     startScan,
     getMainWindow
    );
   }
  }

  return true;
 }
);

  ipcMain.handle('db-save-config', (event, newConf) => {
    storage.saveConfig(newConf);
    if (typeof initFolderWatcherFn === 'function') {
      initFolderWatcherFn(startScan, getMainWindow);
    }
  });
 ipcMain.handle('db-get-library', () => storage.getLibrary());
 ipcMain.handle('db-save-library', (event, lib) => storage.saveLibrary(lib));
 ipcMain.handle('db-get-playlists', () => storage.getPlaylists());
 ipcMain.handle('db-save-playlists', (event, pl) => storage.savePlaylists(pl));
  ipcMain.handle('os-open-external', async (event, url) => {
 if (
 !url ||
 typeof url !== 'string'
 ) {
 return false;
 }

 let parsedUrl;

 try {
 parsedUrl =
 new URL(url);
 } catch (error) {
 return false;
 }

 if (
 parsedUrl.protocol !== 'https:' &&
 parsedUrl.protocol !== 'http:'
 ) {
 return false;
 }

 try {
 await shell.openExternal(
 parsedUrl.toString()
 );
 return true;
 } catch (error) {
 log.error(
 `[IPC] Не удалось открыть внешнюю ссылку: ${url}`,
 error
 );
 return false;
 }
 });
 ipcMain.handle('os-show-item', (event, filePath) => shell.showItemInFolder(filePath));
 ipcMain.handle('os-trash-item', async (event, filePath) => {
 try {
 await shell.trashItem(filePath);
 return true;
 } catch (e) {
 log.error(`[IPC] Ошибка удаления файла в корзину: ${filePath}`, e);
 return false;
 }
 });
 // =========================================================================
 // РЕЗЕРВ ДЛЯ ПАКЕТНЫХ ОПЕРАЦИЙ (BATCH OPERATIONS RESERVATION)
 // Предназначено для разработчиков: реализация пакетного выделения треков (Shift/Ctrl + Kлик)
 // =========================================================================
 /**
 * [BATCH RESERVATION] Массовое перемещение треков в корзину ОС
 * @param {Array<string>} filePaths - Массив абсолютных путей к файлам для удаления
 * @returns {Promise<{ successCount: number, failedPaths: Array<string> }>}
 *
 * ИНСТРУКЦИЯ ДЛЯ РАЗРАБОТЧИКА:
 * При реализации UI мультивыделения (Shift/Ctrl + click или прямоугольник выделения)
 * вызывайте window.api.os.trashItemBatch(selectedPaths). Метод удаляет файлы пачкой
 * без вызова повторных сканирований библиотеки.
 */
 ipcMain.handle('os-trash-items-batch', async (event, filePaths) => {
 if (!Array.isArray(filePaths) || filePaths.length === 0) {
 return { successCount: 0, failedPaths: [] };
 }
 let successCount = 0;
 const failedPaths = [];
 for (const filePath of filePaths) {
 try {
 if (fs.existsSync(filePath)) {
 await shell.trashItem(filePath);
 successCount++;
 }
 } catch (e) {
 log.error(`[Batch Delete] Не удалось удалить файл: ${filePath}`, e);
 failedPaths.push(filePath);
 }
 }
 // Инкрементально вырезаем удаленную пачку из базы данных library.json
 let library = storage.getLibrary() || [];
 const deletedSet = new Set(filePaths.filter(p => !failedPaths.includes(p)));
 library = library.filter(t => !deletedSet.has(t.path));
 storage.saveLibrary(library);
 return { successCount, failedPaths, updatedLibrary: library };
 });
 /**
 * [BATCH RESERVATION] Массовое перемещение файлов треков в другую папку диска
 * @param {Array<{ sourcePath: string, targetDirectory: string }>} moveTasks
 * @returns {Promise<{ movedCount: number, errors: Array<string> }>}
 *
 * ИНСТРУКЦИЯ ДЛЯ РАЗРАБОТЧИКА:
 * Используйте данный метод для функции Drag-and-Drop или кнопки "Переместить выделенные в папку...".
 * Автоматически обновляет пути (path) у перенесенных треков в базе данных library.json.
 */
 ipcMain.handle('os-move-items-batch', async (event, moveTasks) => {
 if (!Array.isArray(moveTasks) || moveTasks.length === 0) {
 return { movedCount: 0, errors: [] };
 }
 let movedCount = 0;
 const errors = [];
 let library = storage.getLibrary() || [];
 let modified = false;
 for (const task of moveTasks) {
 try {
 const { sourcePath, targetDirectory } = task;
 if (fs.existsSync(sourcePath) && fs.existsSync(targetDirectory)) {
 const fileName = path.basename(sourcePath);
 const newPath = path.join(targetDirectory, fileName);
 fs.renameSync(sourcePath, newPath);
 movedCount++;
 // Обновляем путь у трека в БД
 const track = library.find(t => t.path === sourcePath);
 if (track) {
 track.path = newPath;
 modified = true;
 }
 }
 } catch (err) {
 errors.push(`Ошибка перемещения ${task.sourcePath}: ${err.message}`);
 }
 }
 if (modified) {
 storage.saveLibrary(library);
 }
 return { movedCount, errors, updatedLibrary: library };
 });

  ipcMain.handle('search-in-lyrics', async (event, { query, convertedQuery, phoneticQuery, tracks }) => {
    const lyricsCache = require('./lyrics-cache');
    const matchedResults = []; // [{ id, matchedLine, score }]

    const fastLevenshtein = (a, b) => {
      if (a === b) return 0;
      const aLen = a.length, bLen = b.length;
      if (aLen === 0) return bLen;
      if (bLen === 0) return aLen;
      const row = new Array(bLen + 1);
      for (let j = 0; j <= bLen; j++) row[j] = j;
      for (let i = 1; i <= aLen; i++) {
        let prev = i;
        for (let j = 1; j <= bLen; j++) {
          const val = (a[i - 1] === b[j - 1]) ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
          row[j - 1] = prev;
          prev = val;
        }
        row[bLen] = prev;
      }
      return row[bLen];
    };

    const cleanLrcText = (txt) => {
      if (!txt) return '';
      return txt
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\w\d\sа-яА-ЯёЁ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    };

    const getTokens = (qStr) => {
      if (!qStr) return [];
      return qStr.toLowerCase().replace(/[^\w\d\sа-яА-ЯёЁ]/gi, ' ').split(/\s+/).filter(w => w.length >= 1);
    };

    const calculateWordSim = (qWord, lineWord) => {
      if (qWord === lineWord) return 1.0;
      if (lineWord.length >= 3 && qWord.length >= 3) {
        if (lineWord.startsWith(qWord) || qWord.startsWith(lineWord)) return 0.85;
      }
      const maxLen = Math.max(qWord.length, lineWord.length);
      if (maxLen === 0) return 0;
      const dist = fastLevenshtein(qWord, lineWord);
      if (maxLen <= 2 && dist <= 1) return 0.60;
      return 1.0 - (dist / maxLen);
    };

    const scoreTokensAgainstLine = (tokens, lineWords) => {
      if (tokens.length === 0 || lineWords.length === 0) return 0;
      let matchedCount = 0;
      let totalSimSum = 0;
      for (const t of tokens) {
        let maxWordSim = 0;
        for (const lw of lineWords) {
          const sim = calculateWordSim(t, lw);
          if (sim > maxWordSim) maxWordSim = sim;
        }
        if (maxWordSim >= 0.50) {
          matchedCount++;
          totalSimSum += maxWordSim;
        }
      }
      const matchRatio = matchedCount / tokens.length;
      if (matchRatio >= 0.45 || (tokens.length === 1 && matchedCount === 1)) {
        return (totalSimSum / tokens.length) * matchRatio;
      }
      return 0;
    };

    const qClean = cleanLrcText(query);
    const cClean = cleanLrcText(convertedQuery);
    const pClean = cleanLrcText(phoneticQuery);
    const qTokens = getTokens(query);
    const cTokens = getTokens(convertedQuery);
    const pTokens = getTokens(phoneticQuery);

    if (qTokens.length === 0 && cTokens.length === 0 && pTokens.length === 0) return [];

    for (const t of tracks) {
      if (!t || !t.id || !t.path) continue;
      let content = null;

      if (t.lyricsPath && fs.existsSync(t.lyricsPath)) {
        try { content = fs.readFileSync(t.lyricsPath, 'utf-8'); } catch (e) {}
      }
      if (!content) {
        const keysToTry = [
          t.path,
          `${t.artist}_${t.title}`,
          `${t.originalArtist || t.artist}_${t.originalTitle || t.title}`,
          t.title
        ];
        for (const key of keysToTry) {
          if (!key) continue;
          const cachedText = lyricsCache.get(key);
          if (cachedText) { content = cachedText; break; }
        }
      }

      if (content) {
        const rawLines = content.split(/\r?\n/);
        let bestLine = '';
        let bestLineScore = 0;

        for (const line of rawLines) {
          const lineWithoutTime = line.replace(/\[[^\]]*\]/g, '').trim();
          if (!lineWithoutTime || lineWithoutTime.startsWith('#')) continue;
          const lClean = cleanLrcText(lineWithoutTime);
          if (!lClean) continue;

          // 1. Абсолютный приоритет точного фразового совпадения (Score >= 10.0)
          if ((qClean && lClean.includes(qClean)) ||
              (cClean && cClean !== qClean && lClean.includes(cClean)) ||
              (pClean && pClean !== qClean && lClean.includes(pClean))) {
            bestLine = lineWithoutTime;
            bestLineScore = 10.0 + (qClean ? (qClean.length / Math.max(1, lClean.length)) : 0);
            break;
          }

          // 2. Пословный рейтинг строки
          const lineWords = lClean.split(/\s+/).filter(w => w.length >= 1);
          const scoreQ = scoreTokensAgainstLine(qTokens, lineWords);
          const scoreC = scoreTokensAgainstLine(cTokens, lineWords);
          const scoreP = scoreTokensAgainstLine(pTokens, lineWords);
          const maxScore = Math.max(scoreQ, scoreC, scoreP);

          if (maxScore > bestLineScore && maxScore >= 0.45) {
            bestLineScore = maxScore;
            bestLine = lineWithoutTime;
          }
        }

        if (bestLine && bestLineScore >= 0.45) {
          matchedResults.push({ id: t.id, matchedLine: bestLine, score: bestLineScore });
        }
      }
    }

    // Сортировка результатов поиска по убыванию качества совпадения фразы
    matchedResults.sort((a, b) => b.score - a.score);
    return matchedResults;
  });

 ipcMain.handle(
  'resolve-track-lyrics',
  (
   event,
   track
  ) => {
   if (!track) {
    return null;
   }

   const lyricsCache =
    require('./lyrics-cache');

   const {
    resolveBestLyricsAsset
   } = require('./track-assets');

   const cacheKeys = [
    track.path,
    `${track.artist || ''}_${track.title || ''}`,
    `${
     track.sourceMetadata?.artist ||
     ''
    }_${
     track.sourceMetadata?.title ||
     ''
    }`
   ].filter(Boolean);

   let downloadedLyricsPath =
    null;

   for (const key of cacheKeys) {
    const candidatePath =
     lyricsCache.getPath(key);

    if (
     candidatePath &&
     fs.existsSync(candidatePath)
    ) {
     downloadedLyricsPath =
      candidatePath;
     break;
    }
   }

   const resolved =
    resolveBestLyricsAsset(
     track,
     downloadedLyricsPath
    );

   if (!resolved) {
    return null;
   }

   return {
    type:
     resolved.type,
    path:
     resolved.path,
    content:
     resolved.content,
    synced:
     resolved.synced
   };
  }
 );

 ipcMain.handle('read-lyrics', (event, filePath) => {
 try {
 return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
 } catch (e) {
 return null;
 }
 });
 ipcMain.handle(
 'fetch-online-lyrics',
 async (
 event,
 {
 artist,
 title,
 path: trackPath
 }
 ) => {
 const config =
 storage.getConfig();

 if (
 config.onlineLyricsEnabled !==
 true
 ) {
 return null;
 }

 const lyricsEngine =
 require('./lyrics-engine');

 return await lyricsEngine.fetchLyrics(
 artist,
 title,
 trackPath
 );
 }
 );

 pluginManager.init();

 ipcMain.handle('plugins:list', () => {
 return pluginManager.list();
 });

 ipcMain.handle('plugins:get-enabled', () => {
 return pluginManager.getEnabledDescriptors();
 });

 ipcMain.handle('plugins:get-descriptor', (event, pluginId) => {
 return pluginManager.getDescriptor(pluginId);
 });

 ipcMain.handle('plugins:select-package', async () => {
 const mainWindow = getMainWindow();
 return await pluginManager.selectPackageFile(mainWindow);
 });

 ipcMain.handle('plugins:inspect-url', async (event, url) => {
 return await pluginManager.inspectPackageUrl(url);
 });

 ipcMain.handle('plugins:install-file', (event, filePath) => {
 return pluginManager.installPackageFile(filePath);
 });

 ipcMain.handle('plugins:install-url', async (event, url) => {
 return await pluginManager.installPackageUrl(url);
 });

 ipcMain.handle('plugins:set-enabled', (event, pluginId, enabled) => {
 return pluginManager.setEnabled(pluginId, enabled);
 });

 ipcMain.handle('plugins:uninstall', (event, pluginId, clearData) => {
 return pluginManager.uninstall(pluginId, Boolean(clearData));
 });

 ipcMain.handle(
 'plugins:setting-get',
 (
 event,
 pluginId,
 key
 ) => {
 return pluginManager
 .getSettingData(
 pluginId,
 key
 );
 }
 );

 ipcMain.handle(
 'plugins:setting-set',
 (
 event,
 pluginId,
 key,
 value
 ) => {
 return pluginManager
 .setSettingData(
 pluginId,
 key,
 value
 );
 }
 );

 ipcMain.handle('plugins:data-get', (event, pluginId, key) => {
 return pluginManager.getData(pluginId, key);
 });

 ipcMain.handle('plugins:data-set', (event, pluginId, key, value) => {
 return pluginManager.setData(pluginId, key, value);
 });

 ipcMain.handle('plugins:data-delete', (event, pluginId, key) => {
 return pluginManager.deleteData(pluginId, key);
 });

 ipcMain.handle('plugins:data-clear', (event, pluginId) => {
 return pluginManager.clearData(pluginId);
 });

 ipcMain.handle('plugins:network-fetch', async (event, pluginId, request) => {
 return await pluginManager.networkFetch(pluginId, request);
 });

  ipcMain.on('sync-play-state', (event, isPlaying) => setupThumbarFn(isPlaying));
  ipcMain.on('tray:sync-state', (event, state) => {
    const { updateTrayState } = require('./tray');
    updateTrayState(state);
  });
  ipcMain.on('tray:sync-track', (event, track) => {
    const { updateTrayTrack } = require('./tray');
    updateTrayTrack(track);
  });
  ipcMain.on('tray:sync-lang', (event, lang) => {
    const { updateTrayLang } = require('./tray');
    updateTrayLang(lang);
  }); ipcMain.on('start-scan', (event, paths) => startScan(paths));
 ipcMain.on('log-error', (event, msg) => log.error('[Renderer]', msg));
 return { startScan };
}
module.exports = { setupIpcHandlers };