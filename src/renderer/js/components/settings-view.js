/**
 * COSMIC PLAYER - IN-PAGE SETTINGS VIEW MANAGER
 * Полный менеджер встроенных настроек с четко изолированными категориями
 */
class SettingsViewManager {
  constructor() {
    this.currentCat = 'app';
  }

  init() {
    const container = document.getElementById('settings-view-container');
    if (!container) return;
    const settingsItems = document.querySelectorAll('#sidebar-settings-view .nav-item');
    settingsItems.forEach(item => {
      item.addEventListener('click', () => {
        settingsItems.forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        const cat = item.dataset.settingsCat || 'app';
        this.renderCategory(cat);
      });
    });
  }

  renderCategory(cat = 'app') {
    this.currentCat = cat;
    const container = document.getElementById('settings-view-container');
    if (!container) return;
    container.innerHTML = '';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.id = 'btn-close-settings';
    closeBtn.setAttribute('data-i18n-tooltip', 'btn_close');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    closeBtn.addEventListener('click', () => {
      if (typeof window.exitSettings === 'function') window.exitSettings();
    });
    container.appendChild(closeBtn);

    const config = window.state?.config || {};

    if (cat === 'app' || cat === 'all') {
      container.appendChild(this._buildAppGroup(config));
    }
    if (cat === 'search' || cat === 'all') {
      container.appendChild(this._buildSearchGroup(config));
    }
    if (cat === 'appearance' || cat === 'all') {
      container.appendChild(this._buildAppearanceGroup(config));
    }
    if (cat === 'animations' || cat === 'all') {
      container.appendChild(this._buildAnimationsGroup(config));
    }
    if (cat === 'queue' || cat === 'all') {
      container.appendChild(this._buildQueueGroup(config));
    }
    if (cat === 'library' || cat === 'all') {
      container.appendChild(this._buildLibraryGroup(config));
    }
    if (cat === 'tools' || cat === 'all') {
      container.appendChild(this._buildToolsGroup(config));
    }
    if (cat === 'karaoke' || cat === 'all') {
      container.appendChild(this._buildKaraokeGroup(config));
    }
    if (cat === 'stats' || cat === 'all') {
      container.appendChild(this._buildStatsGroup());
    }
    if (cat === 'about' || cat === 'all') {
      container.appendChild(this._buildAboutGroup());
    }
    if (cat === 'plugins' || cat === 'all') {
      if (window.PluginSettings) {
        window.PluginSettings.build().then(node => {
          container.appendChild(node);
          if (window.i18n) window.i18n.updateDOM();
        });
      }
    }

     if (
 (cat === 'about' || cat === 'all') &&
 window.UpdateUI
 ) {
 window.UpdateUI.renderAboutCard();
 }

    if (window.i18n) {
      window.i18n.updateDOM();
    }
  }
  _bindCustomDropdown(group, dropdownId, onSelect) {
    const dropdown = group.querySelector(`#${dropdownId}`);
    if (!dropdown) return;
    const selected = dropdown.querySelector('.dropdown-selected');
    const optionsContainer = dropdown.querySelector('.dropdown-options');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const labelSpan = selected.querySelector('span');
    let timer = null;
    const gracePeriod = 350;

    const hide = () => {
      optionsContainer?.classList.remove('show');
      dropdown.classList.remove('open');
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const startCloseTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => hide(), gracePeriod);
    };
    const cancelCloseTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCloseTimer();
      document.querySelectorAll('.settings-dropdown .dropdown-options.show').forEach(opt => {
        if (opt !== optionsContainer) opt.classList.remove('show');
      });
      document.querySelectorAll('.settings-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      const isShow = optionsContainer.classList.toggle('show');
      dropdown.classList.toggle('open', isShow);
    });

    dropdown.addEventListener('mouseleave', () => {
      if (optionsContainer.classList.contains('show')) startCloseTimer();
    });
    dropdown.addEventListener('mouseenter', () => cancelCloseTimer());

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelCloseTimer();
        const val = opt.dataset.value;
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        if (labelSpan) labelSpan.textContent = opt.textContent.trim();
        hide();
        if (typeof onSelect === 'function') onSelect(val);
      });
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) hide();
    });
  }

  _buildAppGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const langVal = config.language || 'en';
    const tooltipsVal = config.tooltipsEnabled ?? true;
    const langNames = {
      en: 'English',
      ru: 'Русский',
      es: 'Español',
      de: 'Deutsch',
      fr: 'Français',
      it: 'Italiano',
      pt: 'Português',
      nl: 'Nederlands',
      pl: 'Polski'
    };
    const currentLangLabel = langNames[langVal] || 'English';
    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          <span data-i18n="set_general_title">GENERAL SETTINGS</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_language">Language</span>
            <span class="settings-desc" data-i18n="set_language_desc">Select application interface language</span>
          </div>
          <div class="settings-control">
            <div class="custom-dropdown settings-dropdown" id="set-dropdown-lang">
              <div class="dropdown-selected">
                <span>${currentLangLabel}</span>
                <svg class="caret-icon" viewBox="0 0 24 24"><polygon points="5,8 19,8 12,16" fill="currentColor"/></svg>
              </div>
              <div class="dropdown-options">
                <div class="dropdown-option ${langVal === 'en' ? 'active' : ''}" data-value="en">English</div>
                <div class="dropdown-option ${langVal === 'ru' ? 'active' : ''}" data-value="ru">Русский</div>
                <div class="dropdown-option ${langVal === 'es' ? 'active' : ''}" data-value="es">Español</div>
                <div class="dropdown-option ${langVal === 'de' ? 'active' : ''}" data-value="de">Deutsch</div>
                <div class="dropdown-option ${langVal === 'fr' ? 'active' : ''}" data-value="fr">Français</div>
                <div class="dropdown-option ${langVal === 'it' ? 'active' : ''}" data-value="it">Italiano</div>
                <div class="dropdown-option ${langVal === 'pt' ? 'active' : ''}" data-value="pt">Português</div>
                <div class="dropdown-option ${langVal === 'nl' ? 'active' : ''}" data-value="nl">Nederlands</div>
                <div class="dropdown-option ${langVal === 'pl' ? 'active' : ''}" data-value="pl">Polski</div>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_tooltips">Tooltips</span>
            <span class="settings-desc" data-i18n="set_tooltips_desc">Enable or disable hover hints across the application</span>
          </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-tooltips" ${tooltipsVal ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="debug_title">Developer & Diagnostics</span>
            <span class="settings-desc" data-i18n="btn_open_debug">Open internal real-time event logger</span>
          </div>
          <div class="settings-control">
            <button class="custom-btn" id="set-btn-open-debug" data-i18n="btn_open_debug">Open Console Debugger</button>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => {
      this._bindCustomDropdown(group, 'set-dropdown-lang', (val) => {
        window.state.config.language = val;
        window.api.db.saveConfig(window.state.config);
        if (window.i18n) {
          window.i18n.setLanguage(val);
          this.renderCategory(this.currentCat);
        }
      });
      group.querySelector('#set-check-tooltips')?.addEventListener('change', (e) => {
        window.state.config.tooltipsEnabled = e.target.checked;
        window.api.db.saveConfig(window.state.config);
      });
      group.querySelector('#set-btn-open-debug')?.addEventListener('click', () => {
        if (window.api?.debug?.open) window.api.debug.open();
      });
    }, 0);
    return group;
  }

  _buildSearchGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const autoLayoutVal = config.autoLayoutFix ?? true;

    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 11.99 14 9.5 14z"/></svg>
          <span data-i18n="set_search_title">SEARCH SETTINGS</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_auto_layout">Auto-fix Keyboard Layout (QWERTY ↔ ЙЦУКЕН)</span>
            <span class="settings-desc" data-i18n="set_auto_layout_desc">Automatically convert search queries typed in wrong keyboard layout</span>
          </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-auto-layout" ${autoLayoutVal ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      group.querySelector('#set-check-auto-layout')?.addEventListener('change', (e) => {
        window.state.config.autoLayoutFix = e.target.checked;
        window.api.db.saveConfig(window.state.config);
        if (window.Search) window.Search.clearCache();
      });
    }, 0);

    return group;
  }

  _buildQueueGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const keepPlayed = config.queueKeepPlayed || false;
    const rememberQueue = config.rememberQueue ?? true;
    const crossfadeVal = config.crossfadeDuration || 2;

    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
          <span data-i18n="set_queue_title">QUEUE & PLAYBACK SETTINGS</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_queue_keep_played">Keep Played Tracks in Queue</span>
            <span class="settings-desc" data-i18n="set_queue_keep_played_desc">Grey out played tracks and keep current playing track centered</span>
          </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-queue-keep" ${keepPlayed ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_queue_remember">Remember Queue on Restart</span>
 <span class="settings-desc" data-i18n="set_queue_remember_desc">Restores your active queue when Orphira starts</span>
           </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-queue-remember" ${rememberQueue ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_crossfade">Crossfade Duration</span>
            <span class="settings-desc" data-i18n="set_crossfade_desc">Smooth fading overlap when changing playing tracks</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-crossfade" min="0" max="8" step="1" value="${crossfadeVal}">
            <span class="settings-slider-val" id="val-crossfade">${crossfadeVal}s</span>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      group.querySelector('#set-check-queue-keep')?.addEventListener('change', (e) => {
        window.state.config.queueKeepPlayed = e.target.checked;
        window.api.db.saveConfig(window.state.config);
        if (window.QueuePanel) window.QueuePanel.update();
      });
      group.querySelector('#set-check-queue-remember')?.addEventListener('change', (e) => {
        window.state.config.rememberQueue = e.target.checked;
        if (window.State?.saveQueueToConfig) window.State.saveQueueToConfig();
        window.api.db.saveConfig(window.state.config);
      });
 group.querySelector('#set-range-crossfade')?.addEventListener('input', (e) => {
 const val = parseInt(e.target.value, 10);

 window.state.config.crossfadeDuration = val;
 window.state.config.crossfadeEnabled = val > 0;

 group.querySelector('#val-crossfade').textContent = `${val}s`;

 window.api.db.saveConfig(window.state.config);
 });
    }, 0);

    return group;
  }

  _buildAppearanceGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const themeVal = config.theme || 'dark';
    const fontVal = config.font || 'outfit';
    const fontSizeVal = config.fontSize || 100;
    const getThemeLabel = (t) => {
      if (t === 'dark') return window.i18n?.t('theme_dark') || 'Classic Dark';
      if (t === 'warm') return window.i18n?.t('theme_warm') || 'Warm Ivory';
      if (t === 'light') return window.i18n?.t('theme_light') || 'Dawn Light';
      return window.i18n?.t('theme_cosmic') || 'Space Dark';
    };
    const fonts = window.FONT_CATALOG || {};
    const fontLabel = fonts[fontVal]?.name || 'Outfit (Space)';
    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.57 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
          <span data-i18n="set_appearance_title">APPEARANCE</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_theme">Theme</span>
            <span class="settings-desc" data-i18n="set_theme_desc">Choose color scheme for Orphira</span>
          </div>
          <div class="settings-control">
            <div class="custom-dropdown settings-dropdown" id="set-dropdown-theme">
              <div class="dropdown-selected">
                <span>${getThemeLabel(themeVal)}</span>
                <svg class="caret-icon" viewBox="0 0 24 24"><polygon points="5,8 19,8 12,16" fill="currentColor"/></svg>
              </div>
              <div class="dropdown-options">
                <div class="dropdown-option ${themeVal === 'cosmic' ? 'active' : ''}" data-value="cosmic">${window.i18n?.t('theme_cosmic') || 'Space Dark'}</div>
                <div class="dropdown-option ${themeVal === 'dark' ? 'active' : ''}" data-value="dark">${window.i18n?.t('theme_dark') || 'Classic Dark'}</div>
                <div class="dropdown-option ${themeVal === 'warm' ? 'active' : ''}" data-value="warm">${window.i18n?.t('theme_warm') || 'Warm Ivory'}</div>
                <div class="dropdown-option ${themeVal === 'light' ? 'active' : ''}" data-value="light">${window.i18n?.t('theme_light') || 'Dawn Light'}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_font">Font Family</span>
            <span class="settings-desc" data-i18n="set_font_desc">Select main typography font from Google Fonts</span>
          </div>
          <div class="settings-control">
            <div class="custom-dropdown settings-dropdown" id="set-dropdown-font">
              <div class="dropdown-selected">
                <span>${fontLabel}</span>
                <svg class="caret-icon" viewBox="0 0 24 24"><polygon points="5,8 19,8 12,16" fill="currentColor"/></svg>
              </div>
              <div class="dropdown-options">
                ${Object.keys(fonts).map(k => `
                  <div class="dropdown-option ${fontVal === k ? 'active' : ''}" data-value="${k}">${fonts[k].name}</div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_font_size">Overall UI Font Size</span>
            <span class="settings-desc" data-i18n="set_font_size_desc">Scale text size across the entire application</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-font-size" min="80" max="120" step="5" value="${fontSizeVal}">
            <span class="settings-slider-val" id="val-font-size">${fontSizeVal}%</span>
            <button class="custom-btn" id="btn-apply-font-size" style="padding: 4px 10px; font-size: 11px; margin-left: 6px;" data-i18n="btn_apply">Apply</button>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => {
      this._bindCustomDropdown(group, 'set-dropdown-theme', (val) => {
        window.state.config.theme = val;
        document.documentElement.setAttribute('data-theme', val);
        window.api.db.saveConfig(window.state.config);
      });
      this._bindCustomDropdown(group, 'set-dropdown-font', (val) => {
        window.state.config.font = val;
        if (window.applyFont) window.applyFont(val);
        window.api.db.saveConfig(window.state.config);
      });
      group.querySelector('#set-range-font-size')?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        group.querySelector('#val-font-size').textContent = `${val}%`;
      });
      group.querySelector('#btn-apply-font-size')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slider = group.querySelector('#set-range-font-size');
        if (!slider) return;
        const val = parseInt(slider.value, 10);
        window.state.config.fontSize = val;
        document.documentElement.style.zoom = `${val / 100}`;
        window.api.db.saveConfig(window.state.config);
        if (window.Toast) window.Toast.info(`UI Scale updated to ${val}%`);
      });
    }, 0);
    return group;
  }

  _buildAnimationsGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const enabled = config.starsEnabled ?? true;
    const count = config.starsCount || 70;
    const speed = config.starsSpeed || 0.3;

    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99z"/></svg>
          <span data-i18n="set_stars_title">BACKGROUND ANIMATIONS</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_stars_enable">Enable Stars Particle Layer</span>
            <span class="settings-desc" data-i18n="set_stars_enable_desc">Interactive space dust and floating stars background</span>
          </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-stars" ${enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_stars_count">Stars Density</span>
            <span class="settings-desc" data-i18n="set_stars_count_desc">Adjust total number of particle stars</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-star-count" min="10" max="200" value="${count}">
            <span class="settings-slider-val" id="val-star-count">${count}</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_stars_speed">Stars Movement Speed</span>
            <span class="settings-desc" data-i18n="set_stars_speed_desc">Velocity of cosmic dust particles</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-star-speed" min="0.1" max="2.0" step="0.1" value="${speed}">
            <span class="settings-slider-val" id="val-star-speed">${speed}x</span>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      group.querySelector('#set-check-stars')?.addEventListener('change', (e) => {
        window.state.config.starsEnabled = e.target.checked;
        window.api.db.saveConfig(window.state.config);
        if (typeof window.createStars === 'function') window.createStars();
      });
      group.querySelector('#set-range-star-count')?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        window.state.config.starsCount = val;
        group.querySelector('#val-star-count').textContent = val;
        window.api.db.saveConfig(window.state.config);
        if (typeof window.createStars === 'function') window.createStars();
      });
      group.querySelector('#set-range-star-speed')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        window.state.config.starsSpeed = val;
        group.querySelector('#val-star-speed').textContent = `${val}x`;
        window.api.db.saveConfig(window.state.config);
        if (typeof window.createStars === 'function') window.createStars();
      });
    }, 0);

    return group;
  }

  _buildLibraryGroup(config) {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const paths = config.libraryPaths || [];
    let foldersHtml = '';

    if (paths.length === 0) {
      foldersHtml = `<div style="font-size:12px; opacity:0.5;" data-i18n="no_folders_added">No music folders connected yet</div>`;
    } else {

      const removeBtnText = window.i18n?.t('btn_remove') || 'Remove';
      foldersHtml = paths.map(p => `
        <div class="connected-folder-item">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; margin-right:10px;" title="${p}">${p}</span>
          <button class="remove-folder-btn" data-folder="${window.escapeHTML(p)}">
            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span data-i18n="btn_remove">${removeBtnText}</span>
          </button>
        </div>
      `).join('');
    }

    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          <span data-i18n="set_library_title">CONNECTED MUSIC FOLDERS</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row" style="align-items: flex-start; flex-direction: column; gap: 10px;">
          <div class="settings-info">
            <span class="settings-label" data-i18n="connected_folders_title">Connected Music Folders</span>
            <span class="settings-desc" data-i18n="connected_folders_desc">Player automatically scans these directories on PC</span>
          </div>
          <div style="width: 100%; margin-top: 4px;">
            ${foldersHtml}
          </div>
          <div class="settings-control" style="margin-top: 6px;">
            <button class="custom-btn" id="set-btn-add-folder" data-i18n="btn_add_folder">Add Folder</button>
            <button class="custom-btn danger-btn" id="set-btn-clear-cache" data-i18n="btn_clear_cache">Clear Saved Data</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      group.querySelectorAll('.remove-folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const folder = e.currentTarget.dataset.folder;
          if (window.Modals && typeof window.Modals.removeConnectedFolder === 'function') {
            window.Modals.removeConnectedFolder(folder);
            this.renderCategory(this.currentCat);
          }
        });
      });
      group.querySelector('#set-btn-add-folder')?.addEventListener('click', async () => {
        const folderPath = await window.api.os.selectFolder();
        if (folderPath) {
          if (window.DragDrop) window.DragDrop.saveImportedPathsToConfig([folderPath]);
          window.api.scanner.start([folderPath]);
          this.renderCategory(this.currentCat);
        }
      });
      group.querySelector('#set-btn-clear-cache')?.addEventListener('click', () => {
        const modal = document.getElementById('clear-cache-modal');
        if (modal) modal.classList.remove('hidden');
      });
    }, 0);

    return group;
  }

 _buildToolsGroup(config) {
 const group = document.createElement('div');
 group.className = 'settings-group-block';
 const userAcoustidKey = config.acoustidKey || '';
 const placeholderText =
 window.i18n?.t(
 'acoustid_key_placeholder'
 ) ||
 'Your AcoustID API Key';
  group.innerHTML = `
 <div class="settings-group-header">
 <span class="settings-group-title">
 <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.4-2.4c.4-.4.4-1 0-1.3z"/></svg>
 <span data-i18n="set_tools_title">UTILITIES & BATCH TOOLS</span>
 </span>
 </div>
 <div class="settings-card">
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="batch_tools_title">Auto Downloads & Metadata</span>
 <span class="settings-desc" data-i18n="batch_covers_desc">Batch download HD album covers and fill track metadata</span>
 </div>
 <div class="settings-control">
 <button class="custom-btn" id="set-btn-covers" data-i18n="btn_download_covers">Download HD Covers</button>
 <button class="custom-btn" id="set-btn-meta" data-i18n="btn_enrich_meta">Fill Metadata</button>
 </div>
 </div>
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="set_acoustid_key">AcoustID API Key</span>
 <span class="settings-desc" data-i18n="set_acoustid_key_desc">Your personal AcoustID API key for acoustic track recognition. Recognition is disabled until you provide your own key.</span>
  </div>
 <div class="settings-control" style="display: flex; align-items: center; gap: 8px;">
 <input type="text" class="plugin-setting-input" id="set-input-acoustid-key" value="${window.escapeHTML(userAcoustidKey)}" placeholder="${window.escapeHTML(placeholderText)}" style="min-width: 190px;">
 <button class="btn-icon" id="btn-acoustid-info-icon" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--accent-pink); font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="How to get a key">!</button>
 </div>
 </div>
 </div>
 `;
 setTimeout(() => {
 group.querySelector('#set-btn-covers')?.addEventListener('click', () => {
 if (window.Modals?.openBatchModal) window.Modals.openBatchModal('covers', null);
 });
 group.querySelector('#set-btn-meta')?.addEventListener('click', () => {
 if (window.Modals?.openBatchModal) window.Modals.openBatchModal('metadata', null);
 });
 group.querySelector('#btn-acoustid-info-icon')?.addEventListener('click', () => {
 const modal = document.getElementById('acoustid-info-modal');
 if (modal) modal.classList.remove('hidden');
 });
 group.querySelector('#set-input-acoustid-key')?.addEventListener('change', (e) => {
 const val = e.target.value.trim();
 window.state.config.acoustidKey = val;
 window.api.db.saveConfig(window.state.config);
 if (window.Toast) window.Toast.info('AcoustID Key updated');
 });
 }, 0);
 return group;
 }

  _buildKaraokeGroup(config) {
    const group =
      document.createElement('div');
    group.className =
      'settings-group-block';
    const delay =
      config.karaokeScrollDelay || 4;
    const fontSize =
      config.karaokeFontSize || 28;
    const preset =
      config.karaokePreset ||
      'medium';
    const onlineLyricsEnabled =
      config.onlineLyricsEnabled === true;
    const fullscreenPlayerTheme =
      config.fullscreenPlayerTheme ||
      'classic';
    const getPresetLabel =
      p => {
        if (p === 'weak') {
          return (
            window.i18n?.t('preset_weak') ||
            'Weak'
          );
        }
        if (p === 'strong') {
          return (
            window.i18n?.t('preset_strong') ||
            'Strong'
          );
        }
        return (
          window.i18n?.t('preset_medium') ||
          'Medium'
        );
      };
    group.innerHTML = `
      <div class="settings-group-header">
        <span class="settings-group-title">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          <span data-i18n="set_karaoke_title">FULLSCREEN PLAYER</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_fullscreen_player_theme">Fullscreen Player Theme</span>
            <span class="settings-desc" data-i18n="set_fullscreen_player_theme_desc">Choose the layout used by the fullscreen player overlay</span>
          </div>
          <div class="settings-control">
            <div class="custom-dropdown settings-dropdown" id="set-dropdown-fullscreen-player-theme">
              <div class="dropdown-selected">
                <span>${fullscreenPlayerTheme === 'reference'
                  ? (window.i18n?.t('player_theme_reference') || 'Reference')
                  : (window.i18n?.t('player_theme_classic') || 'Classic')}</span>
                <svg class="caret-icon" viewBox="0 0 24 24"><polygon points="5,8 19,8 12,16" fill="currentColor"/></svg>
              </div>
              <div class="dropdown-options">
                <div class="dropdown-option ${fullscreenPlayerTheme === 'classic' ? 'active' : ''}" data-value="classic" data-i18n="player_theme_classic">${window.i18n?.t('player_theme_classic') || 'Classic'}</div>
                <div class="dropdown-option ${fullscreenPlayerTheme === 'reference' ? 'active' : ''}" data-value="reference" data-i18n="player_theme_reference">${window.i18n?.t('player_theme_reference') || 'Reference'}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_online_lyrics">Online Lyrics (LRCLIB)</span>
            <span class="settings-desc" data-i18n="set_online_lyrics_desc">Allow runtime online lyrics lookup.</span>
          </div>
          <div class="settings-control">
            <label class="toggle-switch">
              <input type="checkbox" id="set-check-online-lyrics" ${onlineLyricsEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_karaoke_delay">Return to Active Line Delay</span>
            <span class="settings-desc" data-i18n="set_karaoke_delay_desc">Seconds before auto-scrolling back to active lyric after manual scroll</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-karaoke-delay" min="1" max="10" step="1" value="${delay}">
            <span class="settings-slider-val" id="val-karaoke-delay">${delay}s</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_karaoke_font">Lyrics Font Size</span>
            <span class="settings-desc" data-i18n="set_karaoke_font_desc">Text size in fullscreen karaoke player</span>
          </div>
          <div class="settings-control settings-slider-wrapper">
            <input type="range" id="set-range-karaoke-font" min="20" max="64" step="1" value="${fontSize}">
            <span class="settings-slider-val" id="val-karaoke-font">${fontSize}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="set_karaoke_preset">Visual Effects Preset</span>
            <span class="settings-desc" data-i18n="set_karaoke_preset_desc">Blur mask strength, line scale curve and active glow intensity</span>
          </div>
          <div class="settings-control">
            <div class="custom-dropdown settings-dropdown" id="set-dropdown-karaoke-preset">
              <div class="dropdown-selected">
                <span>${getPresetLabel(preset)}</span>
                <svg class="caret-icon" viewBox="0 0 24 24"><polygon points="5,8 19,8 12,16" fill="currentColor"/></svg>
              </div>
              <div class="dropdown-options">
                <div class="dropdown-option ${preset === 'weak' ? 'active' : ''}" data-value="weak">${window.i18n?.t('preset_weak') || 'Weak'}</div>
                <div class="dropdown-option ${preset === 'medium' ? 'active' : ''}" data-value="medium">${window.i18n?.t('preset_medium') || 'Medium'}</div>
                <div class="dropdown-option ${preset === 'strong' ? 'active' : ''}" data-value="strong">${window.i18n?.t('preset_strong') || 'Strong'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => {
      this._bindCustomDropdown(
        group,
        'set-dropdown-fullscreen-player-theme',
        (val) => {
          window.state.config.fullscreenPlayerTheme = val;
          if (window.ReferenceFullscreenPlayerTheme) {
            window.ReferenceFullscreenPlayerTheme.setTheme(val);
          }
          window.api.db.saveConfig(window.state.config);
        }
      );
      group
        .querySelector(
          '#set-check-online-lyrics'
        )
        ?.addEventListener(
          'change',
          e => {
            window.state.config
              .onlineLyricsEnabled =
              e.target.checked;
            window.api.db.saveConfig(
              window.state.config
            );
          }
        );
      group
        .querySelector(
          '#set-range-karaoke-delay'
        )
        ?.addEventListener(
          'input',
          e => {
            const value =
              parseInt(
                e.target.value,
                10
              );
            window.state.config
              .karaokeScrollDelay =
              value;
            group
              .querySelector(
                '#val-karaoke-delay'
              )
              .textContent =
              `${value}s`;
            window.api.db.saveConfig(
              window.state.config
            );
          }
        );
      group
        .querySelector(
          '#set-range-karaoke-font'
        )
        ?.addEventListener(
          'input',
          e => {
            const value =
              parseInt(
                e.target.value,
                10
              );
            window.state.config
              .karaokeFontSize =
              value;
            group
              .querySelector(
                '#val-karaoke-font'
              )
              .textContent =
              `${value}px`;
            const fullscreenLyrics =
              document.getElementById(
                'fs-lyrics-content'
              );
            if (fullscreenLyrics) {
              fullscreenLyrics.style
                .setProperty(
                  '--karaoke-font-size',
                  `${value}px`
                );
            }
            window.api.db.saveConfig(
              window.state.config
            );
            if (
              window.FullscreenPlayer?.isOpen
            ) {
              window.FullscreenPlayer
                .syncHighlight(
                  window.AudioEngine
                    ?.audioElement
                    ?.currentTime || 0,
                  true
                );
            }
          }
        );
      this._bindCustomDropdown(
        group,
        'set-dropdown-karaoke-preset',
        value => {
          window.state.config
            .karaokePreset =
            value;
          window.api.db.saveConfig(
            window.state.config
          );
          if (
            window.FullscreenPlayer?.isOpen
          ) {
            window.FullscreenPlayer
              .syncHighlight(
                window.AudioEngine
                  ?.audioElement
                  ?.currentTime || 0,
                true
              );
          }
        }
      );
    }, 0);
    return group;
  }

 _buildStatsGroup() {
 const group =
 document.createElement('div');

 group.className =
 'settings-group-block';

 const libCount =
 window.state?.library?.length || 0;

 const plCount =
 window.state?.playlists?.length || 0;

 group.innerHTML = `
 <div class="settings-group-header">
 <span class="settings-group-title">
 <svg class="icon icon-sm" viewBox="0 0 24 24">
 <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
 </svg>
 <span data-i18n="set_stats_title">LIBRARY STATISTICS</span>
 </span>
 </div>

 <div class="settings-stats-grid">
 <div class="settings-stat-card">
 <span class="settings-stat-value" id="stats-tracks">${libCount}</span>
 <span class="settings-stat-label" data-i18n="stats_tracks">Tracks</span>
 </div>

 <div class="settings-stat-card">
 <span class="settings-stat-value" id="stats-artists">—</span>
 <span class="settings-stat-label" data-i18n="stats_artists">Artists</span>
 </div>

 <div class="settings-stat-card">
 <span class="settings-stat-value" id="stats-albums">—</span>
 <span class="settings-stat-label" data-i18n="stats_albums">Albums</span>
 </div>

 <div class="settings-stat-card">
 <span class="settings-stat-value" id="stats-playlists">${plCount}</span>
 <span class="settings-stat-label" data-i18n="stats_playlists">Playlists</span>
 </div>
 </div>

 <div class="settings-group-header settings-stats-subheader">
 <span class="settings-group-title" data-i18n="stats_distribution_title">LIBRARY DISTRIBUTION</span>
 </div>

 <div class="settings-card">
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_top_artist">Most Represented Artist</span>
 <span class="settings-desc" data-i18n="stats_top_artist_desc">Artist with the largest number of tracks in your indexed library.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-top-artist">—</strong>
 <span id="stats-top-artist-share"></span>
 </div>
 </div>

 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_top_five">Top 5 Artist Share</span>
 <span class="settings-desc" data-i18n="stats_top_five_desc">Percentage of the library occupied by your five most represented artists. A high value makes them naturally appear more often in random Shuffle.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-top-five">—</strong>
 </div>
 </div>

 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_diversity">Library Diversity</span>
 <span class="settings-desc" data-i18n="stats_diversity_desc">Measures how evenly tracks are distributed between artists. 100% means a very even library; a lower value means a few artists dominate it.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-diversity">—</strong>
 </div>
 </div>
 </div>

 <div class="settings-group-header settings-stats-subheader">
 <span class="settings-group-title" data-i18n="stats_shuffle_title">SHUFFLE ANALYSIS</span>
 </div>

 <div class="settings-card">
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_shuffle_decks">Shuffle Decks Observed</span>
 <span class="settings-desc" data-i18n="stats_shuffle_decks_desc">Number of random decks generated by Orphira and included in local analysis.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-shuffle-decks">0</strong>
 </div>
 </div>

 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_artist_return">Average Artist Return</span>
 <span class="settings-desc" data-i18n="stats_artist_return_desc">Average number of positions between two tracks credited to the same primary artist. Larger values generally feel more varied.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-artist-return">—</strong>
 </div>
 </div>

 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_closest_repeat">Closest Artist Repeat</span>
 <span class="settings-desc" data-i18n="stats_closest_repeat_desc">Smallest observed distance between two tracks by the same primary artist in generated Shuffle decks.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-closest-repeat">—</strong>
 </div>
 </div>

 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label" data-i18n="stats_artist_streak">Longest Artist Streak</span>
 <span class="settings-desc" data-i18n="stats_artist_streak_desc">Largest number of adjacent tracks credited to the same primary artist observed in Shuffle.</span>
 </div>
 <div class="settings-stat-inline">
 <strong id="stats-artist-streak">—</strong>
 </div>
 </div>

 <div class="settings-stats-note">
 <span data-i18n="stats_local_note">Statistics are calculated locally from your library and generated Shuffle decks. No listening data is sent anywhere.</span>
 </div>
 </div>
 `;

 setTimeout(
 async () => {
 if (
 !window.api
 ?.shuffleDiagnostics
 ?.getAnalytics
 ) {
 return;
 }

 try {
 const analytics =
 await window.api
 .shuffleDiagnostics
 .getAnalytics();

 if (
 !analytics ||
 !group.isConnected
 ) {
 return;
 }

 const library =
 analytics.library || {};

 const shuffle =
 analytics.shuffle || {};

 const setText = (
 id,
 value
 ) => {
 const element =
 group.querySelector(
 `#${id}`
 );

 if (element) {
 element.textContent =
 String(value);
 }
 };

 setText(
 'stats-tracks',
 library.tracks ??
 libCount
 );

 setText(
 'stats-artists',
 library.artists ?? 0
 );

 setText(
 'stats-albums',
 library.albums ?? 0
 );

 setText(
 'stats-top-artist',
 library.topArtist ||
 '—'
 );

 setText(
 'stats-top-artist-share',
 library.topArtist
 ? `${library.topArtistTracks || 0} · ${library.topArtistShare || 0}%`
 : ''
 );

 setText(
 'stats-top-five',
 `${library.topFiveArtistShare || 0}%`
 );

 setText(
 'stats-diversity',
 `${library.diversityScore || 0}%`
 );

 setText(
 'stats-shuffle-decks',
 shuffle.decksGenerated || 0
 );

 const returnTemplate =
 window.i18n?.t(
 'stats_tracks_apart'
 ) ||
 '{count} tracks apart';

 setText(
 'stats-artist-return',
 shuffle.artistReturnsAnalyzed > 0
 ? returnTemplate.replace(
 '{count}',
 String(
 shuffle.averageSameArtistDistance
 )
 )
 : '—'
 );

 setText(
 'stats-closest-repeat',
 shuffle.shortestSameArtistDistance > 0
 ? returnTemplate.replace(
 '{count}',
 String(
 shuffle.shortestSameArtistDistance
 )
 )
 : '—'
 );

 const streakTemplate =
 window.i18n?.t(
 'stats_tracks_streak'
 ) ||
 '{count} tracks';

 setText(
 'stats-artist-streak',
 shuffle.longestSameArtistStreak > 0
 ? streakTemplate.replace(
 '{count}',
 String(
 shuffle.longestSameArtistStreak
 )
 )
 : '—'
 );
 } catch (error) {
 console.warn(
 '[Statistics] Analytics unavailable:',
 error
 );
 }
 },
 0
 );

 return group;
 }

  _buildAboutGroup() {
    const group = document.createElement('div');
    group.className = 'settings-group-block';
    const appName =
      window.state?.appIdentity?.name ||
      'Orphira';
 const currentVersion =
 window.state?.appVersion ||
 window.state?.appIdentity?.version ||
 '';
    const rawTemplate =
      window.i18n?.t('about_version') ||
      'Version {version} (Web Audio API Engine)';
    const formattedVersionText =
      rawTemplate.replace(
        '{version}',
        currentVersion
      );
    const copyrightText =
      window.state?.appIdentity?.copyright ||
      'Copyright (c) 2026 Olivia Løvgreen';
    const contactEmail =
      window.state?.appIdentity?.contactEmail ||
      'orphiraplayer@gmail.com';
    const projectUrl =
      window.state?.appIdentity?.projectUrl ||
      'https://github.com/Oliviqo/orphira';
    const onlineTitle =
      window.i18n?.t(
        'about_online_services_title'
      ) ||
      'Online Services';
    const onlineDescription =
      window.i18n?.t(
        'about_online_services_desc'
      ) ||
 'Orphira uses external online services for optional metadata, acoustic identification and runtime lyrics.';
     const musicBrainzText =
      window.i18n?.t(
        'about_musicbrainz'
      ) ||
      'MusicBrainz — track metadata';
    const acoustIdText =
      window.i18n?.t(
        'about_acoustid'
      ) ||
      'AcoustID — acoustic identification';
    const caaText =
      window.i18n?.t(
        'about_caa'
      ) ||
      'Cover Art Archive — album artwork';
    const lrclibText =
      window.i18n?.t(
        'about_lrclib'
      ) ||
      'LRCLIB — runtime lyrics (no disk cache)';
    group.innerHTML = `
      <div class="about-placeholder-card">
        <div class="about-logo-title">${window.escapeHTML(appName.toUpperCase())}</div>
        <div style="font-size: 12px; opacity: 0.7;">${window.escapeHTML(formattedVersionText)}</div>
        <div style="font-size: 11px; opacity: 0.5; margin-top: 6px;">${window.escapeHTML(copyrightText)}</div>
        <div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">${window.escapeHTML(contactEmail)}</div>
        <div style="font-size: 11px; margin-top: 4px;"><a href="${window.escapeHTML(projectUrl)}" style="color: var(--accent-pink); text-decoration: none;">${window.escapeHTML(projectUrl)}</a></div>
      </div>
      <div class="settings-group-header">
        <span class="settings-group-title">
          <span data-i18n="about_online_services_title">${window.escapeHTML(onlineTitle)}</span>
        </span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="about_online_services_title">${window.escapeHTML(onlineTitle)}</span>
            <span class="settings-desc" data-i18n="about_online_services_desc">${window.escapeHTML(onlineDescription)}</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="about_musicbrainz">${window.escapeHTML(musicBrainzText)}</span>
            <span class="settings-desc">musicbrainz.org</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="about_acoustid">${window.escapeHTML(acoustIdText)}</span>
            <span class="settings-desc">acoustid.org</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="about_caa">${window.escapeHTML(caaText)}</span>
            <span class="settings-desc">coverartarchive.org</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-info">
            <span class="settings-label" data-i18n="about_lrclib">${window.escapeHTML(lrclibText)}</span>
            <span class="settings-desc">lrclib.net</span>
          </div>
        </div>
      </div>
    `;
    return group;
  }

  filterSettings(rawQuery) {
    const q = rawQuery ? rawQuery.trim().toLowerCase() : '';
    if (!q) {
      this.renderCategory(this.currentCat || 'app');
      return;
    }
    if (this.currentCat !== 'all') {
      this.renderCategory('all');
    }
    const container = document.getElementById('settings-view-container');
    if (!container) return;

    const convertedQ = window.convertKeyboardLayout ? window.convertKeyboardLayout(q).toLowerCase() : '';
    const phoneticQ = window.phoneticTranslit ? window.phoneticTranslit(q) : '';
    const groupBlocks = container.querySelectorAll('.settings-group-block');
    let hasAnyMatches = false;

    groupBlocks.forEach(group => {
      const rows = group.querySelectorAll('.settings-row');
      let groupMatches = false;

      rows.forEach(row => {
        const labelText = row.querySelector('.settings-label')?.textContent || '';
        const descText = row.querySelector('.settings-desc')?.textContent || '';
        const controlsText = Array.from(row.querySelectorAll('.dropdown-option, button, span'))
          .map(el => el.textContent)
          .join(' ');

        const combinedText = `${labelText} ${descText} ${controlsText}`.toLowerCase();
        const matchDirect = combinedText.includes(q);
        const matchConv = convertedQ && convertedQ !== q && combinedText.includes(convertedQ);
        const matchPhonetic = phoneticQ && phoneticQ !== q && combinedText.includes(phoneticQ);
        const fuzzyDirect = window.fuzzyMatch ? window.fuzzyMatch(combinedText, q).match : false;
        const fuzzyConv = convertedQ && window.fuzzyMatch ? window.fuzzyMatch(combinedText, convertedQ).match : false;

        if (matchDirect || matchConv || matchPhonetic || fuzzyDirect || fuzzyConv) {
          row.style.display = 'flex';
          groupMatches = true;
        } else {
          row.style.display = 'none';
        }
      });

      if (groupMatches) {
        group.style.display = 'flex';
        hasAnyMatches = true;
      } else {
        group.style.display = 'none';
      }
    });

    let noResultEl = container.querySelector('.settings-no-results');
    if (!hasAnyMatches) {
      if (!noResultEl) {
        noResultEl = document.createElement('div');
        noResultEl.className = 'settings-no-results';
        noResultEl.style.cssText = 'text-align:center; opacity:0.5; padding:40px; font-size:13px;';
        container.appendChild(noResultEl);
      }
      noResultEl.textContent = `No settings found for "${q}"`;
      noResultEl.style.display = 'block';
    } else if (noResultEl) {
      noResultEl.style.display = 'none';
    }
  }
}

window.SettingsView = new SettingsViewManager();