const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const debugEngine = require('./debug-engine');

/**
 * COSMIC PLAYER - DOWNLOADED LYRICS CACHE MANAGER
 *
 * Управляет исключительно текстами, полученными из интернета.
 *
 * userData/
 *   lyrics/
 *     embedded/   - неприкосновенный source-слой
 *     downloaded/ - данный менеджер
 */

class LyricsCacheManager {
 constructor() {
  this.cacheDir =
   path.join(
    app.getPath('userData'),
    'lyrics',
    'downloaded'
   );

  this._initDir();
 }

 _initDir() {
  try {
   if (
    !fs.existsSync(
     this.cacheDir
    )
   ) {
    fs.mkdirSync(
     this.cacheDir,
     { recursive: true }
    );
   }
  } catch (e) {
   debugEngine.addLog(
    'LYRICS',
    'error',
    'Ошибка создания папки скачанных текстов:',
    e.message
   );
  }
 }

 _getFileName(key) {
  const hash =
   crypto
    .createHash('md5')
    .update(key)
    .digest('hex');

  return `${hash}.lrc`;
 }

 getPath(key) {
  if (!key) return null;

  this._initDir();

  return path.join(
   this.cacheDir,
   this._getFileName(key)
  );
 }

 get(key) {
  if (!key) return null;

  try {
const filePath =
    this.getPath(key);

   if (
    fs.existsSync(filePath)
   ) {
    const content =
     fs.readFileSync(
      filePath,
      'utf-8'
     );

    if (
     content &&
     content.trim()
    ) {
     return content;
    }
   }
  } catch (e) {
   debugEngine.addLog(
    'LYRICS',
    'error',
    'Ошибка чтения скачанного текста:',
    e.message
   );
  }

  return null;
 }

 save(key, content) {
  if (
   !key ||
   !content
  ) {
   return null;
  }

  try {
   this._initDir();

   const filePath =
    path.join(
     this.cacheDir,
     this._getFileName(key)
    );

   fs.writeFileSync(
    filePath,
    content,
    'utf-8'
   );

   debugEngine.addLog(
    'LYRICS',
    'info',
    `Скачанный текст сохранён в кэш: ${filePath}`
   );

   return filePath;
  } catch (e) {
   debugEngine.addLog(
    'LYRICS',
    'error',
    'Ошибка записи скачанного текста:',
    e.message
   );

   return null;
  }
 }

 remove(key) {
  if (!key) return false;

  try {
const filePath =
    this.getPath(key);

   if (
    fs.existsSync(filePath)
   ) {
    fs.unlinkSync(filePath);
   }

   return true;
  } catch (e) {
   debugEngine.addLog(
    'LYRICS',
    'error',
    'Ошибка удаления скачанного текста:',
    e.message
   );

   return false;
  }
 }

 clear() {
  try {
   this._initDir();

   const entries =
    fs.readdirSync(
     this.cacheDir,
     {
      withFileTypes: true
     }
    );

   for (const entry of entries) {
    if (!entry.isFile()) {
     continue;
    }

    fs.unlinkSync(
     path.join(
      this.cacheDir,
      entry.name
     )
    );
   }

   debugEngine.addLog(
    'LYRICS',
    'info',
    'Кэш скачанных текстов полностью очищен.'
   );

   return true;
  } catch (e) {
   debugEngine.addLog(
    'LYRICS',
    'error',
    'Ошибка очистки скачанных текстов:',
    e.message
   );

   return false;
  }
 }

 getCacheDir() {
  this._initDir();
  return this.cacheDir;
 }
}

module.exports =
 new LyricsCacheManager();