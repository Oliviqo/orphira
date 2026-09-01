const { Tray, Menu, app } = require('electron');
const { getAppIcon, createPixelIcon } = require('./icons');

const {
 APP_NAME
} = require('./app-identity');

let tray = null;
let mainWindowGetter = null;

// Внутреннее состояние трея
const trayState = {
  isPlaying: false,
  isMuted: false,
  currentTrack: null,
  lang: 'en'
};

// Локальный словарь для главного процесса
const LABELS = {
 en: {
 nowPlaying: 'Now Playing',
 noTrack: 'Nothing Playing',
 play: 'Play',
 pause: 'Pause',
 next: 'Next Track',
 prev: 'Previous Track',
 mute: 'Mute',
 unmute: 'Unmute',
 show: `Show ${APP_NAME}`,
 hide: 'Hide Orphira',
 quit: 'Quit'
 },
 ru: {
 nowPlaying: 'Сейчас играет',
 noTrack: 'Ничего не воспроизводится',
 play: 'Воспроизвести',
 pause: 'Пауза',
 next: 'Следующий трек',
 prev: 'Предыдущий трек',
 mute: 'Выключить звук',
 unmute: 'Включить звук',
 show: `Открыть ${APP_NAME}`,
 hide: 'Скрыть плеер',
 quit: 'Выйти'
 }
};

function getL() {
  return LABELS[trayState.lang] || LABELS.en;
}

/**
 * Создание главного системного трея
 */
function createTray(getMainWindow) {
  mainWindowGetter = getMainWindow;
  if (tray) return tray;

  tray = new Tray(getAppIcon());
 tray.setToolTip(APP_NAME);
 
  // Клик по иконке трея переключает видимость главного окна
  tray.on('click', () => {
    toggleWindowVisibility();
  });

  updateTrayMenu();
  return tray;
}

/**
 * Переключение видимости главного окна при клике на трей
 */
function toggleWindowVisibility() {
  if (!mainWindowGetter) return;
  const win = mainWindowGetter();
  if (!win) return;

  if (win.isVisible() && win.isFocused() && !win.isMinimized()) {
    win.hide();
  } else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('window-focus');
  }
  updateTrayMenu();
}

/**
 * Динамическое перестроение контекстного меню трея
 */
function updateTrayMenu() {
  if (!tray) return;

  const l = getL();
  const win = mainWindowGetter ? mainWindowGetter() : null;
  const isWinVisible = win && win.isVisible() && !win.isMinimized();

  // Формирование заголовка текущего трека
  let trackHeaderLabel = l.noTrack;
  if (trayState.currentTrack) {
    const artist = trayState.currentTrack.artist || 'Unknown Artist';
    const title = trayState.currentTrack.title || 'Unknown Track';
    trackHeaderLabel = `🎵 ${artist} — ${title}`;
  }

  // Обновление системной подсказки при наведении
 if (trayState.currentTrack) {
 const statusStr = trayState.isPlaying ? '' : '';
 tray.setToolTip(`${APP_NAME} [${statusStr}]\n${trayState.currentTrack.artist} - ${trayState.currentTrack.title}`);
 } else {
 tray.setToolTip(APP_NAME);
 }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: trackHeaderLabel,
      enabled: false
    },
    { type: 'separator' },
    {
      label: trayState.isPlaying ? l.pause : l.play,
      icon: createPixelIcon(trayState.isPlaying ? 'pause' : 'play'),
      click: () => {
        const w = mainWindowGetter?.();
        if (w && !w.isDestroyed()) w.webContents.send('cmd-play-pause');
      }
    },
    {
      label: l.prev,
      icon: createPixelIcon('prev'),
      click: () => {
        const w = mainWindowGetter?.();
        if (w && !w.isDestroyed()) w.webContents.send('cmd-prev');
      }
    },
    {
      label: l.next,
      icon: createPixelIcon('next'),
      click: () => {
        const w = mainWindowGetter?.();
        if (w && !w.isDestroyed()) w.webContents.send('cmd-next');
      }
    },
    { type: 'separator' },
    {
      label: trayState.isMuted ? l.unmute : l.mute,
      click: () => {
        const w = mainWindowGetter?.();
        if (w && !w.isDestroyed()) w.webContents.send('cmd-toggle-mute');
      }
    },
    {
      label: isWinVisible ? l.hide : l.show,
      click: () => toggleWindowVisibility()
    },
    { type: 'separator' },
    {
      label: l.quit,
      click: () => {
        global.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function updateTrayState({ isPlaying, isMuted }) {
  if (typeof isPlaying === 'boolean') trayState.isPlaying = isPlaying;
  if (typeof isMuted === 'boolean') trayState.isMuted = isMuted;
  updateTrayMenu();
}

function updateTrayTrack(track) {
  trayState.currentTrack = track || null;
  updateTrayMenu();
}

function updateTrayLang(lang) {
  if (lang) {
    trayState.lang = lang;
    updateTrayMenu();
  }
}

module.exports = {
  createTray,
  updateTrayMenu,
  updateTrayState,
  updateTrayTrack,
  updateTrayLang
};