const { BrowserWindow, shell } = require('electron');
const path = require('path');
const storage = require('./storage');

const {
 APP_NAME
} = require('./app-identity');

const { getAppIcon, createPixelIcon } = require('./icons');
const log = require('electron-log');

let mainWindow = null;
let currentThumbarIsPlaying = false; // Память текущего состояния кнопок панели задач Windows

/**
 * Создание главного окна приложения BrowserWindow
 * @returns {Electron.BrowserWindow}
 */
function createWindow() {
 const config = storage.getConfig();
 const savedW = config.lastState?.width >= 960 ? config.lastState.width : 1280;
 const savedH = config.lastState?.height >= 540 ? config.lastState.height : 720;
 mainWindow = new BrowserWindow({
 width: savedW,
 height: savedH,
 minWidth: 960,
 minHeight: 540,
 title: APP_NAME,
 frame: false,
 transparent: false,
 backgroundColor: '#1b0a33',
 icon: getAppIcon(),
 webPreferences: {
 nodeIntegration: false,
 contextIsolation: true,
 preload: path.join(__dirname, '../preload/preload.js')
 }
 });
 mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

 // Открытие ВСЕХ внешних ссылок строго в системном браузере по умолчанию
 mainWindow.webContents.on('will-navigate', (event, url) => {
 if (url !== mainWindow.webContents.getURL()) {
 event.preventDefault();
 shell.openExternal(url);
 }
 });

 mainWindow.webContents.setWindowOpenHandler(({ url }) => {
 if (url.startsWith('http://') || url.startsWith('https://')) {
 shell.openExternal(url);
 }
 return { action: 'deny' };
 });

 mainWindow.webContents.on('did-start-loading', () => {
 mainWindow.setResizable(true);
 mainWindow.setMinimumSize(960, 540);
 });
 mainWindow.on('focus', () => mainWindow.webContents.send('window-focus'));
 mainWindow.on('blur', () => mainWindow.webContents.send('window-blur'));
 mainWindow.on('show', () => {
 setTimeout(() => {
 setupThumbarButtons(currentThumbarIsPlaying);
 }, 100);
 });
 mainWindow.on('close', (event) => {
 const latestConfig = storage.getConfig();
 if (latestConfig.closeToTray && !global.isQuiting) {
 event.preventDefault();
 mainWindow.hide();
 } else {
 const bounds = mainWindow.getBounds();
 if (bounds.width >= 960 && bounds.height >= 540) {
 latestConfig.lastState = latestConfig.lastState || {};
 latestConfig.lastState.width = bounds.width;
 latestConfig.lastState.height = bounds.height;
 }
 storage.saveConfig(latestConfig);
 }
 });
 mainWindow.on('enter-full-screen', () => {
 mainWindow.webContents.send('window-fullscreen-change', true);
 });
 mainWindow.on('leave-full-screen', () => {
 mainWindow.webContents.send('window-fullscreen-change', false);
 });
 mainWindow.once('ready-to-show', () => {
 setupThumbarButtons(false);
 });
 return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

/**
 * Настройка системных кнопок управления в предпросмотре панели задач Windows Taskbar (Thumbar)
 * @param {boolean} [isPlaying] - Текущее состояние воспроизведения
 */
function setupThumbarButtons(isPlaying) {
  if (process.platform !== 'win32' || !mainWindow) return;

  if (isPlaying !== undefined) {
    currentThumbarIsPlaying = Boolean(isPlaying);
  }

  const activeState = currentThumbarIsPlaying;

  try {
    const iconPrev = createPixelIcon('prev');
    const iconPlayPause = createPixelIcon(activeState ? 'pause' : 'play');
    const iconNext = createPixelIcon('next');

    mainWindow.setThumbarButtons([
      { tooltip: 'Previous Track', icon: iconPrev, click: () => mainWindow.webContents.send('cmd-prev') },
      { tooltip: activeState ? 'Pause' : 'Play', icon: iconPlayPause, click: () => mainWindow.webContents.send('cmd-play-pause') },
      { tooltip: 'Next Track', icon: iconNext, click: () => mainWindow.webContents.send('cmd-next') }
    ]);
  } catch (e) {
    log.error(e);
  }
}

module.exports = { createWindow, getMainWindow, setupThumbarButtons };