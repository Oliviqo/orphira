const { contextBridge, ipcRenderer, webUtils } = require('electron');
/**
 * Изолированный безопасный IPC-мост между Main Process и Renderer
 */
contextBridge.exposeInMainWorld('api', {
 window: {
 control: (cmd) => ipcRenderer.invoke('window-cmd', cmd),
 toggleMiniplayer: (isMini) => ipcRenderer.invoke('toggle-miniplayer', isMini),
 expandMiniplayer: (expanded) => ipcRenderer.invoke('expand-miniplayer', expanded),
 onBlurAnim: (cb) => ipcRenderer.on('window-blur-anim', cb),
 onFocus: (cb) => ipcRenderer.on('window-focus', cb),
 onFullscreenChange: (cb) => ipcRenderer.on('window-fullscreen-change', (e, isFS) => cb(isFS)),
 setTitle: (title) => ipcRenderer.invoke('window-set-title', title)
 },
 os: {
 selectFolder: () => ipcRenderer.invoke('dialog-select-folder'),
 showItem: (path) => ipcRenderer.invoke('os-show-item', path),
  openExternal: (url) => ipcRenderer.invoke('os-open-external', url),
 trashItem: (path) => ipcRenderer.invoke('os-trash-item', path),
 validatePaths: (paths) => ipcRenderer.invoke('os-validate-paths', paths),
 /**
 * [BATCH RESERVATION FOR DEVELOPERS]
 * Массовое удаление файлов в корзину ОС.
 * @param {Array<string>} filePaths
 */
 trashItemBatch: (filePaths) => ipcRenderer.invoke('os-trash-items-batch', filePaths),
 /**
 * [BATCH RESERVATION FOR DEVELOPERS]
 * Массовое перемещение файлов в целевую директорию.
 * @param {Array<{ sourcePath: string, targetDirectory: string }>} moveTasks
 */
 moveItemsBatch: (moveTasks) => ipcRenderer.invoke('os-move-items-batch', moveTasks),
 
    searchInLyrics: (data) => ipcRenderer.invoke('search-in-lyrics', data),
 
 readLyrics: (path) => ipcRenderer.invoke('read-lyrics', path),
  resolveTrackLyrics: (track) => ipcRenderer.invoke('resolve-track-lyrics', track),
 fetchOnlineLyrics: (artist, title, path) => ipcRenderer.invoke('fetch-online-lyrics', { artist, title, path }),
 getPathForFile: (file) => {
 try {
 return webUtils ? webUtils.getPathForFile(file) : (file.path || '');
 } catch (e) {
 return file.path || '';
 }
 }
 },
 db: {
 getConfig: () => ipcRenderer.invoke('db-get-config'),
 saveConfig: (c) => ipcRenderer.invoke('db-save-config', c),
 getLibrary: () => ipcRenderer.invoke('db-get-library'),
 saveLibrary: (l) => ipcRenderer.invoke('db-save-library', l),
 getPlaylists: () => ipcRenderer.invoke('db-get-playlists'),
 savePlaylists: (p) => ipcRenderer.invoke('db-save-playlists', p),
 clearCacheSelective: (options) => ipcRenderer.invoke('db:clear-cache-selective', options)
 },
 batch: {
 getStats: (trackIds) => ipcRenderer.invoke('batch:get-stats', trackIds),
 getStatus: () => ipcRenderer.invoke('batch:get-status'),
 startCovers: (mode, trackIds) => ipcRenderer.invoke('batch:start-covers', mode, trackIds),
 startMetadata: (trackIds) => ipcRenderer.invoke('batch:start-metadata', trackIds),
 cancel: () => ipcRenderer.invoke('batch:cancel'),
 downloadAlbumCover: (trackIds) => ipcRenderer.invoke('album:download-cover', trackIds),
 onProgress: (cb) => ipcRenderer.on('batch:progress', (e, data) => cb(data))
 },
 scanner: {
 start: (paths) => ipcRenderer.send('start-scan', paths),
 onProgress: (cb) => ipcRenderer.on('scan-progress', (e, data) => cb(data)),
 onComplete: (cb) => ipcRenderer.on('scan-complete', (e, lib) => cb(lib)),
 onLibraryDataUpdated: (cb) => ipcRenderer.on('library-data-updated', (e, lib) => cb(lib))
 },
 watcher: {
 onRemoved: (cb) => ipcRenderer.on('watcher:track-removed', (e, data) => cb(data)),
 onAdded: (cb) => ipcRenderer.on('watcher:track-added', (e, data) => cb(data)),
 onUpdated: (cb) => ipcRenderer.on('watcher:track-updated', (e, data) => cb(data))
 },
  media: {
    syncState: (isPlaying) => ipcRenderer.send('sync-play-state', isPlaying),
    syncTrayState: (state) => ipcRenderer.send('tray:sync-state', state),
    syncTrayTrack: (track) => ipcRenderer.send('tray:sync-track', track),
    syncTrayLang: (lang) => ipcRenderer.send('tray:sync-lang', lang),
    onPlayPause: (cb) => ipcRenderer.on('cmd-play-pause', cb),
    onNext: (cb) => ipcRenderer.on('cmd-next', cb),
    onPrev: (cb) => ipcRenderer.on('cmd-prev', cb),
    onToggleMute: (cb) => ipcRenderer.on('cmd-toggle-mute', cb)
  },

 shuffleDiagnostics: {
 writeLibrary: (tracks) =>
 ipcRenderer.invoke(
 'shuffle-diagnostics:library',
 tracks
 ),
 writeDeck: (tracks, context) =>
 ipcRenderer.invoke(
 'shuffle-diagnostics:deck',
 tracks,
 context
 ),
 getAnalytics: () =>
 ipcRenderer.invoke(
 'shuffle-diagnostics:get'
 )
 },

 sync: {
 exportData: () => ipcRenderer.invoke('sync-export-data'),
 importData: (data) => ipcRenderer.invoke('sync-import-data', data)
 },
 debug: {
 open: () => ipcRenderer.send('debug:open-window')
 },

 plugins: {
 list: () => ipcRenderer.invoke('plugins:list'),
 getEnabled: () => ipcRenderer.invoke('plugins:get-enabled'),
 getDescriptor: (pluginId) => ipcRenderer.invoke('plugins:get-descriptor', pluginId),
 selectPackage: () => ipcRenderer.invoke('plugins:select-package'),
 inspectUrl: (url) => ipcRenderer.invoke('plugins:inspect-url', url),
 installFile: (filePath) => ipcRenderer.invoke('plugins:install-file', filePath),
 installUrl: (url) => ipcRenderer.invoke('plugins:install-url', url),
 setEnabled: (pluginId, enabled) => ipcRenderer.invoke('plugins:set-enabled', pluginId, enabled),
 uninstall: (pluginId, clearData = false) => ipcRenderer.invoke('plugins:uninstall', pluginId, clearData),
 
  settingGet: (pluginId, key) => ipcRenderer.invoke('plugins:setting-get', pluginId, key),
 settingSet: (pluginId, key, value) => ipcRenderer.invoke('plugins:setting-set', pluginId, key, value),
 
 dataGet: (pluginId, key) => ipcRenderer.invoke('plugins:data-get', pluginId, key),
 dataSet: (pluginId, key, value) => ipcRenderer.invoke('plugins:data-set', pluginId, key, value),
 dataDelete: (pluginId, key) => ipcRenderer.invoke('plugins:data-delete', pluginId, key),
 dataClear: (pluginId) => ipcRenderer.invoke('plugins:data-clear', pluginId),
 networkFetch: (pluginId, request) => ipcRenderer.invoke('plugins:network-fetch', pluginId, request)
 },

 app: {
 getVersion: () => ipcRenderer.invoke('app:get-version'),
 getIdentity: () => ipcRenderer.invoke('app:get-identity')
 },
 update: {
 getState: () =>
 ipcRenderer.invoke(
 'update:get-state'
 ),
 check: () =>
 ipcRenderer.invoke(
 'update:check'
 ),
 download: () =>
 ipcRenderer.invoke(
 'update:download'
 ),
 install: () =>
 ipcRenderer.invoke(
 'update:install'
 ),
 onState: (callback) =>
 ipcRenderer.on(
 'update:state',
 (event, state) =>
 callback(state)
 )
 },
  events: {
 onExternalFile: (cb) => ipcRenderer.on('open-external-file', (e, path) => cb(path)),
 onPowerSuspend: (cb) => ipcRenderer.on('power-suspend', () => cb())
 },
 logError: (msg) => ipcRenderer.send('log-error', msg)



});
