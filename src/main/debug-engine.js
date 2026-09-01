const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');
const log = require('electron-log');

const {
 APP_NAME
} = require('./app-identity');

/**
 * COSMIC PLAYER - CENTRAL DEBUG ENGINE & LOG PIPELINE
 * Сервис сбора структурированных логов и центральный перехватчик глобальных ошибок Node.js
 */
class DebugEngine {
  constructor() {
    this.debugWindow = null;
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.ipcInitialized = false;

    log.transports.console.level = false;
    this._initIpcHandlers();
    this._initGlobalErrorCatchers();
  }

  /**
   * Перехват критических необработанных ошибок Node.js / Electron Main Process
   */
  _initGlobalErrorCatchers() {
    process.on('uncaughtException', (error) => {
      this.addLog('ERROR', 'error', `[CRITICAL MAIN ERROR] ${error.message}`, error.stack);
    });

    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : null;
      this.addLog('ERROR', 'error', `[UNHANDLED PROMISE REJECTION] ${msg}`, stack);
    });
  }

  /**
   * Запись события в центральный дебаг-буфер и трансляция в окно отладки
   * @param {string} category - Категория ('LYRICS', 'SYSTEM', 'AUDIO', 'IPC', 'ERROR', 'COVERS', 'ACOUSTIC')
   * @param {'info'|'warn'|'error'|'success'} level - Уровень события
   * @param {string} message - Заголовок/сообщение
   * @param {any} [details=null] - Дополнительные данные/объект
   */
  addLog(category, level, message, details = null) {
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      category: category.toUpperCase(),
      level: level || 'info',
      message: message || '',
      details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null
    };

    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.webContents.send('debug:new-log', logEntry);
    }
  }

  /**
   * Создание и открытие автономного окна консоли отладки
   */
  openDebugWindow() {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.show();
      this.debugWindow.focus();
      return;
    }

    this.debugWindow = new BrowserWindow({
      width: 920,
      height: 580,
      minWidth: 700,
      minHeight: 400,
 title: `${APP_NAME} — Console Debugger`,
      backgroundColor: '#0f0823',
      autoHideMenuBar: true,
      frame: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.debugWindow.loadFile(path.join(__dirname, '../renderer/debug.html'));
    this.debugWindow.on('closed', () => {
      this.debugWindow = null;
    });

    this.addLog('SYSTEM', 'info', 'Окно отладочной консоли инициализировано.');
  }

  _initIpcHandlers() {
    if (this.ipcInitialized) return;
    this.ipcInitialized = true;

    ipcMain.handle('debug:get-logs', () => this.logBuffer);
    ipcMain.handle('debug:clear-logs', () => {
      this.logBuffer = [];
      return true;
    });
    ipcMain.on('debug:open-window', () => this.openDebugWindow());
  }
}

const debugEngine = new DebugEngine();
module.exports = debugEngine;