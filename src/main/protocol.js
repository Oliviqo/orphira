const { protocol } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Определение MIME-типа аудиофайла по расширению
 * @param {string} filePath 
 * @returns {string} MIME-тип
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.flac': return 'audio/flac';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.m4a': return 'audio/mp4';
    case '.aac': return 'audio/aac';
    case '.opus': return 'audio/opus';
    default: return 'application/octet-stream';
  }
}

/**
 * Регистрация привилегированного протокола media:// до запуска приложения
 */
function registerMediaProtocol() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
  ]);
}

/**
 * Настройка потокового стриминга файлов через протокол media:// (с поддержкой Range-запросов HTTP 206)
 */
function setupMediaHandler() {
  protocol.handle('media', async (request) => {
    try {
      let rawUrl = request.url.replace(/^media:\/\//, '');

      // Исправление Windows путей (например: /C:/Music/track.mp3 -> C:/Music/track.mp3)
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(rawUrl)) {
            rawUrl = rawUrl.substring(1);
        }
        let filePath = rawUrl;
        try {
            filePath = decodeURIComponent(rawUrl);
        } catch (e) {
            filePath = rawUrl;
        }

      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');

      // Частичная загрузка файла (seek / перемотка аудио)
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const stream = fs.createReadStream(filePath, { start, end });

        return new Response(stream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': getMimeType(filePath)
          }
        });
      } else {
        // Полная передача файла
        const stream = fs.createReadStream(filePath);
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Accept-Ranges': 'bytes',
            'Content-Type': getMimeType(filePath)
          }
        });
      }
    } catch (e) {
      log.error('[Protocol] Ошибка стриминга медиафайла:', e);
      return new Response('Internal Error', { status: 500 });
    }
  });
}

module.exports = { registerMediaProtocol, setupMediaHandler };