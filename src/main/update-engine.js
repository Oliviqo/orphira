const {
 app,
 ipcMain
} = require('electron');
const {
 autoUpdater
} = require('electron-updater');
const debugEngine =
 require('./debug-engine');

const UPDATE_CHECK_INTERVAL_MS =
 30 * 60 * 1000;

class UpdateEngine {
 constructor() {
 this.mainWindowGetter = null;
 this.intervalId = null;
 this.initialized = false;
 this.ipcInitialized = false;
 this.checkInProgress = false;
 this.state = {
 supported: app.isPackaged,
 status: 'idle',
 currentVersion: app.getVersion(),
 availableVersion: null,
 releaseName: null,
 releaseNotes: null,
 releaseDate: null,
 percent: 0,
 transferred: 0,
 total: 0,
 bytesPerSecond: 0,
 error: null
 };
 }

 init(getMainWindow) {
 if (this.initialized) {
 return;
 }

 this.initialized = true;
 this.mainWindowGetter =
 typeof getMainWindow === 'function'
 ? getMainWindow
 : null;

 this._configureUpdater();
 this._bindUpdaterEvents();
 this._bindIpcHandlers();

 if (!app.isPackaged) {
 this.state.status =
 'unsupported';
 this._emitState();
 return;
 }

 setTimeout(() => {
 this.checkForUpdates(
 'startup'
 );
 }, 5000);

 this.intervalId =
 setInterval(() => {
 this.checkForUpdates(
 'interval'
 );
 }, UPDATE_CHECK_INTERVAL_MS);
 }

 _configureUpdater() {
 autoUpdater.autoDownload = false;
 autoUpdater.autoInstallOnAppQuit =
 false;
 autoUpdater.allowPrerelease =
 false;
 autoUpdater.logger = {
 info: message => {
 debugEngine.addLog(
 'UPDATE',
 'info',
 String(message)
 );
 },
 warn: message => {
 debugEngine.addLog(
 'UPDATE',
 'warn',
 String(message)
 );
 },
 error: message => {
 debugEngine.addLog(
 'UPDATE',
 'error',
 String(message)
 );
 },
 debug: message => {
 debugEngine.addLog(
 'UPDATE',
 'info',
 String(message)
 );
 }
 };
 }

 _bindUpdaterEvents() {
 autoUpdater.on(
 'checking-for-update',
 () => {
 this.checkInProgress = true;
 this._setState({
 status: 'checking',
 error: null
 });
 }
 );

 autoUpdater.on(
 'update-available',
 info => {
 this.checkInProgress = false;
 this._setState({
 status: 'available',
 availableVersion:
 info?.version || null,
 releaseName:
 info?.releaseName || null,
 releaseNotes:
 this._normalizeReleaseNotes(
 info?.releaseNotes
 ),
 releaseDate:
 info?.releaseDate || null,
 percent: 0,
 transferred: 0,
 total: 0,
 bytesPerSecond: 0,
 error: null
 });

 debugEngine.addLog(
 'UPDATE',
 'success',
 `Доступно обновление Orphira ${info?.version || ''}.`
 );
 }
 );

 autoUpdater.on(
 'update-not-available',
 () => {
 this.checkInProgress = false;
 this._setState({
 status: 'idle',
 availableVersion: null,
 releaseName: null,
 releaseNotes: null,
 releaseDate: null,
 percent: 0,
 transferred: 0,
 total: 0,
 bytesPerSecond: 0,
 error: null
 });
 }
 );

 autoUpdater.on(
 'download-progress',
 progress => {
 this._setState({
 status: 'downloading',
 percent:
 Number(progress?.percent) || 0,
 transferred:
 Number(progress?.transferred) || 0,
 total:
 Number(progress?.total) || 0,
 bytesPerSecond:
 Number(progress?.bytesPerSecond) || 0,
 error: null
 });
 }
 );

 autoUpdater.on(
 'update-downloaded',
 info => {
 this._setState({
 status: 'downloaded',
 availableVersion:
 info?.version ||
 this.state.availableVersion,
 releaseName:
 info?.releaseName ||
 this.state.releaseName,
 releaseNotes:
 this._normalizeReleaseNotes(
 info?.releaseNotes
 ) ||
 this.state.releaseNotes,
 releaseDate:
 info?.releaseDate ||
 this.state.releaseDate,
 percent: 100,
 error: null
 });

 debugEngine.addLog(
 'UPDATE',
 'success',
 `Обновление Orphira ${info?.version || this.state.availableVersion || ''} загружено и готово к установке.`
 );
 }
 );

 autoUpdater.on(
 'error',
 error => {
 this.checkInProgress = false;

 const message =
 error?.message ||
 String(error);

 this._setState({
 status: 'error',
 error: message
 });

 debugEngine.addLog(
 'UPDATE',
 'error',
 `Ошибка системы обновлений: ${message}`
 );
 }
 );
 }

 _bindIpcHandlers() {
 if (this.ipcInitialized) {
 return;
 }

 this.ipcInitialized = true;

 ipcMain.handle(
 'update:get-state',
 () => {
 return this.getState();
 }
 );

 ipcMain.handle(
 'update:check',
 async () => {
 return await this.checkForUpdates(
 'manual'
 );
 }
 );

 ipcMain.handle(
 'update:download',
 async () => {
 return await this.downloadUpdate();
 }
 );

 ipcMain.handle(
 'update:install',
 () => {
 return this.installUpdate();
 }
 );
 }

 _normalizeReleaseNotes(notes) {
 if (!notes) {
 return null;
 }

 if (typeof notes === 'string') {
 return notes;
 }

 if (Array.isArray(notes)) {
 const result =
 notes
 .map(item => {
 if (
 typeof item === 'string'
 ) {
 return item;
 }

 if (
 item &&
 typeof item === 'object'
 ) {
 return String(
 item.note ||
 item.releaseNotes ||
 ''
 );
 }

 return '';
 })
 .filter(Boolean)
 .join('\n\n')
 .trim();

 return result || null;
 }

 return String(notes);
 }

 _setState(patch) {
 this.state = {
 ...this.state,
 ...patch,
 currentVersion:
 app.getVersion(),
 supported:
 app.isPackaged
 };

 this._emitState();
 }

 _emitState() {
 const mainWindow =
 this.mainWindowGetter
 ? this.mainWindowGetter()
 : null;

 if (
 mainWindow &&
 !mainWindow.isDestroyed()
 ) {
 mainWindow.webContents.send(
 'update:state',
 this.getState()
 );
 }
 }

 getState() {
 return {
 ...this.state
 };
 }

 async checkForUpdates(
 reason = 'manual'
 ) {
 if (!app.isPackaged) {
 this._setState({
 status: 'unsupported',
 error: null
 });

 return this.getState();
 }

 if (this.checkInProgress) {
 return this.getState();
 }

 try {
 debugEngine.addLog(
 'UPDATE',
 'info',
 `Проверка обновлений: ${reason}.`
 );

 await autoUpdater
 .checkForUpdates();

 return this.getState();
 } catch (error) {
 this.checkInProgress = false;

 const message =
 error?.message ||
 String(error);

 this._setState({
 status: 'error',
 error: message
 });

 return this.getState();
 }
 }

 async downloadUpdate() {
 if (!app.isPackaged) {
 this._setState({
 status: 'unsupported',
 error: null
 });

 return this.getState();
 }

 if (
 this.state.status ===
 'downloading'
 ) {
 return this.getState();
 }

 if (
 this.state.status !==
 'available'
 ) {
 return this.getState();
 }

 try {
 this._setState({
 status: 'downloading',
 percent: 0,
 transferred: 0,
 total: 0,
 bytesPerSecond: 0,
 error: null
 });

 await autoUpdater
 .downloadUpdate();

 return this.getState();
 } catch (error) {
 const message =
 error?.message ||
 String(error);

 this._setState({
 status: 'error',
 error: message
 });

 return this.getState();
 }
 }

 installUpdate() {
 if (
 !app.isPackaged ||
 this.state.status !==
 'downloaded'
 ) {
 return false;
 }

 debugEngine.addLog(
 'UPDATE',
 'info',
 'Перезапуск Orphira для установки загруженного обновления.'
 );

 global.isQuiting = true;

 setImmediate(() => {
 autoUpdater.quitAndInstall(
 false,
 true
 );
 });

 return true;
 }
}

module.exports =
 new UpdateEngine();