class OrphiraPluginSettings {
 t(key, fallback) {
 const translated =
 window.i18n?.t(key);

 return (
 translated &&
 translated !== key
 )
 ? translated
 : fallback;
 }

 escape(value) {
 return window.escapeHTML
 ? window.escapeHTML(
 String(value ?? '')
 )
 : String(value ?? '');
 }

 confirm(
 title,
 message,
 danger = false
 ) {
 return new Promise(
 resolve => {
 if (
 typeof showConfirm ===
 'function'
 ) {
 showConfirm(
 title,
 message,
 danger,
 confirmed =>
 resolve(
 Boolean(confirmed)
 )
 );

 return;
 }

 resolve(
 window.confirm(
 `${title}\n\n${message}`
 )
 );
 }
 );
 }

 prompt(
 title,
 initial = ''
 ) {
 return new Promise(
 resolve => {
 if (
 typeof showPrompt ===
 'function'
 ) {
 showPrompt(
 title,
 initial,
 value =>
 resolve(value)
 );

 return;
 }

 resolve(
 window.prompt(
 title,
 initial
 )
 );
 }
 );
 }

 permissionLabel(
 permission
 ) {
 const key =
 `plugin_permission_${permission
 .replace(/[:.-]/g, '_')}`;

 const translated =
 window.i18n?.t(key);

 return (
 translated &&
 translated !== key
 )
 ? translated
 : permission;
 }

 async build() {
 const root =
 document.createElement(
 'div'
 );

 root.className =
 'settings-group-block plugin-settings-root';

 root.innerHTML = `
 <div class="settings-group-header">
 <span class="settings-group-title" data-i18n="plugins_title">PLUGINS</span>
 </div>

 <div class="settings-card">
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="plugins_install_title">Install Plugin</span>
 <span class="settings-desc" data-i18n="plugins_install_desc">Install sandboxed Orphira extensions.</span>
 </div>

 <div class="settings-control">
 <button class="custom-btn" id="plugin-install-file" data-i18n="plugins_install_file">Install from File</button>
 <button class="custom-btn" id="plugin-install-url" data-i18n="plugins_install_url">Install from URL</button>
 </div>
 </div>
 </div>

 <div id="plugin-installed-list"></div>
 `;

 root
 .querySelector(
 '#plugin-install-file'
 )
 ?.addEventListener(
 'click',
 () =>
 this.installFromFile()
 );

 root
 .querySelector(
 '#plugin-install-url'
 )
 ?.addEventListener(
 'click',
 () =>
 this.installFromUrl()
 );

 await this.renderInstalled(
 root.querySelector(
 '#plugin-installed-list'
 )
 );

 return root;
 }

 async approve(info) {
 const manifest =
 info.manifest;

 const permissions =
 Array.isArray(
 manifest.permissions
 )
 ? manifest.permissions
 : [];

 let message =
 `${manifest.name}\n` +
 `${this.t(
 'plugins_version',
 'Version'
 )}: ${manifest.version}`;

 if (manifest.author) {
 message +=
 `\n${this.t(
 'plugins_author',
 'Author'
 )}: ${manifest.author}`;
 }

 message +=
 `\n\n${this.t(
 'plugins_permissions_requested',
 'Requested permissions:'
 )}`;

 if (
 permissions.length === 0
 ) {
 message +=
 `\n• ${this.t(
 'plugins_no_permissions',
 'No special permissions'
 )}`;
 } else {
 for (
 const permission
 of permissions
 ) {
 message +=
 `\n• ${this.permissionLabel(
 permission
 )}`;
 }
 }

 const hosts =
 manifest.network
 ?.hosts || [];

 if (hosts.length > 0) {
 message +=
 `\n\n${this.t(
 'plugins_network_hosts',
 'Network access:'
 )}`;

 for (
 const host of hosts
 ) {
 message +=
 `\n• ${host}`;
 }
 }

 return await this.confirm(
 this.t(
 'plugins_confirm_install',
 'Install this plugin?'
 ),
 message,
 false
 );
 }

 async installFromFile() {
 try {
 const info =
 await window.api.plugins
 .selectPackage();

 if (!info) {
 return;
 }

 const approved =
 await this.approve(info);

 if (!approved) {
 return;
 }

 await window.api.plugins
 .installFile(
 info.packagePath
 );

 await window.PluginRuntime
 .reload();

 window.Toast
 ?.success(
 this.t(
 'plugins_installed',
 'Plugin installed'
 )
 );

 window.SettingsView
 ?.renderCategory(
 'plugins'
 );
 } catch (error) {
 console.error(
 '[Plugins]',
 error
 );

 window.Toast
 ?.error(
 `${this.t(
 'plugins_install_failed',
 'Plugin installation failed'
 )}: ${error.message}`
 );
 }
 }

 async installFromUrl() {
 const url =
 await this.prompt(
 this.t(
 'plugins_url_prompt_title',
 'Install Plugin from URL'
 ),
 'https://'
 );

 if (!url) {
 return;
 }

 try {
 const info =
 await window.api.plugins
 .inspectUrl(url);

 if (
 !await this.approve(info)
 ) {
 return;
 }

 await window.api.plugins
 .installUrl(url);

 await window.PluginRuntime
 .reload();

 window.Toast
 ?.success(
 this.t(
 'plugins_installed',
 'Plugin installed'
 )
 );

 window.SettingsView
 ?.renderCategory(
 'plugins'
 );
 } catch (error) {
 console.error(
 '[Plugins]',
 error
 );

 window.Toast
 ?.error(
 `${this.t(
 'plugins_install_failed',
 'Plugin installation failed'
 )}: ${error.message}`
 );
 }
 }

 async renderInstalled(
 container
 ) {
 if (!container) {
 return;
 }

 const plugins =
 await window.api.plugins
 .list();

 container.innerHTML = '';

 if (
 plugins.length === 0
 ) {
 container.innerHTML = `
 <div class="plugin-empty-state" data-i18n="plugins_empty">No plugins installed.</div>
 `;

 window.i18n
 ?.updateDOM();

 return;
 }

 for (
 const plugin
 of plugins
 ) {
 const card =
 document.createElement(
 'div'
 );

 card.className =
 'settings-card plugin-card';

 const permissions =
 (
 plugin.manifest
 .permissions || []
 )
 .map(
 permission =>
 this.permissionLabel(
 permission
 )
 )
 .join(' • ');

 card.innerHTML = `
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label">
 ${this.escape(plugin.manifest.name)}
 <span class="plugin-version">v${this.escape(plugin.manifest.version)}</span>
 </span>

 <span class="settings-desc">${this.escape(plugin.manifest.description || '')}</span>
 <span class="plugin-author">${this.escape(plugin.manifest.author || '')}</span>
 <span class="plugin-permissions">${this.escape(permissions || this.t('plugins_no_permissions', 'No special permissions'))}</span>
 </div>

 <div class="settings-control">
 <label class="toggle-switch">
 <input type="checkbox" class="plugin-enable" ${plugin.enabled ? 'checked' : ''}>
 <span class="toggle-slider"></span>
 </label>

 <button class="custom-btn plugin-clear" data-i18n="plugins_clear_data">Clear Data</button>
 <button class="custom-btn danger-btn plugin-remove" data-i18n="plugins_uninstall">Uninstall</button>
 </div>
 </div>
 `;

 card
 .querySelector(
 '.plugin-enable'
 )
 ?.addEventListener(
 'change',
 async event => {
 try {
 await window.api.plugins
 .setEnabled(
 plugin.id,
 event.target.checked
 );

 await window.PluginRuntime
 .reload();
 } catch (error) {
 event.target.checked =
 !event.target.checked;

 window.Toast
 ?.error(
 error.message
 );
 }
 }
 );

 card
 .querySelector(
 '.plugin-clear'
 )
 ?.addEventListener(
 'click',
 async () => {
 await window.api.plugins
 .dataClear(
 plugin.id
 );

 window.Toast
 ?.info(
 this.t(
 'plugins_data_cleared',
 'Plugin data cleared'
 )
 );
 }
 );

 card
 .querySelector(
 '.plugin-remove'
 )
 ?.addEventListener(
 'click',
 async () => {
 const approved =
 await this.confirm(
 this.t(
 'plugins_confirm_uninstall',
 'Uninstall plugin?'
 ),
 plugin.manifest.name,
 true
 );

 if (!approved) {
 return;
 }

 await window.PluginRuntime
 .deactivate(
 plugin.id
 );

 await window.api.plugins
 .uninstall(
 plugin.id,
 true
 );

 window.SettingsView
 ?.renderCategory(
 'plugins'
 );
 }
 );

 container.appendChild(
 card
 );
 }

 window.i18n
 ?.updateDOM();
 }
}

window.PluginSettings =
 new OrphiraPluginSettings();