const { ipcMain } = require('electron');
const storage = require('./storage');
const log = require('electron-log');

/**
 * Инициализация IPC-обработчиков экспорта и импорта настроек/плейлистов
 */
function initSync() {
  // Экспорт данных приложения в JSON
  ipcMain.handle('sync-export-data', async () => {
    try {
      return {
        config: storage.getConfig(),
        playlists: storage.getPlaylists(),
        exportedAt: Date.now()
      };
    } catch (e) {
      log.error('[Sync] Ошибка экспорта данных:', e);
      return null;
    }
  });

  // Импорт данных из JSON
  ipcMain.handle('sync-import-data', async (event, syncData) => {
    try {
      if (syncData && Array.isArray(syncData.playlists)) {
        storage.savePlaylists(syncData.playlists);
      }
      if (syncData && syncData.config) {
        const currentConfig = storage.getConfig();
        const mergedConfig = { ...currentConfig, ...syncData.config };
        storage.saveConfig(mergedConfig);
      }
      return true;
    } catch (e) {
      log.error('[Sync] Ошибка импорта данных:', e);
      return false;
    }
  });
}

module.exports = { initSync };