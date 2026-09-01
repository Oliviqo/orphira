const fs = require('fs');
const path = require('path');
const log = require('electron-log');

const {
 parseTrackFile
} = require('./track-parser');

const SUPPORTED_EXTENSIONS =
 /\.(mp3|flac|wav|ogg|m4a|aac|opus)$/i;

/**
 * Рекурсивный обход директорий для поиска аудиотреков.
 */
function walkSync(
 dir,
 filelist = []
) {
 try {
  const files =
   fs.readdirSync(dir);

  for (const file of files) {
   const filePath =
    path.join(
     dir,
     file
    );

   try {
    const stat =
     fs.statSync(filePath);

    if (stat.isDirectory()) {
     walkSync(
      filePath,
      filelist
     );
    } else if (
     stat.isFile() &&
     SUPPORTED_EXTENSIONS.test(
      filePath
     )
    ) {
     filelist.push(
      filePath
     );
    }
   } catch (e) {
    log.warn(
     `[Worker] Не удалось проверить путь: ${filePath}`,
     e
    );
   }
  }
 } catch (e) {
  log.error(
   `[Worker] Ошибка доступа к папке: ${dir}`,
   e
  );
 }

 return filelist;
}

function collectAudioFiles(paths) {
 const result = [];
 const seen = new Set();

 const registerFile =
  filePath => {
   if (
    !filePath ||
    !SUPPORTED_EXTENSIONS.test(
     filePath
    )
   ) {
    return;
   }

   const normalized =
    path.resolve(filePath)
     .toLowerCase();

   if (seen.has(normalized)) {
    return;
   }

   seen.add(normalized);
   result.push(filePath);
  };

 for (const targetPath of paths) {
  if (
   !targetPath ||
   !fs.existsSync(targetPath)
  ) {
   continue;
  }

  try {
   const stat =
    fs.statSync(targetPath);

   if (stat.isDirectory()) {
    const files =
     walkSync(
      targetPath,
      []
     );

    files.forEach(
     registerFile
    );
   } else if (
    stat.isFile()
   ) {
    registerFile(
     targetPath
    );
   }
  } catch (e) {
   log.error(
    `[Worker] Ошибка проверки пути: ${targetPath}`,
    e
   );
  }
 }

 return result;
}

process.on(
 'message',
 async msg => {
  if (
   !msg ||
   msg.type !== 'START_SCAN'
  ) {
   return;
  }

  const paths =
   Array.isArray(
    msg.payload?.paths
   )
    ? msg.payload.paths
    : [];

  const coversPath =
   msg.payload?.coversPath;

  if (!coversPath) {
   log.error(
    '[Worker] Не передан путь к хранилищу covers.'
   );

   if (process.send) {
    process.send({
     type: 'COMPLETE',
     payload: []
    });
   }

   return;
  }

  const allFiles =
   collectAudioFiles(paths);

  const library = [];
  const total =
   allFiles.length;

  if (total === 0) {
   if (process.send) {
    process.send({
     type: 'PROGRESS',
     payload: {
      current: 0,
      total: 0
     }
    });

    process.send({
     type: 'COMPLETE',
     payload: []
    });
   }

   return;
  }

  for (
   let index = 0;
   index < total;
   index++
  ) {
   const filePath =
    allFiles[index];

   const track =
    await parseTrackFile(
     filePath,
     {
      coversRootPath:
       coversPath,

      onError:
       (error, failedPath) => {
        log.error(
         `[Worker] Ошибка парсинга файла: ${failedPath}`,
         error
        );
       }
     }
    );

   if (track) {
    library.push(track);
   }

   if (
    index % 10 === 0 ||
    index === total - 1
   ) {
    if (process.send) {
     process.send({
      type: 'PROGRESS',
      payload: {
       current:
        index + 1,
       total
      }
     });
    }
   }
  }

  if (process.send) {
   process.send({
    type: 'COMPLETE',
    payload:
     library
   });
  }
 }
);