/**
 * ORPHIRA - PLUGINS VIEW MANAGER
 * UI контроллер менеджера внешних расширений в окне Настроек
 */
class PluginsViewManager {
  async render(container) {
    if (!container) return;
    const plugins = await window.api.plugins.getAll();

    const group = document.createElement('div');
    group.className = 'settings-group-block';

    const titleText = window.i18n?.t('set_plugins_title') || 'PLUGIN MANAGER';
    const descText = window.i18n?.t('set_plugins_desc') || 'Manage external extensions, metadata providers, and lyrics sources';
    const btnFileText = window.i18n?.t('btn_install_plugin_file') || 'Install from File';
    const btnUrlText = window.i18n?.t('btn_install_plugin_url') || 'Install from URL';

    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5H2v4c0 1.1.9 2 2 2h3.8v1.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V20H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>
          <span data-i18n="set_plugins_title">${titleText}</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_plugins">Plugins</span>
            <span class="settings-desc" data-i18n="set_plugins_desc">${descText}</span>
          </div>
          <div class="settings-control">
            <button class="custom-btn" id="btn-plugin-install-file" data-i18n="btn_install_plugin_file">${btnFileText}</button>
            <button class="custom-btn" id="btn-plugin-install-url" data-i18n="btn_install_plugin_url">${btnUrlText}</button>
          </div>
        </div>
        <div class="plugins-list-container" id="plugins-list-container" style="display:flex; flex-direction:column; gap:10px; width:100%; margin-top:10px;"></div>
      </div>
    `;

    container.appendChild(group);

    const listContainer = group.querySelector('#plugins-list-container');
    this._renderPluginsList(listContainer, plugins);

    group.querySelector('#btn-plugin-install-url')?.addEventListener('click', () => {
      if (typeof showPrompt === 'function') {
        showPrompt('Install Plugin from URL', 'https://example.com/plugin.json', async (url) => {
          if (url && url.trim()) {
            if (window.Toast) window.Toast.info('Installing plugin...');
            const success = await window.api.plugins.installUrl(url.trim());
            if (success) {
              if (window.Toast) window.Toast.success('Plugin installed successfully!');
              if (window.SettingsView) window.SettingsView.renderCategory('plugins');
            } else {
              if (window.Toast) window.Toast.error('Failed to install plugin from URL.');
            }
          }
        });
      }
    });

    group.querySelector('#btn-plugin-install-file')?.addEventListener('click', async () => {
      const folderPath = await window.api.os.selectFolder();
      if (folderPath) {
        try {
          const manifestContent = await window.api.os.readLyrics(`${folderPath}/plugin.json`);
          const entryContent = await window.api.os.readLyrics(`${folderPath}/entry.js`);
          if (manifestContent && entryContent) {
            const manifest = JSON.parse(manifestContent);
            const success = await window.api.plugins.installFiles(manifest, entryContent);
            if (success) {
              if (window.Toast) window.Toast.success(`Plugin "${manifest.name}" installed!`);
              if (window.SettingsView) window.SettingsView.renderCategory('plugins');
              return;
            }
          }
        } catch (e) {}
        if (window.Toast) window.Toast.error('Invalid plugin folder structure.');
      }
    });
  }

  _renderPluginsList(container, plugins) {
    if (!container) return;
    container.innerHTML = '';

    if (!plugins || plugins.length === 0) {
      const noPluginsText = window.i18n?.t('no_plugins_installed') || 'No external plugins installed yet';
      container.innerHTML = `<div style="font-size:12px; opacity:0.5; padding:10px 0;" data-i18n="no_plugins_installed">${noPluginsText}</div>`;
      return;
    }

    plugins.forEach(p => {
      const card = document.createElement('div');
      card.className = 'connected-folder-item';
      card.style.cssText = 'display:flex; flex-direction:column; align-items:stretch; gap:8px; padding:12px 16px;';

      const capabilitiesBadges = p.capabilities.map(c => `<span class="queue-count-tag" style="font-size:10px; text-transform:uppercase;">${c}</span>`).join(' ');

      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:13.5px; color:var(--text-primary);">${window.escapeHTML(p.name)}</strong>
              <span style="font-size:11px; opacity:0.6;">v${window.escapeHTML(p.version)}</span>
            </div>
            <span style="font-size:11.5px; color:var(--text-muted);">${window.escapeHTML(p.description || 'No description')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <label class="toggle-switch">
              <input type="checkbox" class="plugin-toggle-cb" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <button class="remove-folder-btn btn-uninstall-plugin" data-id="${p.id}" title="Uninstall Plugin">
              <span data-i18n="plugin_uninstall">Uninstall</span>
            </button>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
          ${capabilitiesBadges}
        </div>
      `;

      card.querySelector('.plugin-toggle-cb')?.addEventListener('change', async (e) => {
        await window.api.plugins.toggle(p.id, e.target.checked);
        if (window.Toast) window.Toast.info(`Plugin ${e.target.checked ? 'enabled' : 'disabled'}`);
      });

      card.querySelector('.btn-uninstall-plugin')?.addEventListener('click', async () => {
        if (typeof showConfirm === 'function') {
          showConfirm('Uninstall Plugin', `Uninstall "${p.name}"?`, true, async (yes) => {
            if (yes) {
              await window.api.plugins.uninstall(p.id);
              if (window.Toast) window.Toast.warn(`Plugin "${p.name}" uninstalled`);
              if (window.SettingsView) window.SettingsView.renderCategory('plugins');
            }
          });
        }
      });

      container.appendChild(card);
    });
  }
}

window.PluginsView = new PluginsViewManager();