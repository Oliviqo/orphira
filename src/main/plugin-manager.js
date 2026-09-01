const { app, dialog, net } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log');

const MANIFEST_VERSION = 1;
const API_VERSION = 2;

const MAX_PACKAGE_SIZE = 16 * 1024 * 1024;
const MAX_PLUGIN_FILE_SIZE = 8 * 1024 * 1024;
const MAX_RESPONSE_SIZE = 12 * 1024 * 1024;
const MAX_STORAGE_VALUE_SIZE = 2 * 1024 * 1024;

const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SAFE_FILE_RE = /^[a-zA-Z0-9._/-]+$/;

const KNOWN_PERMISSIONS = new Set([
  'player:read',
  'player:control',
  'timeline:read',
  'timeline:control',

  'queue:read',
  'queue:write',

  'library:read',

  'playlists:read',
  'playlists:write',

  'equalizer:read',
  'equalizer:control',
  'equalizer:presets',
  'equalizer:visualizer',

  'lyrics:read',

  'storage',
  'network',

  'ui:notifications',
  'ui:commands',
  'ui:settings',
  'ui:player',
  'ui:sidebar',
  'ui:context-menu',
  'ui:views',
   'ui:layout',

  'themes:register',
  'locales:register',

  'providers:metadata',
  'providers:lyrics',
  'providers:artwork'
]);

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function normalizePluginId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeRelativePath(value) {
  const raw = String(value || '')
    .replace(/\\/g, '/')
    .trim();

  if (
    !raw ||
    raw.startsWith('/') ||
    raw.includes('\0') ||
    raw.split('/').includes('..') ||
    !SAFE_FILE_RE.test(raw)
  ) {
    throw new Error(
      `Unsafe plugin file path: ${raw || '<empty>'}`
    );
  }

  return raw;
}

function parseSemver(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return [0, 0, 0];
  }

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ];
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);

  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }

  return 0;
}

function validateManifest(rawManifest) {
  if (!isObject(rawManifest)) {
    throw new Error(
      'Plugin manifest must be an object.'
    );
  }

  const manifest = clone(rawManifest);

  manifest.id =
    normalizePluginId(manifest.id);

  if (
    manifest.manifestVersion !==
    MANIFEST_VERSION
  ) {
    throw new Error(
      `Unsupported manifestVersion. Expected ${MANIFEST_VERSION}.`
    );
  }

  if (!PLUGIN_ID_RE.test(manifest.id)) {
    throw new Error('Invalid plugin id.');
  }

  if (
    typeof manifest.name !== 'string' ||
    manifest.name.trim().length < 1 ||
    manifest.name.trim().length > 100
  ) {
    throw new Error('Invalid plugin name.');
  }

  if (
    typeof manifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9._-]+)?$/
      .test(manifest.version)
  ) {
    throw new Error(
      'Plugin version must use semantic versioning.'
    );
  }

  if (!isObject(manifest.orphira)) {
    throw new Error(
      'Missing orphira compatibility block.'
    );
  }

  if (
    Number(manifest.orphira.apiVersion) !==
    API_VERSION
  ) {
    throw new Error(
      `Unsupported Orphira Plugin API version: ${manifest.orphira.apiVersion}. Expected ${API_VERSION}.`
    );
  }

  const minimumVersion =
    String(
      manifest.orphira.minimumVersion ||
      '0.0.0'
    );

  if (
    compareSemver(
      app.getVersion(),
      minimumVersion
    ) < 0
  ) {
    throw new Error(
      `Plugin requires Orphira ${minimumVersion} or newer.`
    );
  }

  const permissions =
    Array.isArray(manifest.permissions)
      ? [...new Set(
          manifest.permissions.map(String)
        )]
      : [];

  for (const permission of permissions) {
    if (!KNOWN_PERMISSIONS.has(permission)) {
      throw new Error(
        `Unknown plugin permission: ${permission}`
      );
    }
  }

  manifest.permissions = permissions;

  if (
    manifest.entry !== undefined &&
    manifest.entry !== null
  ) {
    manifest.entry =
      normalizeRelativePath(
        manifest.entry
      );
  }

  if (
    manifest.network !== undefined
  ) {
    if (!isObject(manifest.network)) {
      throw new Error(
        'network must be an object.'
      );
    }

    const hosts =
      Array.isArray(
        manifest.network.hosts
      )
        ? [...new Set(
            manifest.network.hosts
              .map(host =>
                String(host || '')
                  .trim()
                  .toLowerCase()
              )
              .filter(Boolean)
          )]
        : [];

    for (const host of hosts) {
      const wildcard =
        host.startsWith('*.');

      const checkedHost =
        wildcard
          ? host.slice(2)
          : host;

      if (
        !checkedHost ||
        host === '*' ||
        checkedHost.includes('/') ||
        checkedHost.includes(':') ||
        checkedHost.includes(' ') ||
        !/^[a-z0-9.-]+$/.test(
          checkedHost
        )
      ) {
        throw new Error(
          `Invalid network host: ${host}`
        );
      }
    }

    manifest.network.hosts = hosts;
  } else {
    manifest.network = {
      hosts: []
    };
  }

  if (
    manifest.contributes !== undefined &&
    !isObject(manifest.contributes)
  ) {
    throw new Error(
      'contributes must be an object.'
    );
  }

  manifest.contributes =
    isObject(manifest.contributes)
      ? manifest.contributes
      : {};

  manifest.name =
    manifest.name.trim();

  manifest.description =
    String(
      manifest.description || ''
    ).slice(0, 500);

  manifest.author =
    String(
      manifest.author || ''
    ).slice(0, 100);

  manifest.license =
    String(
      manifest.license || ''
    ).slice(0, 100);

  return manifest;
}

class PluginManager {
  constructor() {
    this.rootPath = null;
    this.dataPath = null;
    this.registryPath = null;

    this.registry = {
      plugins: {}
    };
  }

  init() {
    if (this.rootPath) {
      return;
    }

    this.rootPath =
      path.join(
        app.getPath('userData'),
        'plugins'
      );

    this.dataPath =
      path.join(
        this.rootPath,
        '_data'
      );

    this.registryPath =
      path.join(
        this.rootPath,
        'registry.json'
      );

    fs.mkdirSync(
      this.rootPath,
      {
        recursive: true
      }
    );

    fs.mkdirSync(
      this.dataPath,
      {
        recursive: true
      }
    );

    this.registry =
      this._readJson(
        this.registryPath,
        {
          plugins: {}
        }
      );

    if (
      !isObject(
        this.registry.plugins
      )
    ) {
      this.registry.plugins = {};
    }

    this._saveRegistry();
  }

  _readJson(filePath, fallback) {
    try {
      if (
        !fs.existsSync(filePath)
      ) {
        return clone(fallback);
      }

      return JSON.parse(
        fs.readFileSync(
          filePath,
          'utf8'
        )
      );
    } catch (error) {
      log.error(
        '[Plugins] JSON read failed:',
        filePath,
        error
      );

      return clone(fallback);
    }
  }

  _atomicWrite(filePath, content) {
    const temporary =
      `${filePath}.${process.pid}.${Date.now()}.tmp`;

    fs.mkdirSync(
      path.dirname(filePath),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      temporary,
      content,
      'utf8'
    );

    if (
      fs.existsSync(filePath)
    ) {
      fs.rmSync(
        filePath,
        {
          force: true
        }
      );
    }

    fs.renameSync(
      temporary,
      filePath
    );
  }

  _saveRegistry() {
    this._atomicWrite(
      this.registryPath,
      JSON.stringify(
        this.registry,
        null,
        2
      )
    );
  }

  _pluginPath(pluginId) {
    return path.join(
      this.rootPath,
      normalizePluginId(pluginId)
    );
  }

  _pluginDataPath(pluginId) {
    return path.join(
      this.dataPath,
      `${normalizePluginId(pluginId)}.json`
    );
  }

  _requireInstalled(pluginId) {
    const id =
      normalizePluginId(pluginId);

    const record =
      this.registry.plugins[id];

    if (!record) {
      throw new Error(
        'Plugin is not installed.'
      );
    }

    return record;
  }

  assertPermission(
    pluginId,
    permission
  ) {
    const record =
      this._requireInstalled(pluginId);

    if (!record.enabled) {
      throw new Error(
        'Plugin is disabled.'
      );
    }

    if (
      !record.manifest.permissions
        .includes(permission)
    ) {
      throw new Error(
        `Plugin permission denied: ${permission}`
      );
    }
  }

  _readInstalledFile(
    pluginId,
    relativePath
  ) {
    const safeRelative =
      normalizeRelativePath(
        relativePath
      );

    const basePath =
      path.resolve(
        this._pluginPath(pluginId)
      );

    const absolutePath =
      path.resolve(
        basePath,
        safeRelative
      );

    if (
      absolutePath !== basePath &&
      !absolutePath.startsWith(
        `${basePath}${path.sep}`
      )
    ) {
      throw new Error(
        'Plugin attempted to escape its directory.'
      );
    }

    if (
      !fs.existsSync(absolutePath)
    ) {
      throw new Error(
        `Plugin file not found: ${safeRelative}`
      );
    }

    const stat =
      fs.statSync(absolutePath);

    if (
      !stat.isFile() ||
      stat.size >
        MAX_PLUGIN_FILE_SIZE
    ) {
      throw new Error(
        'Invalid plugin file.'
      );
    }

    return fs.readFileSync(
      absolutePath,
      'utf8'
    );
  }

  _readContributionFiles(
    pluginId,
    manifest
  ) {
    const result = {
      themes: [],
      locales: {},
      views: {}
    };

    const themes =
      Array.isArray(
        manifest.contributes?.themes
      )
        ? manifest.contributes.themes
        : [];

    for (const item of themes) {
      if (
        !isObject(item) ||
        !item.id ||
        !item.name ||
        !item.file
      ) {
        continue;
      }

      result.themes.push({
        id: String(item.id),
        name: String(item.name),
        css: this._readInstalledFile(
          pluginId,
          item.file
        )
      });
    }

    const locales =
      Array.isArray(
        manifest.contributes?.locales
      )
        ? manifest.contributes.locales
        : [];

    for (const item of locales) {
      if (
        !isObject(item) ||
        !item.language ||
        !item.file
      ) {
        continue;
      }

      const parsed =
        JSON.parse(
          this._readInstalledFile(
            pluginId,
            item.file
          )
        );

      if (!isObject(parsed)) {
        throw new Error(
          `Invalid locale: ${item.file}`
        );
      }

      result.locales[
        String(item.language)
      ] = parsed;
    }

    const views =
      Array.isArray(
        manifest.contributes?.views
      )
        ? manifest.contributes.views
        : [];

    for (const item of views) {
      if (
        !isObject(item) ||
        !item.id ||
        !item.file
      ) {
        continue;
      }

      result.views[
        String(item.id)
      ] =
        this._readInstalledFile(
          pluginId,
          item.file
        );
    }

    return result;
  }

  _descriptor(pluginId) {
    const record =
      this._requireInstalled(pluginId);

    const manifest =
      clone(record.manifest);

    const contributions =
      this._readContributionFiles(
        pluginId,
        manifest
      );

    return {
      id: manifest.id,
      enabled:
        Boolean(record.enabled),
      manifest,
      source:
        manifest.entry
          ? this._readInstalledFile(
              pluginId,
              manifest.entry
            )
          : '',
      themes:
        contributions.themes,
      locales:
        contributions.locales,
      views:
        contributions.views
    };
  }

  list() {
    this.init();

    return Object
      .keys(this.registry.plugins)
      .sort()
      .map(id => {
        const record =
          this.registry.plugins[id];

        return {
          id,
          enabled:
            Boolean(record.enabled),
          manifest:
            clone(record.manifest)
        };
      });
  }

  getEnabledDescriptors() {
    this.init();

    const result = [];

    for (
      const plugin of this.list()
    ) {
      if (!plugin.enabled) {
        continue;
      }

      try {
        result.push(
          this._descriptor(
            plugin.id
          )
        );
      } catch (error) {
        log.error(
          `[Plugins] Failed loading ${plugin.id}:`,
          error
        );
      }
    }

    return result;
  }

  getDescriptor(pluginId) {
    this.init();
    return this._descriptor(pluginId);
  }

  async selectPackageFile(
    parentWindow
  ) {
    const result =
      await dialog.showOpenDialog(
        parentWindow,
        {
          title:
            'Install Orphira Plugin',
          properties: [
            'openFile'
          ],
          filters: [
            {
              name:
                'Orphira Plugin',
              extensions: [
                'orphira-plugin',
                'json'
              ]
            }
          ]
        }
      );

    if (
      result.canceled ||
      !result.filePaths[0]
    ) {
      return null;
    }

    return this.inspectPackageFile(
      result.filePaths[0]
    );
  }

  inspectPackageFile(filePath) {
    this.init();

    const stat =
      fs.statSync(filePath);

    if (
      !stat.isFile() ||
      stat.size >
        MAX_PACKAGE_SIZE
    ) {
      throw new Error(
        'Invalid plugin package.'
      );
    }

    const raw =
      JSON.parse(
        fs.readFileSync(
          filePath,
          'utf8'
        )
      );

    const validated =
      this._validatePackage(raw);

    return {
      source: 'file',
      packagePath: filePath,
      manifest:
        validated.manifest,
      fileCount:
        Object.keys(
          validated.files
        ).length,
      totalBytes: stat.size
    };
  }

  async inspectPackageUrl(
    urlValue
  ) {
    this.init();

    const url =
      new URL(
        String(urlValue || '')
      );

    if (
      url.protocol !== 'https:'
    ) {
      throw new Error(
        'Plugins may only be downloaded over HTTPS.'
      );
    }

    const body =
      await this._downloadText(
        url.href,
        MAX_PACKAGE_SIZE
      );

    const validated =
      this._validatePackage(
        JSON.parse(body)
      );

    return {
      source: 'url',
      packageUrl: url.href,
      manifest:
        validated.manifest,
      fileCount:
        Object.keys(
          validated.files
        ).length,
      totalBytes:
        Buffer.byteLength(
          body,
          'utf8'
        )
    };
  }

  _validatePackage(rawPackage) {
    if (!isObject(rawPackage)) {
      throw new Error(
        'Invalid plugin package.'
      );
    }

    const manifest =
      validateManifest(
        rawPackage.manifest
      );

    const files =
      isObject(rawPackage.files)
        ? rawPackage.files
        : {};

    const safeFiles = {};
    let totalBytes = 0;

    for (
      const [rawName, content]
      of Object.entries(files)
    ) {
      const safeName =
        normalizeRelativePath(
          rawName
        );

      if (
        typeof content !== 'string'
      ) {
        throw new Error(
          `Plugin file must contain text: ${safeName}`
        );
      }

      const size =
        Buffer.byteLength(
          content,
          'utf8'
        );

      if (
        size >
        MAX_PLUGIN_FILE_SIZE
      ) {
        throw new Error(
          `Plugin file is too large: ${safeName}`
        );
      }

      totalBytes += size;

      if (
        totalBytes >
        MAX_PACKAGE_SIZE
      ) {
        throw new Error(
          'Plugin package exceeds maximum size.'
        );
      }

      safeFiles[safeName] =
        content;
    }

    if (
      manifest.entry &&
      safeFiles[
        manifest.entry
      ] === undefined
    ) {
      throw new Error(
        `Package is missing entry file: ${manifest.entry}`
      );
    }

    const fileReferences = [];

    for (
      const theme of
      manifest.contributes
        ?.themes || []
    ) {
      if (theme?.file) {
        fileReferences.push(
          theme.file
        );
      }
    }

    for (
      const locale of
      manifest.contributes
        ?.locales || []
    ) {
      if (locale?.file) {
        fileReferences.push(
          locale.file
        );
      }
    }

    for (
      const view of
      manifest.contributes
        ?.views || []
    ) {
      if (view?.file) {
        fileReferences.push(
          view.file
        );
      }
    }

    for (
      const rawReference
      of fileReferences
    ) {
      const reference =
        normalizeRelativePath(
          rawReference
        );

      if (
        safeFiles[reference] ===
        undefined
      ) {
        throw new Error(
          `Package is missing contributed file: ${reference}`
        );
      }
    }

    return {
      manifest,
      files: safeFiles
    };
  }

  _installPackage(rawPackage) {
    const validated =
      this._validatePackage(
        rawPackage
      );

    const pluginId =
      validated.manifest.id;

    const installPath =
      this._pluginPath(
        pluginId
      );

    const stagingPath =
      `${installPath}.staging-${crypto.randomUUID()}`;

    fs.rmSync(
      stagingPath,
      {
        recursive: true,
        force: true
      }
    );

    fs.mkdirSync(
      stagingPath,
      {
        recursive: true
      }
    );

    try {
      for (
        const [relative, content]
        of Object.entries(
          validated.files
        )
      ) {
        const destination =
          path.join(
            stagingPath,
            relative
          );

        fs.mkdirSync(
          path.dirname(
            destination
          ),
          {
            recursive: true
          }
        );

        fs.writeFileSync(
          destination,
          content,
          'utf8'
        );
      }

      fs.writeFileSync(
        path.join(
          stagingPath,
          'manifest.json'
        ),
        JSON.stringify(
          validated.manifest,
          null,
          2
        ),
        'utf8'
      );

      fs.rmSync(
        installPath,
        {
          recursive: true,
          force: true
        }
      );

      fs.renameSync(
        stagingPath,
        installPath
      );

      const oldRecord =
        this.registry.plugins[
          pluginId
        ];

      this.registry.plugins[
        pluginId
      ] = {
        manifest:
          validated.manifest,
        enabled:
          oldRecord
            ? Boolean(
                oldRecord.enabled
              )
            : false,
        installedAt:
          new Date()
            .toISOString()
      };

      this._saveRegistry();

      return {
        id: pluginId,
        enabled:
          Boolean(
            this.registry.plugins[
              pluginId
            ].enabled
          ),
        manifest:
          clone(
            validated.manifest
          )
      };
    } catch (error) {
      fs.rmSync(
        stagingPath,
        {
          recursive: true,
          force: true
        }
      );

      throw error;
    }
  }

  installPackageFile(filePath) {
    const raw =
      JSON.parse(
        fs.readFileSync(
          filePath,
          'utf8'
        )
      );

    return this._installPackage(
      raw
    );
  }

  async installPackageUrl(
    urlValue
  ) {
    const url =
      new URL(
        String(urlValue || '')
      );

    if (
      url.protocol !== 'https:'
    ) {
      throw new Error(
        'Plugins may only be downloaded over HTTPS.'
      );
    }

    const body =
      await this._downloadText(
        url.href,
        MAX_PACKAGE_SIZE
      );

    return this._installPackage(
      JSON.parse(body)
    );
  }

  setEnabled(
    pluginId,
    enabled
  ) {
    const record =
      this._requireInstalled(
        pluginId
      );

    record.enabled =
      Boolean(enabled);

    this._saveRegistry();

    return {
      id:
        normalizePluginId(
          pluginId
        ),
      enabled:
        record.enabled
    };
  }

  uninstall(
    pluginId,
    clearData = false
  ) {
    const id =
      normalizePluginId(
        pluginId
      );

    this._requireInstalled(id);

    fs.rmSync(
      this._pluginPath(id),
      {
        recursive: true,
        force: true
      }
    );

    if (clearData) {
      fs.rmSync(
        this._pluginDataPath(id),
        {
          force: true
        }
      );
    }

    delete this.registry.plugins[id];

    this._saveRegistry();

    return true;
  }

 getSettingData(
 pluginId,
 key
 ) {
 this.assertPermission(
 pluginId,
 'ui:settings'
 );
 const data =
 this._readJson(
 this._pluginDataPath(
 pluginId
 ),
 {}
 );
 return data[
 `__setting__${String(key)}`
 ] ?? null;
 }

 setSettingData(
 pluginId,
 key,
 value
 ) {
 this.assertPermission(
 pluginId,
 'ui:settings'
 );

 const serialized =
 JSON.stringify(value);

 if (
 Buffer.byteLength(
 serialized,
 'utf8'
 ) >
 MAX_STORAGE_VALUE_SIZE
 ) {
 throw new Error(
 'Plugin setting value exceeds 2 MB.'
 );
 }

 const data =
 this._readJson(
 this._pluginDataPath(
 pluginId
 ),
 {}
 );

 data[
 `__setting__${String(key)}`
 ] = value;

 this._atomicWrite(
 this._pluginDataPath(
 pluginId
 ),
 JSON.stringify(
 data,
 null,
 2
 )
 );

 return true;
 }

  getData(pluginId, key) {
    this.assertPermission(
      pluginId,
      'storage'
    );

    const data =
      this._readJson(
        this._pluginDataPath(
          pluginId
        ),
        {}
      );

    return data[
      String(key)
    ] ?? null;
  }

  setData(
    pluginId,
    key,
    value
  ) {
    this.assertPermission(
      pluginId,
      'storage'
    );

    const serialized =
      JSON.stringify(value);

    if (
      Buffer.byteLength(
        serialized,
        'utf8'
      ) >
      MAX_STORAGE_VALUE_SIZE
    ) {
      throw new Error(
        'Plugin storage value exceeds 2 MB.'
      );
    }

    const data =
      this._readJson(
        this._pluginDataPath(
          pluginId
        ),
        {}
      );

    data[String(key)] =
      value;

    this._atomicWrite(
      this._pluginDataPath(
        pluginId
      ),
      JSON.stringify(
        data,
        null,
        2
      )
    );

    return true;
  }

  deleteData(
    pluginId,
    key
  ) {
    this.assertPermission(
      pluginId,
      'storage'
    );

    const data =
      this._readJson(
        this._pluginDataPath(
          pluginId
        ),
        {}
      );

    delete data[String(key)];

    this._atomicWrite(
      this._pluginDataPath(
        pluginId
      ),
      JSON.stringify(
        data,
        null,
        2
      )
    );

    return true;
  }

  clearData(pluginId) {
    this._requireInstalled(
      pluginId
    );

    fs.rmSync(
      this._pluginDataPath(
        pluginId
      ),
      {
        force: true
      }
    );

    return true;
  }

  _hostAllowed(
    pluginId,
    hostname
  ) {
    const record =
      this._requireInstalled(
        pluginId
      );

    const allowed =
      record.manifest.network
        ?.hosts || [];

    const target =
      String(hostname || '')
        .toLowerCase();

    return allowed.some(
      rawHost => {
        const host =
          String(rawHost)
            .toLowerCase();

        if (
          host.startsWith('*.')
        ) {
          const root =
            host.slice(2);

          return (
            target !== root &&
            target.endsWith(
              `.${root}`
            )
          );
        }

        return target === host;
      }
    );
  }

  async networkFetch(
    pluginId,
    requestData
  ) {
    this.assertPermission(
      pluginId,
      'network'
    );

    if (
      !isObject(requestData)
    ) {
      throw new Error(
        'Invalid network request.'
      );
    }

    const url =
      new URL(
        String(
          requestData.url || ''
        )
      );

    if (
      url.protocol !== 'https:'
    ) {
      throw new Error(
        'Plugin network access requires HTTPS.'
      );
    }

    if (
      !this._hostAllowed(
        pluginId,
        url.hostname
      )
    ) {
      throw new Error(
        `Network host is not permitted: ${url.hostname}`
      );
    }

    const method =
      String(
        requestData.method ||
        'GET'
      ).toUpperCase();

    const methods =
      new Set([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD'
      ]);

    if (!methods.has(method)) {
      throw new Error(
        `HTTP method is not permitted: ${method}`
      );
    }

    const headers = {};

    if (
      isObject(
        requestData.headers
      )
    ) {
      for (
        const [name, value]
        of Object.entries(
          requestData.headers
        )
      ) {
        const lowered =
          name.toLowerCase();

        if (
          [
            'host',
            'origin',
            'referer',
            'cookie',
            'content-length'
          ].includes(lowered)
        ) {
          continue;
        }

        headers[name] =
          String(value);
      }
    }

    const body =
      requestData.body ===
        undefined ||
      requestData.body === null
        ? null
        : String(
            requestData.body
          );

    return new Promise(
      (resolve, reject) => {
        const request =
          net.request({
            method,
            url: url.href
          });

        for (
          const [name, value]
          of Object.entries(
            headers
          )
        ) {
          request.setHeader(
            name,
            value
          );
        }

        let settled = false;

        request.on(
          'response',
          response => {
            const chunks = [];
            let size = 0;

            response.on(
              'data',
              chunk => {
                if (settled) {
                  return;
                }

                size += chunk.length;

                if (
                  size >
                  MAX_RESPONSE_SIZE
                ) {
                  settled = true;
                  request.abort();

                  reject(
                    new Error(
                      'Plugin response exceeds 12 MB.'
                    )
                  );

                  return;
                }

                chunks.push(
                  Buffer.from(chunk)
                );
              }
            );

            response.on(
              'end',
              () => {
                if (settled) {
                  return;
                }

                settled = true;

                const responseHeaders = {};

                for (
                  const [name, value]
                  of Object.entries(
                    response.headers
                  )
                ) {
                  responseHeaders[
                    name
                  ] =
                    Array.isArray(value)
                      ? value.join(', ')
                      : String(
                          value ?? ''
                        );
                }

                resolve({
                  status:
                    response.statusCode,
                  headers:
                    responseHeaders,
                  body:
                    Buffer.concat(
                      chunks
                    ).toString('utf8')
                });
              }
            );
          }
        );

        request.on(
          'error',
          error => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
        );

        if (body !== null) {
          request.write(body);
        }

        request.end();
      }
    );
  }

  _downloadText(
    url,
    maximum
  ) {
    return new Promise(
      (resolve, reject) => {
        const request =
          net.request({
            method: 'GET',
            url
          });

        let settled = false;

        request.on(
          'response',
          response => {
            if (
              response.statusCode <
                200 ||
              response.statusCode >=
                300
            ) {
              settled = true;

              reject(
                new Error(
                  `Download failed with HTTP ${response.statusCode}.`
                )
              );

              return;
            }

            const chunks = [];
            let size = 0;

            response.on(
              'data',
              chunk => {
                if (settled) {
                  return;
                }

                size += chunk.length;

                if (
                  size > maximum
                ) {
                  settled = true;
                  request.abort();

                  reject(
                    new Error(
                      'Downloaded plugin is too large.'
                    )
                  );

                  return;
                }

                chunks.push(
                  Buffer.from(chunk)
                );
              }
            );

            response.on(
              'end',
              () => {
                if (settled) {
                  return;
                }

                settled = true;

                resolve(
                  Buffer.concat(
                    chunks
                  ).toString('utf8')
                );
              }
            );
          }
        );

        request.on(
          'error',
          error => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
        );

        request.end();
      }
    );
  }
}

module.exports =
  new PluginManager();