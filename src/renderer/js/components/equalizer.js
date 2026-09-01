/**
 * COSMIC PLAYER - 10-BAND EQUALIZER MANAGER
 * UI Контроллер: Кастомные фейдеры, Preamp слева, сброс двойным кликом, пресеты с мгновенной локализацией, Undo Reset
 */
class EqualizerManager {
  constructor() {
    this.bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.bandLabels = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];
    this.presetTimer = null;
    this.gracePeriod = 350;
    this.previousStateBeforeReset = null; // Снимок настроек для функции Undo Reset
    this.standardPresets = {
      flat: { name: 'Flat (Reset)', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      bass: { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
      treble: { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7] },
      rock: { name: 'Rock', gains: [5, 4, 3, 1, -1, 0, 2, 4, 5, 5] },
      pop: { name: 'Pop', gains: [-1, 1, 3, 4, 4, 3, 1, -1, -1, -1] },
      jazz: { name: 'Jazz', gains: [3, 2, 1, 2, -1, -1, 0, 1, 3, 4] },
      classical: { name: 'Classical', gains: [4, 3, 2, 2, -1, -1, 0, 2, 3, 4] },
      vocal: { name: 'Vocal Boost', gains: [-2, -1, 1, 3, 5, 4, 2, 0, -1, -2] }
    };
  }

  init() {
    this.ensureConfig();
    this.injectModalHTML();
    this.renderSliders();
    this.renderPresetsDropdown();
    this.bindEvents();
    this.applyToEngine();

    const canvas = document.getElementById('eq-canvas');
    if (canvas && window.EQVisualizer) {
      window.EQVisualizer.init(canvas);
    }
  }

  ensureConfig() {
    if (!window.state.config) window.state.config = {};
    if (!window.state.config.eq) {
      window.state.config.eq = {
        preset: 'custom1',
        preamp: 0,
        qFactor: 1.4,
        bypass: false,
        gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        customPresets: {
          custom1: { name: 'Custom Preset 1', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
          custom2: { name: 'Custom Preset 2', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
          custom3: { name: 'Custom Preset 3', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
        }
      };
    }
    
        if (window.state.config.eq.gainL === undefined) window.state.config.eq.gainL = 0;
    if (window.state.config.eq.gainR === undefined) window.state.config.eq.gainR = 0;
    if (window.state.config.eq.bypass === undefined) window.state.config.eq.bypass = false;
    if (window.state.config.eq.qFactor === undefined) window.state.config.eq.qFactor = 1.4;

    const eqConf = window.state.config.eq;
    if (this.standardPresets[eqConf.preset] && Array.isArray(this.standardPresets[eqConf.preset].gains)) {
      eqConf.gains = [...this.standardPresets[eqConf.preset].gains];
    }
  }

  injectModalHTML() {
    if (document.getElementById('eq-modal')) return;
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay hidden';
    modalOverlay.id = 'eq-modal';

    const modeName = window.i18n?.t('eq_mode_graph') || 'АЧХ и RTA Спектр';
    const qLabel = window.i18n?.t('eq_q_label') || 'Ширина (Q):';
    const qWide = window.i18n?.t('eq_q_wide') || '0.7 Wide';
    const qNormal = window.i18n?.t('eq_q_normal') || '1.4 Normal';
    const qSharp = window.i18n?.t('eq_q_sharp') || '2.8 Sharp';
    const bypassText = window.i18n?.t('eq_bypass_active') || 'EQ: ACTIVE';
    const resetText = window.i18n?.t('eq_reset_all') || 'Reset All';

    modalOverlay.innerHTML = `
      <div class="modal-content glass-modal eq-modal-content">
        <div class="modal-header">
          <div class="eq-header-left">
            <span data-i18n="eq_title">Эквалайзер (10-полосный)</span>
            <div class="eq-peak-led" id="eq-peak-led" title="Clipping Warning">PEAK</div>
          </div>
          <button class="btn-icon" id="btn-close-eq">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="eq-canvas-wrapper">
          <canvas id="eq-canvas" class="eq-canvas"></canvas>
          <button class="eq-mode-btn" id="btn-eq-mode-switch" title="Switch Graph Mode">
            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12h16M4 6h16M4 18h16"/>
            </svg>
            <span id="eq-mode-name" data-i18n="eq_mode_graph">${modeName}</span>
          </button>
        </div>
        <div class="eq-mid-toolbar">
          <div class="custom-dropdown eq-custom-dropdown" id="eq-preset-dropdown">
            <div class="dropdown-selected" id="eq-preset-selected">
              <span id="eq-preset-label">Custom 1</span>
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
            </div>
            <div class="dropdown-options eq-dropdown-options" id="eq-preset-options"></div>
          </div>
          <div class="eq-controls-right">
            <div class="eq-qfactor-box" title="Q-Factor Width">
              <span class="eq-q-label" data-i18n="eq_q_label">${qLabel}</span>
              <button class="eq-q-btn" data-q="0.7" data-i18n="eq_q_wide">${qWide}</button>
              <button class="eq-q-btn active" data-q="1.4" data-i18n="eq_q_normal">${qNormal}</button>
              <button class="eq-q-btn" data-q="2.8" data-i18n="eq_q_sharp">${qSharp}</button>
            </div>
            <button class="custom-btn eq-bypass-btn" id="btn-eq-bypass" data-i18n="eq_bypass_active">${bypassText}</button>
            <button class="custom-btn danger-btn" id="btn-eq-reset" data-i18n="eq_reset_all">${resetText}</button>
          </div>
        </div>
        <div class="eq-console-body">
          <div class="eq-preamp-col">
            <span class="eq-db-badge" id="eq-preamp-badge">0dB</span>
            <input type="range" min="-12" max="12" step="0.1" value="0" class="eq-fader eq-preamp-fader" id="eq-preamp" title="Double-click to reset to 0dB">
            <span class="eq-preamp-label">PREAMP</span>
          </div>
          <div class="eq-console-divider"></div>
          <div class="eq-bands-grid" id="eq-container"></div>
          <div class="eq-console-divider"></div>
          <div class="eq-master-col">
            <div class="eq-master-faders">
              <div class="eq-band-col">
                <span class="eq-db-badge" id="eq-badge-master-l">0dB</span>
                <input type="range" min="-12" max="6" step="0.1" value="0" class="eq-fader" id="eq-fader-l" title="L Channel Volume">
                <span class="eq-freq-label" data-i18n="eq_channel_l">L</span>
              </div>
              <div class="eq-band-col">
                <span class="eq-db-badge" id="eq-badge-master-r">0dB</span>
                <input type="range" min="-12" max="6" step="0.1" value="0" class="eq-fader" id="eq-fader-r" title="R Channel Volume">
                <span class="eq-freq-label" data-i18n="eq_channel_r">R</span>
              </div>
            </div>
            <span class="eq-preamp-label" data-i18n="eq_master_title">MASTER</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  renderSliders() {
    const container = document.getElementById('eq-container');
    if (!container) return;
    container.innerHTML = '';
    const gains = window.state.config.eq.gains;
    this.bands.forEach((freq, idx) => {
      const val = gains[idx] !== undefined ? gains[idx] : 0;
      const col = document.createElement('div');
      col.className = 'eq-band-col';
      const numVal = Number(val) || 0;
      const badge = document.createElement('span');
      badge.className = 'eq-db-badge';
      badge.id = `eq-badge-${idx}`;
      badge.textContent = `${numVal > 0 ? '+' : ''}${numVal.toFixed(1)}dB`;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '-12';
      input.max = '12';
      input.step = '0.1';
      input.value = numVal;
      input.className = 'eq-fader';
      input.dataset.index = idx;
      input.title = "Double-click to reset to 0dB";
      const label = document.createElement('span');
      label.className = 'eq-freq-label';
      label.textContent = this.bandLabels[idx];
      input.addEventListener('input', (e) => {
        this.clearUndoSnapshot();
        this.updateBand(idx, parseFloat(e.target.value));
      });
      input.addEventListener('dblclick', () => {
        this.clearUndoSnapshot();
        input.value = 0;
        this.updateBand(idx, 0);
      });
      col.appendChild(badge);
      col.appendChild(input);
      col.appendChild(label);
      container.appendChild(col);
    });
    const preampInput = document.getElementById('eq-preamp');
    const preampBadge = document.getElementById('eq-preamp-badge');
    if (preampInput && preampBadge) {
      const pVal = Number(window.state.config.eq.preamp) || 0;
      preampInput.value = pVal;
      preampBadge.textContent = `${pVal > 0 ? '+' : ''}${pVal.toFixed(1)}dB`;
    }
    const gainL = Number(window.state.config.eq.gainL) || 0;
    const gainR = Number(window.state.config.eq.gainR) || 0;
    const faderL = document.getElementById('eq-fader-l');
    const faderR = document.getElementById('eq-fader-r');
    const badgeL = document.getElementById('eq-badge-master-l');
    const badgeR = document.getElementById('eq-badge-master-r');
    if (faderL && badgeL) {
      faderL.value = gainL;
      badgeL.textContent = `${gainL > 0 ? '+' : ''}${gainL.toFixed(1)}dB`;
    }
    if (faderR && badgeR) {
      faderR.value = gainR;
      badgeR.textContent = `${gainR > 0 ? '+' : ''}${gainR.toFixed(1)}dB`;
    }
  }

  renderPresetsDropdown() {
    const optionsContainer = document.getElementById('eq-preset-options');
    const labelSpan = document.getElementById('eq-preset-label');
    if (!optionsContainer || !labelSpan) return;
    const eqConf = window.state.config.eq;
    optionsContainer.innerHTML = '';

    const head1 = document.createElement('div');
    head1.className = 'eq-dropdown-header';
    head1.setAttribute('data-i18n', 'eq_custom_header');
    head1.textContent = window.i18n?.t('eq_custom_header') || 'ПОЛЬЗОВАТЕЛЬСКИЕ';
    optionsContainer.appendChild(head1);

    Object.keys(eqConf.customPresets).forEach(key => {
      const item = document.createElement('div');
      item.className = `dropdown-option ${eqConf.preset === key ? 'active' : ''}`;
      const presetKey = `eq_preset_${key}`;
      item.setAttribute('data-i18n', presetKey);
      item.textContent = window.i18n?.t(presetKey) || eqConf.customPresets[key].name;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearUndoSnapshot();
        this.selectPreset(key);
        optionsContainer.classList.remove('show');
      });
      optionsContainer.appendChild(item);
    });

    const head2 = document.createElement('div');
    head2.className = 'eq-dropdown-header';
    head2.setAttribute('data-i18n', 'eq_presets_header');
    head2.textContent = window.i18n?.t('eq_presets_header') || 'ГОТОВЫЕ ПРЕСЕТЫ';
    optionsContainer.appendChild(head2);

    Object.keys(this.standardPresets).forEach(key => {
      const item = document.createElement('div');
      item.className = `dropdown-option ${eqConf.preset === key ? 'active' : ''}`;
      const presetKey = `eq_preset_${key}`;
      item.setAttribute('data-i18n', presetKey);
      item.textContent = window.i18n?.t(presetKey) || this.standardPresets[key].name;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearUndoSnapshot();
        this.selectPreset(key);
        optionsContainer.classList.remove('show');
      });

      
      optionsContainer.appendChild(item);
    });

     const pluginPresets =
 window.PluginRuntime
 ?.eqPresets
 ? [
 ...window.PluginRuntime
 .eqPresets
 .values()
 ]
 : [];

 if (
 pluginPresets.length > 0
 ) {
 const pluginHeader =
 document.createElement(
 'div'
 );

 pluginHeader.className =
 'eq-dropdown-header';

 pluginHeader.textContent =
 window.i18n?.t(
 'eq_plugin_presets'
 ) ||
 'PLUGIN PRESETS';

 optionsContainer
 .appendChild(
 pluginHeader
 );

 pluginPresets.forEach(
 preset => {
 const item =
 document.createElement(
 'div'
 );

 item.className =
 'dropdown-option';

 item.textContent =
 preset.name;

 item.addEventListener(
 'click',
 e => {
 e.stopPropagation();

 window.OrphiraPluginApi
 ?._applyEqPreset(
 preset.gains
 );

 optionsContainer
 .classList.remove(
 'show'
 );
 }
 );

 optionsContainer
 .appendChild(item);
 }
 );
 }

    const activePresetKey = `eq_preset_${eqConf.preset}`;
    labelSpan.setAttribute('data-i18n', activePresetKey);
    labelSpan.textContent = window.i18n?.t(activePresetKey) ||
      eqConf.customPresets[eqConf.preset]?.name ||
      this.standardPresets[eqConf.preset]?.name || 'Custom 1';
  }

  bindEvents() {
    const dropdown = document.getElementById('eq-preset-dropdown');
    const selected = document.getElementById('eq-preset-selected');
    const options = document.getElementById('eq-preset-options');

    if (dropdown && selected && options) {
      const hideOptions = () => {
        options.classList.remove('show');
        if (this.presetTimer) {
          clearTimeout(this.presetTimer);
          this.presetTimer = null;
        }
      };
      const startCloseTimer = () => {
        if (this.presetTimer) clearTimeout(this.presetTimer);
        this.presetTimer = setTimeout(() => hideOptions(), this.gracePeriod);
      };

      selected.addEventListener('click', (e) => {
        e.stopPropagation();
        options.classList.toggle('show');
      });
      dropdown.addEventListener('mouseleave', () => {
        if (options.classList.contains('show')) startCloseTimer();
      });
      dropdown.addEventListener('mouseenter', () => {
        if (this.presetTimer) {
          clearTimeout(this.presetTimer);
          this.presetTimer = null;
        }
      });
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) hideOptions();
      });
    }

    const btnMode = document.getElementById('btn-eq-mode-switch');
    const modeNameEl = document.getElementById('eq-mode-name');
    if (btnMode && window.EQVisualizer) {
      btnMode.addEventListener('click', () => {
        const res = window.EQVisualizer.nextMode();
        if (modeNameEl) {
          const modeKey = res.mode === 0 ? 'eq_mode_graph' : 'eq_mode_rta';
          modeNameEl.setAttribute('data-i18n', modeKey);
          modeNameEl.textContent = window.i18n?.t(modeKey) || res.name;
        }
      });
    }

    const preampInput = document.getElementById('eq-preamp');
    if (preampInput) {



      preampInput.addEventListener('input', (e) => {
        this.clearUndoSnapshot();
        const val = parseFloat(e.target.value) || 0;
        window.state.config.eq.preamp = val;
        const badge = document.getElementById('eq-preamp-badge');
        if (badge) badge.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
        this.applyToEngine();
        this.saveConfig();
      });
      preampInput.addEventListener('dblclick', () => {
        this.clearUndoSnapshot();
        preampInput.value = 0;
        window.state.config.eq.preamp = 0;
        const badge = document.getElementById('eq-preamp-badge');
        if (badge) badge.textContent = '0dB';
        this.applyToEngine();
        this.saveConfig();
      });

    const faderL = document.getElementById('eq-fader-l');
    const faderR = document.getElementById('eq-fader-r');
    if (faderL) {
      faderL.addEventListener('input', (e) => {
        this.clearUndoSnapshot();
        const val = parseFloat(e.target.value) || 0;
        window.state.config.eq.gainL = val;
        const badgeL = document.getElementById('eq-badge-master-l');
        if (badgeL) badgeL.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
        this.applyToEngine();
        this.saveConfig();
      });
      faderL.addEventListener('dblclick', () => {
        this.clearUndoSnapshot();
        faderL.value = 0;
        window.state.config.eq.gainL = 0;
        const badgeL = document.getElementById('eq-badge-master-l');
        if (badgeL) badgeL.textContent = '0dB';
        this.applyToEngine();
        this.saveConfig();
      });
    }
    if (faderR) {
      faderR.addEventListener('input', (e) => {
        this.clearUndoSnapshot();
        const val = parseFloat(e.target.value) || 0;
        window.state.config.eq.gainR = val;
        const badgeR = document.getElementById('eq-badge-master-r');
        if (badgeR) badgeR.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
        this.applyToEngine();
        this.saveConfig();
      });
      faderR.addEventListener('dblclick', () => {
        this.clearUndoSnapshot();
        faderR.value = 0;
        window.state.config.eq.gainR = 0;
        const badgeR = document.getElementById('eq-badge-master-r');
        if (badgeR) badgeR.textContent = '0dB';
        this.applyToEngine();
        this.saveConfig();
      });
    }

    }
    

    document.querySelectorAll('.eq-q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.eq-q-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const qVal = parseFloat(btn.dataset.q);
        window.state.config.eq.qFactor = qVal;
        if (window.AudioEngine && window.AudioEngine.filters) {
          window.AudioEngine.filters.forEach(filter => {
            if (filter.Q) filter.Q.value = qVal;
          });
        }
        this.saveConfig();
      });
    });

    const btnBypass = document.getElementById('btn-eq-bypass');
    if (btnBypass) {
      this._updateBypassUI(btnBypass);
      btnBypass.addEventListener('click', () => {
        window.state.config.eq.bypass = !window.state.config.eq.bypass;
        this._updateBypassUI(btnBypass);
        this.applyToEngine();
        this.saveConfig();
      });
    }

    const btnReset = document.getElementById('btn-eq-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetAll());
    }

document.getElementById('btn-eq-toggle')?.addEventListener('click', () => {
  const eqModal = document.getElementById('eq-modal');
  if (eqModal) eqModal.classList.remove('hidden');
});
document.getElementById('btn-close-eq')?.addEventListener('click', () => {
  document.getElementById('eq-modal')?.classList.add('hidden');
});

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const eqModal = document.getElementById('eq-modal');
        if (eqModal && !eqModal.classList.contains('hidden')) {
          e.preventDefault();
          eqModal.classList.add('hidden');
        }
      }
    });
  }

  _updateBypassUI(btn) {
    const isBypass = window.state.config.eq.bypass;
    const key = isBypass ? 'eq_bypass_bypassed' : 'eq_bypass_active';
    btn.setAttribute('data-i18n', key);
    btn.textContent = window.i18n?.t(key) || (isBypass ? 'EQ: BYPASSED' : 'EQ: ACTIVE');
    btn.classList.toggle('active-bypass', isBypass);
  }

  clearUndoSnapshot() {
    this.previousStateBeforeReset = null;
    const btnReset = document.getElementById('btn-eq-reset');
    if (btnReset) {
      btnReset.setAttribute('data-i18n', 'eq_reset_all');
      btnReset.textContent = window.i18n?.t('eq_reset_all') || 'Reset All';
      btnReset.style.backgroundColor = '';
      btnReset.style.borderColor = '';
    }
  }

  updateBand(index, gainVal) {
    this.clearUndoSnapshot();
    const eqConf = window.state.config.eq;
    const numGain = Number(gainVal) || 0;
    eqConf.gains[index] = numGain;
    if (eqConf.customPresets[eqConf.preset]) {
      eqConf.customPresets[eqConf.preset].gains = [...eqConf.gains];
    }
    const badge = document.getElementById(`eq-badge-${index}`);
    if (badge) badge.textContent = `${numGain > 0 ? '+' : ''}${numGain.toFixed(1)}dB`;
    this.renderPresetsDropdown();
    this.applyToEngine();
    this.saveConfig();
  }

  selectPreset(key) {
    const eqConf = window.state.config.eq;
    eqConf.preset = key;
    let targetGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (eqConf.customPresets[key]) targetGains = [...eqConf.customPresets[key].gains];
    else if (this.standardPresets[key]) targetGains = [...this.standardPresets[key].gains];
    eqConf.gains = [...targetGains];
    this.renderSliders();
    this.renderPresetsDropdown();
    this.applyToEngine();
    this.saveConfig();
  }

  resetAll() {
    const eqConf = window.state.config.eq;
    const btnReset = document.getElementById('btn-eq-reset');
    if (this.previousStateBeforeReset === null) {
      this.previousStateBeforeReset = {
        gains: [...eqConf.gains],
        preamp: Number(eqConf.preamp) || 0,
        preset: eqConf.preset
      };
      eqConf.gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      eqConf.preamp = 0;
          eqConf.gainL = 0;
    eqConf.gainR = 0;
      if (eqConf.customPresets[eqConf.preset]) {
        eqConf.customPresets[eqConf.preset].gains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
      if (btnReset) {
        btnReset.setAttribute('data-i18n', 'eq_undo_reset');
        btnReset.textContent = window.i18n?.t('eq_undo_reset') || 'Undo Reset';
        btnReset.style.backgroundColor = 'rgba(129, 140, 248, 0.2)';
        btnReset.style.borderColor = 'var(--accent-pink)';
      }
    } else {
      eqConf.gains = [...this.previousStateBeforeReset.gains];
      eqConf.preamp = Number(this.previousStateBeforeReset.preamp) || 0;
      eqConf.preset = this.previousStateBeforeReset.preset;
      if (eqConf.customPresets[eqConf.preset]) {
        eqConf.customPresets[eqConf.preset].gains = [...eqConf.gains];
      }
      this.previousStateBeforeReset = null;
      if (btnReset) {
        btnReset.setAttribute('data-i18n', 'eq_reset_all');
        btnReset.textContent = window.i18n?.t('eq_reset_all') || 'Reset All';
        btnReset.style.backgroundColor = '';
        btnReset.style.borderColor = '';
      }
    }
    this.renderSliders();
    this.renderPresetsDropdown();
    this.applyToEngine();
    this.saveConfig();
  }

  applyToEngine() {
    const eqConf = window.state.config?.eq;
    if (!eqConf) return;
    const gains = eqConf.bypass ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : (eqConf.gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const preamp = eqConf.bypass ? 0 : (eqConf.preamp || 0);
    const finalGains = gains.map(g => (Number(g) || 0) + (Number(preamp) || 0));
    if (window.AudioEngine && typeof window.AudioEngine.applyEqGains === 'function') {
      window.AudioEngine.applyEqGains(finalGains);

    if (window.AudioEngine && typeof window.AudioEngine.setChannelGains === 'function') {
      window.AudioEngine.setChannelGains(eqConf.gainL || 0, eqConf.gainR || 0);
    }

    }
    const maxVal = Math.max(...finalGains);
    const peakLed = document.getElementById('eq-peak-led');
    if (peakLed) {
      peakLed.classList.toggle('active', maxVal > 6);
    }
  }

  saveConfig() {
    window.api.db.saveConfig(window.state.config);
  }
}

window.Equalizer = new EqualizerManager();