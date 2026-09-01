const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const {
  normalizeTrackPath,
  createTrackId
} = require('./track-identity');
const {
  ensureAssetDirectories,
  cleanupDownloadedAssets,
  resolveActiveLyricsPath
} = require('./track-assets');
const {
  applyDisplayMetadata
} = require('./track-metadata');

/**
 * Вспомогательная функция глубокого слияния объектов (Защита от отсутствующих ключей)
 */
function deepMerge(target, source) {
 if (typeof target !== 'object' || target === null) return source;
 for (const key of Object.keys(source)) {
 if (source[key] instanceof Object && !Array.isArray(source[key])) {
 if (!target[key]) Object.assign(target, { [key]: {} });
 deepMerge(target[key], source[key]);
 } else if (target[key] === undefined) {
 target[key] = source[key];
 }
 }
 return target;
}
class Storage {
 constructor() {
 this.userDataPath = app.getPath('userData');
 this.configPath = path.join(this.userDataPath, 'config.json');
 this.libraryPath = path.join(this.userDataPath, 'library.json');
 this.playlistsPath = path.join(this.userDataPath, 'playlists.json');
 this.coversPath = path.join(this.userDataPath, 'covers');
 // Настройки по умолчанию
    // Настройки по умолчанию
    this.defaultConfig = {
      theme: 'dark',
      font: 'outfit',
      fontSize: 100, // Масштаб шрифта в % (80 - 120)
      starsEnabled: true,
      starsCount: 70,
      starsSpeed: 0.3,
      queueKeepPlayed: false,
      rememberQueue: true,
      autoLayoutFix: true,
      language: 'en',
      closeToTray: true,
      tooltipsEnabled: true,
 onlineLyricsEnabled: false,
 acoustidKey: '',
 crossfadeEnabled: false,
      crossfadeDuration: 2,
      karaokeScrollDelay: 4,
      karaokeFontSize: 28,
 karaokePreset: 'medium',
 fullscreenPlayerTheme: 'reference',
      libraryPaths: [],
      mainDirectory: null,
      eq: {
        preset: 'custom1',
        gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        customPresets: {
          custom1: { name: 'Custom 1', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
          custom2: { name: 'Custom 2', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
          custom3: { name: 'Custom 3', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
        }
      },
      lastState: {
        volume: 50,
        playbackRate: 1.0,
        trackId: null,
        currentTime: 0,
        shuffle: false,
        repeat: 0,
        queue: [],
        searchHistory: [],
        width: 1280,
        height: 720
      }
    };
    
 this._initDirs();
 }
 /** Инициализация папок и дефолтных JSON конфигураций */
 _initDirs() {
 try {
ensureAssetDirectories(
 this.coversPath
);
 if (!fs.existsSync(this.configPath)) this.saveConfig(this.defaultConfig);
 if (!fs.existsSync(this.libraryPath)) this.saveLibrary([]);
 if (!fs.existsSync(this.playlistsPath)) this.savePlaylists([]);
 } catch (e) {
 log.error('[Storage] Ошибка создания базовых файлов и папок:', e);
 }
 }
 /** Безопасное чтение JSON с восстановлением из бэкапа .backup.json при сбое */
 _safeRead(filePath, defaultData) {
 try {
 if (!fs.existsSync(filePath)) return defaultData;
 const data = fs.readFileSync(filePath, 'utf-8');
 return JSON.parse(data);
 } catch (error) {
 log.error(`[Storage] Ошибка чтения ${filePath}. Попытка загрузить бэкап...`, error);
 const backupPath = `${filePath}.backup.json`;
 if (fs.existsSync(backupPath)) {
 try {
 const backupData = fs.readFileSync(backupPath, 'utf-8');
 log.info(`[Storage] Восстановлено из бэкапа: ${backupPath}`);
 return JSON.parse(backupData);
 } catch (backupError) {
 log.error(`[Storage] Бэкап тоже поврежден: ${backupPath}`, backupError);
 }
 }
 return defaultData;
 }
 }
 /** Безопасная запись JSON с атомарным сохранением бэкапа */
 _safeWrite(filePath, data) {
 try {
 if (fs.existsSync(filePath)) {
 fs.copyFileSync(filePath, `${filePath}.backup.json`);
 }
 fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
 } catch (error) {
 log.error(`[Storage] Ошибка записи в ${filePath}`, error);
 }
 }
 /** Получение конфигурации с гарантийным слиянием недостающих полей */
 getConfig() {
 const defaultConfig =
 JSON.parse(
 JSON.stringify(
 this.defaultConfig
 )
 );

 const loaded =
 this._safeRead(
 this.configPath,
 defaultConfig
 );

 if (
 !loaded ||
 typeof loaded !== 'object' ||
 Array.isArray(loaded)
 ) {
 return defaultConfig;
 }

 return deepMerge(
 loaded,
 defaultConfig
 );
 }
 saveConfig(config) {
 this._safeWrite(this.configPath, config);
 }
 getLibrary() {
 const lib = this._safeRead(this.libraryPath, []);
 return Array.isArray(lib) ? lib : [];
 }
 saveLibrary(library) {
 this._safeWrite(this.libraryPath, library);
 }
 /** Объединение отсканированных треков с существующей библиотекой и удаление несуществующих */
  mergeLibraryTracks(scannedTracks) {
    const currentLib = this.getLibrary();
    const safeScannedTracks = Array.isArray(scannedTracks)
      ? scannedTracks
      : [];
    const existingByPath = new Map();
    currentLib.forEach(track => {
      if (!track || !track.path) return;
      const normalizedPath = normalizeTrackPath(track.path);
      if (!normalizedPath) return;
      existingByPath.set(normalizedPath, track);
    });
    const mergedByPath = new Map();
    safeScannedTracks.forEach(scannedTrack => {
      if (!scannedTrack || !scannedTrack.path) return;
      const normalizedPath = normalizeTrackPath(scannedTrack.path);
      if (!normalizedPath) return;
      const existingTrack = existingByPath.get(normalizedPath);
      const stableId =
        existingTrack?.id ||
        scannedTrack.id ||
        createTrackId(scannedTrack.path);

      const mergedTrack = {
        ...(existingTrack || {}),
        ...scannedTrack,
        id: stableId
      };

      // Защита сохраненного слоя метаданных и скачанных ассетов
      if (existingTrack) {
        if (existingTrack.enrichedMetadata && typeof existingTrack.enrichedMetadata === 'object') {
          mergedTrack.enrichedMetadata = {
            ...existingTrack.enrichedMetadata
          };
        }
        if (existingTrack.downloadedCoverPath && fs.existsSync(existingTrack.downloadedCoverPath)) {
          mergedTrack.downloadedCoverPath = existingTrack.downloadedCoverPath;
          mergedTrack.coverPath = existingTrack.downloadedCoverPath;
        }
        if (existingTrack.downloadedLyricsPath && fs.existsSync(existingTrack.downloadedLyricsPath)) {
          mergedTrack.downloadedLyricsPath = existingTrack.downloadedLyricsPath;
          mergedTrack.lyricsPath = resolveActiveLyricsPath(mergedTrack, existingTrack.downloadedLyricsPath);
        }
        applyDisplayMetadata(mergedTrack);
      }

      mergedByPath.set(normalizedPath, mergedTrack);
    });
    currentLib.forEach(existingTrack => {
      if (!existingTrack || !existingTrack.path) return;
      const normalizedPath = normalizeTrackPath(existingTrack.path);
      if (!normalizedPath) return;
      if (!mergedByPath.has(normalizedPath)) {
        mergedByPath.set(normalizedPath, existingTrack);
      }
    });
    const updatedLib = Array.from(mergedByPath.values()).filter(track => {
      try {
        return Boolean(track?.path && fs.existsSync(track.path));
      } catch (e) {
        return false;
      }
    });
    this.saveLibrary(updatedLib);
    cleanupDownloadedAssets(updatedLib, this.coversPath);
    return updatedLib;
  }
 getPlaylists() {
 const pl = this._safeRead(this.playlistsPath, []);
 return Array.isArray(pl) ? pl : [];
 }
 savePlaylists(playlists) {
 this._safeWrite(this.playlistsPath, playlists);
 }
 getCoversPath() {
 return this.coversPath;
 }
}
module.exports = new Storage();