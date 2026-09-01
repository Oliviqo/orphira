const { app, powerMonitor } = require('electron');
const {
 APP_ID
} = require('./app-identity');

// Отключение внутреннего сервиса автозаполнения Chromium для предотвращения варнингов в DevTools
app.commandLine.appendSwitch('disable-features', 'Autofill');

if (process.platform === 'win32') {
 app.setAppUserModelId(APP_ID);
}
const { registerMediaProtocol, setupMediaHandler } = require('./protocol');
const { createWindow, getMainWindow, setupThumbarButtons } = require('./window');
const { createTray } = require('./tray');
const { initFolderWatcher } = require('./watcher');
const { setupIpcHandlers } = require('./ipc-handlers');
const { initSync } = require('./sync');
const updateEngine =
 require('./update-engine');
const {
 initShuffleDiagnostics
} = require('./shuffle-diagnostics');
// 1. Регистрация кастомного протокола media:// ДО готовности app
registerMediaProtocol();
require('./debug-engine');
// 2. Блокировка повторного запуска приложения (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
 app.quit();
 process.exit(0);
}
global.isQuiting = false;
// 3. Главный цикл инициализации Electron
app.whenReady().then(() => {
 setupMediaHandler();
 createWindow();
 createTray(getMainWindow);
  updateEngine.init(
 getMainWindow
 );
 initSync();
  initShuffleDiagnostics();
  const { startScan } = setupIpcHandlers(getMainWindow, initFolderWatcher, setupThumbarButtons);
  initFolderWatcher(startScan, getMainWindow);
 // 4. Защита от фантомных сбоев при сне OS: мягкая перезагрузка Renderer при просыпании
 powerMonitor.on('suspend', () => {
 const win = getMainWindow();
 if (win && !win.isDestroyed()) {
 // Принудительно заставляем Renderer сохранить точное время перед сном
 win.webContents.send('power-suspend');
 }
 });
 powerMonitor.on('resume', () => {
 const win = getMainWindow();
 if (win && !win.isDestroyed()) {
 // Мгновенная перезагрузка Renderer с чистым Web Audio API и восстановлением из storage
 setTimeout(() => {
 win.webContents.reload();
 }, 500); // 500мс задержка для полной инициализации аудио-драйверов OS
 }
 });
});
// Обработка повторного запуска с передачей файла
app.on('second-instance', (event, commandLine) => {
 const mainWindow = getMainWindow();
 if (mainWindow) {
 if (mainWindow.isMinimized()) mainWindow.restore();
 mainWindow.show();
 mainWindow.focus();
 const filePath = commandLine.find(arg => /\.(mp3|flac|wav|ogg|m4a|aac|opus)$/i.test(arg));
 if (filePath) {
 mainWindow.webContents.send('open-external-file', filePath);
 }
 }
});
app.on('window-all-closed', () => {
 if (process.platform !== 'darwin') app.quit();
});