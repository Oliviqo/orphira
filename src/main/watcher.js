const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const {
 areTrackPathsEqual
} = require('./track-identity');
const {
 parseTrackFile
} = require('./track-parser');
const {
 applyDisplayMetadata
} = require('./track-metadata');
const {
 getMainWindow
} = require('./window');
const log = require('electron-log');

let folderWatchers = [];

const SUPPORTED_EXTENSIONS =
 /\.(mp3|flac|wav|ogg|m4a|aac|opus)$/i;

async function parseSingleFileWithRetry(
 filePath,
 retries = 6,
 delayMs = 600
) {
 for (
  let attempt = 1;
  attempt <= retries;
  attempt++
 ) {
  if (
   fs.existsSync(filePath)
  ) {
   const parsed =
    await parseTrackFile(
     filePath,
     {
      coversRootPath:
       storage.getCoversPath(),

      onError:
       (error, failedPath) => {
        log.warn(
         `[Watcher] Попытка ${attempt}/${retries}: не удалось прочитать ${failedPath}`,
         error
        );
       }
     }
    );

   if (parsed) {
    return parsed;
   }
  }

  if (attempt < retries) {
   await new Promise(
    resolve =>
     setTimeout(
      resolve,
      delayMs
     )
   );
  }
 }

 return null;
}

function mergePreservedOverlay(
 parsedTrack,
 existingTrack
) {
 if (
  !parsedTrack ||
  !existingTrack
 ) {
  return parsedTrack;
 }

 parsedTrack.id =
  existingTrack.id ||
  parsedTrack.id;

 parsedTrack.addedAt =
  existingTrack.addedAt ||
  parsedTrack.addedAt;

 parsedTrack.enrichedMetadata =
  existingTrack.enrichedMetadata &&
  typeof existingTrack.enrichedMetadata ===
   'object'
   ? {
    ...existingTrack.enrichedMetadata
   }
   : {};

 if (
  existingTrack.downloadedCoverPath &&
  fs.existsSync(
   existingTrack.downloadedCoverPath
  )
 ) {
  parsedTrack.downloadedCoverPath =
   existingTrack.downloadedCoverPath;

  parsedTrack.coverPath =
   existingTrack.downloadedCoverPath;
 }

 if (
  existingTrack.downloadedLyricsPath &&
  fs.existsSync(
   existingTrack.downloadedLyricsPath
  )
 ) {
  parsedTrack.downloadedLyricsPath =
   existingTrack.downloadedLyricsPath;
 }

 applyDisplayMetadata(
  parsedTrack
 );

 return parsedTrack;
}

/**
 * Инициализация фонового Chokidar-наблюдателя.
 */
function initFolderWatcher() {
 folderWatchers.forEach(
  watcher => {
   try {
    watcher.close();
   } catch (e) {}
  }
 );

 folderWatchers = [];

 const config =
  storage.getConfig();

 if (
  !Array.isArray(
   config.libraryPaths
  )
 ) {
  config.libraryPaths = [];
 }

 if (
  config.mainDirectory &&
  !config.libraryPaths.includes(
   config.mainDirectory
  )
 ) {
  config.libraryPaths.push(
   config.mainDirectory
  );
 }

 const validPaths =
  config.libraryPaths.filter(
   directory => {
    try {
     return Boolean(
      directory &&
      fs.existsSync(directory)
     );
    } catch (e) {
     return false;
    }
   }
  );

 if (
  validPaths.length === 0
 ) {
  return;
 }

 const pendingAddQueue = [];
 let isProcessingQueue = false;

 async function processAddQueue() {
  if (isProcessingQueue) {
   return;
  }

  isProcessingQueue = true;

  while (
   pendingAddQueue.length > 0
  ) {
   const filePath =
    pendingAddQueue.shift();

   try {
    if (
     !SUPPORTED_EXTENSIONS.test(
      filePath
     )
    ) {
     continue;
    }

    let library =
     storage.getLibrary() || [];

    if (
     library.some(
      track =>
       areTrackPathsEqual(
        track.path,
        filePath
       )
     )
    ) {
     continue;
    }

    const newTrack =
     await parseSingleFileWithRetry(
      filePath
     );

    if (!newTrack) {
     continue;
    }

    library =
     storage.getLibrary() || [];

    if (
     library.some(
      track =>
       areTrackPathsEqual(
        track.path,
        newTrack.path
       )
     )
    ) {
     continue;
    }

    library.push(newTrack);

    storage.saveLibrary(
     library
    );

    const win =
     getMainWindow();

    if (
     win &&
     !win.isDestroyed()
    ) {
     win.webContents.send(
      'watcher:track-added',
      {
       track:
        newTrack,
       updatedLibrary:
        library
      }
     );
    }

    log.info(
     `[Watcher] Инкрементально добавлен трек: ${newTrack.artist} — ${newTrack.title}`
    );
   } catch (error) {
    log.error(
     `[Watcher] Ошибка обработки файла из очереди: ${filePath}`,
     error
    );
   }
  }

  isProcessingQueue = false;
 }

 try {
  const watcher =
   chokidar.watch(
    validPaths,
    {
     ignored:
      /(^|[\/\\])\../,

     persistent:
      true,

     ignoreInitial:
      true,

     depth:
      99,

     awaitWriteFinish: {
      stabilityThreshold:
       800,

      pollInterval:
       150
     }
    }
   );

  watcher.on(
   'unlink',
   filePath => {
    if (
     !SUPPORTED_EXTENSIONS.test(
      filePath
     )
    ) {
     return;
    }

    let library =
     storage.getLibrary() || [];

    const targetTrack =
     library.find(
      track =>
       areTrackPathsEqual(
        track.path,
        filePath
       )
     );

    if (!targetTrack) {
     return;
    }

    library =
     library.filter(
      track =>
       !areTrackPathsEqual(
        track.path,
        filePath
       )
     );

    storage.saveLibrary(
     library
    );

    const win =
     getMainWindow();

    if (
     win &&
     !win.isDestroyed()
    ) {
     win.webContents.send(
      'watcher:track-removed',
      {
       trackId:
        targetTrack.id,
       filePath,
       updatedLibrary:
        library
      }
     );
    }

    log.info(
     `[Watcher] Инкрементально удален трек: ${path.basename(filePath)}`
    );
   }
  );

  watcher.on(
   'add',
   filePath => {
    if (
     !SUPPORTED_EXTENSIONS.test(
      filePath
     )
    ) {
     return;
    }

    pendingAddQueue.push(
     filePath
    );

    processAddQueue();
   }
  );

  watcher.on(
   'change',
   async filePath => {
    if (
     !SUPPORTED_EXTENSIONS.test(
      filePath
     )
    ) {
     return;
    }

    const parsedTrack =
     await parseSingleFileWithRetry(
      filePath
     );

    if (!parsedTrack) {
     return;
    }

    let library =
     storage.getLibrary() || [];

    const index =
     library.findIndex(
      track =>
       areTrackPathsEqual(
        track.path,
        filePath
       )
     );

    if (index === -1) {
     return;
    }

    const existingTrack =
     library[index];

    const updatedTrack =
     mergePreservedOverlay(
      parsedTrack,
      existingTrack
     );

    library[index] =
     updatedTrack;

    storage.saveLibrary(
     library
    );

    const win =
     getMainWindow();

    if (
     win &&
     !win.isDestroyed()
    ) {
     win.webContents.send(
      'watcher:track-updated',
      {
       track:
        updatedTrack,
       updatedLibrary:
        library
      }
     );
    }

    log.info(
     `[Watcher] Инкрементально обновлен трек: ${updatedTrack.title}`
    );
   }
  );

  folderWatchers.push(
   watcher
  );
 } catch (error) {
  log.error(
   '[Watcher] Ошибка запуска Chokidar:',
   error
  );
 }
}

module.exports = {
 initFolderWatcher
};