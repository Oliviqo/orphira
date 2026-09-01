const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');
const storage = require('./storage');
const debugEngine = require('./debug-engine');
const { cleanString, cleanTitle } = require('./query-cleaner');

/**
 * ORPHIRA - PLUGIN ENGINE & RUNTIME MANAGER
 * Управление жизненным циклом внешних расширений (Загрузка, Песочница, Вызовы)
 */
class PluginEngine {
  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.plugins = new Map(); // id -> { manifest, module, enabled, path }
    this.pluginSettings = new Map(); // id -> { key: value }
    this._initDir();
  }

  _initDir() {
    try {
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, { recursive: true });
      }
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Ошибка создания папки плагинов: ${e.message}`);
    }
  }

  /**
   * Инициализация и подгрузка всех установленных плагинов
   */
  async init() {
    this._initDir();
    this.plugins.clear();
    const config = storage.getConfig();
    const disabledPlugins = new Set(config.disabledPlugins || []);

    try {
      const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginPath = path.join(this.pluginsDir, entry.name);
        await this._loadPluginFromDir(pluginPath, !disabledPlugins.has(entry.name));
      }
      debugEngine.addLog('SYSTEM', 'info', `Загружено плагинов: ${this.plugins.size}`);
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Ошибка инициализации плагинов: ${e.message}`);
    }
  }

  async _loadPluginFromDir(dirPath, enabled = true) {
    const manifestPath = path.join(dirPath, 'plugin.json');
    if (!fs.existsSync(manifestPath)) return false;

    try {
      const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      if (!manifest.id || !manifest.name) return false;

      const entryFile = manifest.entry || 'entry.js';
      const entryPath = path.join(dirPath, entryFile);
      if (!fs.existsSync(entryPath)) return false;

      // Очистка require.cache для возможности динамической перезагрузки
      delete require.cache[require.resolve(entryPath)];
      const pluginModule = require(entryPath);

      const pluginData = {
        id: manifest.id,
        folderName: path.basename(dirPath),
        manifest,
        module: pluginModule,
        enabled,
        path: dirPath
      };

      this.plugins.set(manifest.id, pluginData);

      if (enabled && typeof pluginModule.init === 'function') {
        const api = this._createApiBridge(pluginData);
        await pluginModule.init(api);
      }
      return true;
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Ошибка загрузки плагина [${path.basename(dirPath)}]: ${e.message}`);
      return false;
    }
  }

  _createApiBridge(pluginData) {
    const manifest = pluginData.manifest;
    const allowedDomains = manifest.permissions?.network || [];

    return {
      http: {
        fetch: async (url, options = {}) => {
          try {
            const parsedUrl = new URL(url);
            const domain = parsedUrl.hostname;
            const isAllowed = allowedDomains.some(d => domain === d || domain.endsWith('.' + d) || d === '*');
            if (!isAllowed) {
              throw new Error(`Domain ${domain} is not in allowed permissions list`);
            }
            const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : net.fetch;
            return await fetchFn(url, options);
          } catch (e) {
            debugEngine.addLog('SYSTEM', 'warn', `[Plugin ${manifest.id}] HTTP Blocked/Failed: ${e.message}`);
            throw e;
          }
        }
      },
      settings: {
        get: async (key) => {
          const config = storage.getConfig();
          const pStore = config.pluginStorage?.[manifest.id] || {};
          return pStore[key] !== undefined ? pStore[key] : null;
        },
        set: async (key, value) => {
          const config = storage.getConfig();
          config.pluginStorage = config.pluginStorage || {};
          config.pluginStorage[manifest.id] = config.pluginStorage[manifest.id] || {};
          config.pluginStorage[manifest.id][key] = value;
          storage.saveConfig(config);
        }
      },
      log: {
        info: (msg) => debugEngine.addLog('SYSTEM', 'info', `[Plugin:${manifest.name}] ${msg}`),
        warn: (msg) => debugEngine.addLog('SYSTEM', 'warn', `[Plugin:${manifest.name}] ${msg}`),
        error: (msg) => debugEngine.addLog('SYSTEM', 'error', `[Plugin:${manifest.name}] ${msg}`)
      },
      utils: {
        cleanString,
        cleanTitle
      }
    };
  }

  getPluginsList() {
    const list = [];
    for (const [id, plugin] of this.plugins.entries()) {
      list.push({
        id: plugin.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description || '',
        author: plugin.manifest.author || '',
        capabilities: plugin.manifest.capabilities || [],
        permissions: plugin.manifest.permissions || {},
        settings: plugin.manifest.settings || [],
        enabled: plugin.enabled
      });
    }
    return list;
  }

  async togglePlugin(id, enabled) {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    plugin.enabled = enabled;

    const config = storage.getConfig();
    config.disabledPlugins = config.disabledPlugins || [];
    if (!enabled) {
      if (!config.disabledPlugins.includes(plugin.folderName)) {
        config.disabledPlugins.push(plugin.folderName);
      }
    } else {
      config.disabledPlugins = config.disabledPlugins.filter(f => f !== plugin.folderName);
    }
    storage.saveConfig(config);

    if (enabled && typeof plugin.module.init === 'function') {
      const api = this._createApiBridge(plugin);
      await plugin.module.init(api);
    }
    return true;
  }

  async uninstallPlugin(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;

    try {
      this.plugins.delete(id);
      fs.rmSync(plugin.path, { recursive: true, force: true });
      debugEngine.addLog('SYSTEM', 'info', `Плагин ${id} успешно удален.`);
      return true;
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Ошибка удаления плагина ${id}: ${e.message}`);
      return false;
    }
  }

  async installFromManifestAndEntry(manifestObj, entryCode) {
    if (!manifestObj || !manifestObj.id || !manifestObj.name) return false;
    const folderName = manifestObj.id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetDir = path.join(this.pluginsDir, folderName);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, 'plugin.json'), JSON.stringify(manifestObj, null, 2), 'utf-8');
      fs.writeFileSync(path.join(targetDir, manifestObj.entry || 'entry.js'), entryCode, 'utf-8');

      await this._loadPluginFromDir(targetDir, true);
      debugEngine.addLog('SYSTEM', 'success', `Плагин "${manifestObj.name}" успешно установлен.`);
      return true;
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Ошибка установки плагина: ${e.message}`);
      return false;
    }
  }

  async installFromUrl(manifestUrl) {
    try {
      const fetchFn = typeof globalThis.fetch === 'function' ? globalThis.fetch : net.fetch;
      const res = await fetchFn(manifestUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();

      const parsedUrl = new URL(manifestUrl);
      const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
      const entryFile = manifest.entry || 'entry.js';
      const entryUrl = new URL(entryFile, baseUrl).toString();

      const entryRes = await fetchFn(entryUrl);
      if (!entryRes.ok) throw new Error(`Entry file HTTP ${entryRes.status}`);
      const entryCode = await entryRes.text();

      return await this.installFromManifestAndEntry(manifest, entryCode);
    } catch (e) {
      debugEngine.addLog('SYSTEM', 'error', `Не удалось установить плагин по ссылке: ${e.message}`);
      return false;
    }
  }

  // --- HOOK DISPATCHERS FOR CORE ENGINE ---

  async queryMetadata(track) {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.capabilities?.includes('metadata')) continue;
      if (typeof plugin.module.onMetadata !== 'function') continue;
      try {
        const api = this._createApiBridge(plugin);
        const res = await plugin.module.onMetadata(track, api);
        if (res && typeof res === 'object') return res;
      } catch (e) {
        debugEngine.addLog('SYSTEM', 'warn', `[Plugin:${plugin.manifest.name}] Metadata hook error: ${e.message}`);
      }
    }
    return null;
  }

  async queryLyrics(track) {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.capabilities?.includes('lyrics')) continue;
      if (typeof plugin.module.onLyrics !== 'function') continue;
      try {
        const api = this._createApiBridge(plugin);
        const res = await plugin.module.onLyrics(track, api);
        if (res && typeof res === 'string' && res.trim()) return res;
      } catch (e) {
        debugEngine.addLog('SYSTEM', 'warn', `[Plugin:${plugin.manifest.name}] Lyrics hook error: ${e.message}`);
      }
    }
    return null;
  }

  async queryCover(track) {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.capabilities?.includes('covers')) continue;
      if (typeof plugin.module.onCover !== 'function') continue;
      try {
        const api = this._createApiBridge(plugin);
        const res = await plugin.module.onCover(track, api);
        if (res) return res;
      } catch (e) {
        debugEngine.addLog('SYSTEM', 'warn', `[Plugin:${plugin.manifest.name}] Cover hook error: ${e.message}`);
      }
    }
    return null;
  }

  async dispatchTrackStart(track) {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.capabilities?.includes('scrobble')) continue;
      if (typeof plugin.module.onTrackStart !== 'function') continue;
      try {
        const api = this._createApiBridge(plugin);
        await plugin.module.onTrackStart(track, api);
      } catch (e) {
        debugEngine.addLog('SYSTEM', 'warn', `[Plugin:${plugin.manifest.name}] Scrobble hook error: ${e.message}`);
      }
    }
  }
}

const pluginEngine = new PluginEngine();
module.exports = pluginEngine;