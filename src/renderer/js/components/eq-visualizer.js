/**
 * COSMIC PLAYER - PRECISION MASTER EQ VISUALIZER ENGINE
 * Профессиональный графический движок АЧХ с интерактивным перетаскиванием точек мышью (Node Dragging)
 */
class EQVisualizerEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.currentMode = 0; // 0: АЧХ и RTA Спектр, 1: 64-Полосный RTA Анализатор
    this.modesCount = 2;
    this.modeNames = ['АЧХ и RTA Спектр', '64-Полосный RTA Анализатор'];
     this.pluginModes = [];

    // Интерактивность мышью на Canvas
    this.hoveredIndex = -1;
    this.draggedIndex = -1;
    this.mousePos = { x: 0, y: 0 };
    this.dragStartMouseY = 0;
    this.dragStartDb = 0;

    // Буферы спектра и затухания пиков
    this.smoothedAudio = new Float32Array(64).fill(0);
    this.smoothedAudioL = new Float32Array(32).fill(0);
    this.smoothedAudioR = new Float32Array(32).fill(0);
    this.peaks = new Float32Array(64).fill(0);
    this.peakDecay = new Float32Array(64).fill(0);

    // Октавные метки частот (Hz)
    this.freqLabels = [
      { hz: '32', xRatio: 0.05 },
      { hz: '64', xRatio: 0.15 },
      { hz: '125', xRatio: 0.25 },
      { hz: '250', xRatio: 0.36 },
      { hz: '500', xRatio: 0.47 },
      { hz: '1k', xRatio: 0.58 },
      { hz: '2k', xRatio: 0.69 },
      { hz: '4k', xRatio: 0.80 },
      { hz: '8k', xRatio: 0.90 },
      { hz: '16k', xRatio: 0.96 }
    ];
  }

  init(canvasEl) {
    if (!canvasEl) return;
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this._bindCanvasMouseEvents();
    this._bindModalObserver();
    this.startLoop();
  }

  _bindModalObserver() {
    const eqModal = document.getElementById('eq-modal');
    if (!eqModal) return;
    const observer = new MutationObserver(() => {
      const isVisible = !eqModal.classList.contains('hidden');
      if (isVisible) {
        this.hoveredIndex = -1;
        this.draggedIndex = -1;
        this._syncCanvasSize();
        if (window.Equalizer && typeof window.Equalizer.renderSliders === 'function') {
          window.Equalizer.renderSliders();
        }
        this.startLoop();
      } else {
        this.hoveredIndex = -1;
        this.draggedIndex = -1;
        this.stopLoop();
      }
    });
    observer.observe(eqModal, { attributes: true, attributeFilter: ['class'] });
  }

  _syncCanvasSize() {
    if (!this.canvas) return;
    const w = this.canvas.offsetWidth || 900;
    const h = this.canvas.offsetHeight || 270;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

 refreshPluginModes() {
 this.pluginModes =
 window.PluginRuntime
 ?.getEqModes?.() ||
 [];

 this.modesCount =
 2 +
 this.pluginModes.length;
 }

 nextMode() {
 this.refreshPluginModes();

 this.currentMode =
 (
 this.currentMode + 1
 ) %
 this.modesCount;

 if (
 this.currentMode === 0
 ) {
 return {
 mode: 0,
 name:
 this.modeNames[0]
 };
 }

 if (
 this.currentMode === 1
 ) {
 return {
 mode: 1,
 name:
 this.modeNames[1]
 };
 }

 const pluginMode =
 this.pluginModes[
 this.currentMode - 2
 ];

 return {
 mode:
 this.currentMode,
 name:
 pluginMode?.name ||
 'Plugin Visualizer'
 };
 }

  _bindCanvasMouseEvents() {
    if (!this.canvas) return;
    const getCanvasPos = (e) => {
      this._syncCanvasSize();
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
      const normX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const normY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      return {
        x: normX * this.canvas.width,
        y: normY * this.canvas.height
      };
    };
    this.canvas.addEventListener('mousemove', (e) => {
      const pos = getCanvasPos(e);
      this.mousePos = pos;
      const w = this.canvas.width;
      const h = this.canvas.height;
      if (w === 0 || h === 0) return;
      const mainW = w - 35;
      const eqConf = window.state?.config?.eq;
      const gains = eqConf?.gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const preamp = eqConf?.bypass ? 0 : (eqConf?.preamp || 0);
      const isBypass = eqConf?.bypass || false;
      const qFactor = eqConf?.qFactor || 1.4;
      const activeGains = isBypass ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : gains.map(g => (Number(g) || 0) + (Number(preamp) || 0));
      const points = this._getExactNodePointsOnCurve(mainW, h, activeGains, qFactor);
      if (this.draggedIndex !== -1) {
        this.canvas.style.cursor = 'ns-resize';
        const usableH = h * 0.76;
        const deltaY = pos.y - this.dragStartMouseY;
        const deltaDb = -(deltaY / usableH) * 24;
        let newDb = this.dragStartDb + deltaDb;
        newDb = Math.max(-12, Math.min(12, Math.round(newDb * 10) / 10));
        if (window.Equalizer) {
          window.Equalizer.updateBand(this.draggedIndex, newDb);
          const fader = document.querySelector(`.eq-fader[data-index="${this.draggedIndex}"]`);
          if (fader) fader.value = newDb;
        }
        return;
      }
      let found = -1;
      const hitRadius = Math.max(16, w * 0.022);
      points.forEach((p, idx) => {
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (dist <= hitRadius) found = idx;
      });
      this.hoveredIndex = found;
      this.canvas.style.cursor = found !== -1 ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('mouseleave', () => {
      if (this.draggedIndex === -1) {
        this.hoveredIndex = -1;
        if (this.canvas) this.canvas.style.cursor = 'default';
      }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.hoveredIndex !== -1) {
        if (window.Equalizer && typeof window.Equalizer.clearUndoSnapshot === 'function') {
          window.Equalizer.clearUndoSnapshot();
        }
        this.draggedIndex = this.hoveredIndex;
        const eqConf = window.state?.config?.eq;
        const gains = eqConf?.gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.dragStartDb = Number(gains[this.draggedIndex]) || 0;
        const pos = getCanvasPos(e);
        this.dragStartMouseY = pos.y;
        this.canvas.style.cursor = 'ns-resize';
      }
    });
    window.addEventListener('mouseup', () => {
      this.draggedIndex = -1;
      if (this.canvas) {
        this.canvas.style.cursor = this.hoveredIndex !== -1 ? 'pointer' : 'default';
      }
    });
    this.canvas.addEventListener('dblclick', () => {
      if (this.hoveredIndex !== -1 && window.Equalizer) {
        if (typeof window.Equalizer.clearUndoSnapshot === 'function') {
          window.Equalizer.clearUndoSnapshot();
        }
        window.Equalizer.updateBand(this.hoveredIndex, 0);
        const fader = document.querySelector(`.eq-fader[data-index="${this.hoveredIndex}"]`);
        if (fader) fader.value = 0;
      }
    });
  }

  startLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    const render = () => {
      const eqModal = document.getElementById('eq-modal');
      const isVisible = eqModal && !eqModal.classList.contains('hidden');
      if (!isVisible) {
        this.animFrameId = null;
        return;
      }
      this.animFrameId = requestAnimationFrame(render);
      this.draw();
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  stopLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    this._syncCanvasSize();
    const w = this.canvas.width;
    const h = this.canvas.offsetHeight || this.canvas.height;
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const eqConf = window.state?.config?.eq;
    const gains = eqConf?.gains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const preamp = eqConf?.bypass ? 0 : (eqConf?.preamp || 0);
    const isBypass = eqConf?.bypass || false;
    const qFactor = eqConf?.qFactor || 1.4;
    const activeGains = isBypass ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : gains.map(g => (Number(g) || 0) + (Number(preamp) || 0));

    let rawAudio = null;
    let stereoData = null;
    if (window.AudioEngine && window.AudioEngine.isPlaying) {
      rawAudio = window.AudioEngine.getVisualizerData();
      if (typeof window.AudioEngine.getStereoVisualizerData === 'function') {
        stereoData = window.AudioEngine.getStereoVisualizerData();
      }
    }
    if (stereoData && stereoData.left && stereoData.right) {
      for (let i = 0; i < 32; i++) {
        const targetL = stereoData.left[i] || 0;
        const targetR = stereoData.right[i] || 0;
        this.smoothedAudioL[i] += (targetL - this.smoothedAudioL[i]) * 0.25;
        this.smoothedAudioR[i] += (targetR - this.smoothedAudioR[i]) * 0.25;
      }
    } else {
      for (let i = 0; i < 32; i++) {
        this.smoothedAudioL[i] += (0 - this.smoothedAudioL[i]) * 0.2;
        this.smoothedAudioR[i] += (0 - this.smoothedAudioR[i]) * 0.2;
      }
    }
    if (rawAudio && rawAudio.length > 0) {
      for (let i = 0; i < 64; i++) {
        const target = rawAudio[i] || 0;
        this.smoothedAudio[i] += (target - this.smoothedAudio[i]) * 0.25;
      }
    } else {
      for (let i = 0; i < 64; i++) {
        this.smoothedAudio[i] += (0 - this.smoothedAudio[i]) * 0.2;
      }
    }

    // 1. Координатная сетка
    this._drawGrid(ctx, w, h);

    // 2. Отрисовка режима
 if (
 this.currentMode === 0
 ) {
 this._drawResponseCurve(
 ctx,
 w,
 h,
 activeGains,
 qFactor
 );
 } else if (
 this.currentMode === 1
 ) {
 this._draw64BandCinematicRTA(
 ctx,
 w,
 h
 );
 } else {
 const pluginMode =
 this.pluginModes[
 this.currentMode - 2
 ];

 this._drawPluginMode(
 ctx,
 w,
 h,
 pluginMode
 );
 }
  }

  _drawGrid(ctx, w, h) {
    ctx.save();
    ctx.font = '10px var(--font-primary), sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';

    const dbLevels = [
      { label: '+12 dB', y: h * 0.10 },
      { label: '+6 dB', y: h * 0.30 },
      { label: '0 dB', y: h * 0.50, isZero: true },
      { label: '-6 dB', y: h * 0.70 },
      { label: '-12 dB', y: h * 0.90 }
    ];

    dbLevels.forEach(lvl => {
      ctx.beginPath();
      if (lvl.isZero) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.setLineDash([6, 4]);
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.setLineDash([]);
      }
      ctx.moveTo(0, lvl.y);
      ctx.lineTo(w - 35, lvl.y);
      ctx.stroke();
      ctx.fillText(lvl.label, 8, lvl.y - 4);
    });

    ctx.setLineDash([]);
    this.freqLabels.forEach(f => {
      const x = (w - 35) * f.xRatio;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(f.hz, x - 8, h - 6);
    });
    ctx.restore();
  }

  _getCurveYAtX(x, mainWidth, h, gains, qFactor) {
    const nodeXs = this.freqLabels.map(f => mainWidth * f.xRatio);
    const sigma = (mainWidth / 10) / (qFactor * 0.85);
    let totalResponseDb = 0;

    for (let i = 0; i < gains.length; i++) {
      const nodeX = nodeXs[i];
      const gainDb = Number(gains[i]) || 0;
      const dist = x - nodeX;
      totalResponseDb += gainDb * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }

    const maxDb = 12;
    const clampedDb = Math.max(-maxDb, Math.min(maxDb, totalResponseDb));
    const norm = (clampedDb + maxDb) / (maxDb * 2);
    return (h * 0.88) - norm * (h * 0.76);
  }

  _getExactNodePointsOnCurve(mainWidth, h, gains, qFactor) {
    return this.freqLabels.map((f, i) => {
      const x = mainWidth * f.xRatio;
      const y = this._getCurveYAtX(x, mainWidth, h, gains, qFactor);
      return { x, y, db: gains[i] };
    });
  }

  /** РЕЖИМ 1: Интерактивная АЧХ-кривая (Оранжево-Коралловый стиль) */
  _drawResponseCurve(ctx, w, h, gains, qFactor) {
    const mainWidth = w - 35;
    const centerY = h * 0.5;
    const bars = 32;
    const barW = mainWidth / bars;
    // Фоновые столбики
    ctx.fillStyle = 'rgba(255, 122, 69, 0.08)';
    for (let i = 0; i < bars; i++) {
      const val = this.smoothedAudio[i * 2] || 0;
      const barH = (val / 255) * (h * 0.75);
      if (barH > 1) {
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
      }
    }
    const curvePoints = [];
    for (let x = 0; x <= mainWidth; x += 2) {
      const y = this._getCurveYAtX(x, mainWidth, h, gains, qFactor);
      curvePoints.push({ x, y });
    }
    // Заливка под кривой
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    curvePoints.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(mainWidth, centerY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255, 122, 69, 0.25)');
    grad.addColorStop(0.5, 'rgba(255, 154, 107, 0.08)');
    grad.addColorStop(1, 'rgba(255, 122, 69, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();
    // Сама линия кривой EQ
    ctx.beginPath();
    curvePoints.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#ff7a45';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 122, 69, 0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Точки (Узлы EQ)
    const nodePoints = this._getExactNodePointsOnCurve(mainWidth, h, gains, qFactor);
    nodePoints.forEach((p, idx) => {
      const isHovered = this.hoveredIndex === idx || this.draggedIndex === idx;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#ff9a6b' : '#180e22';
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#ffffff' : '#ff7a45';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isHovered) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px var(--font-primary), sans-serif';
        const rawGain = Number(gains[idx]) || 0;
        const txt = `${rawGain > 0 ? '+' : ''}${rawGain.toFixed(1)} dB`;
        ctx.fillText(txt, p.x - 18, p.y - 12);
      }
    });
    this._drawRMSMeter(ctx, w, h);
  }

  /** РЕЖИМ 2: 64-Полосный RTA Анализатор */
  _draw64BandCinematicRTA(ctx, w, h) {
    const mainWidth = w - 35;
    const barsCount = 64;
    const padding = 2;
    const barW = (mainWidth - (barsCount + 1) * padding) / barsCount;

    for (let i = 0; i < barsCount; i++) {
      const rawVal = (this.smoothedAudio[i] || 0) / 255;
      const barH = rawVal * (h * 0.85);
      const x = padding + i * (barW + padding);
      const y = h - barH;

      if (barH >= this.peaks[i]) {
        this.peaks[i] = barH;
        this.peakDecay[i] = 0.06;
      } else {
        this.peakDecay[i] += 0.03;
        this.peaks[i] = Math.max(0, this.peaks[i] - this.peakDecay[i]);
      }

      const barGrad = ctx.createLinearGradient(0, h, 0, y);
      barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
      barGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
      barGrad.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
      ctx.fillStyle = barGrad;
      ctx.fillRect(x, y, barW, barH);

      const peakY = h - this.peaks[i];
      if (peakY < h - 2) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(x, peakY, barW, 1.2);
      }
    }

    this._drawRMSMeter(ctx, w, h);
  }

 _drawPluginMode(
 ctx,
 w,
 h,
 mode
 ) {
 if (!mode) {
 return;
 }

 const data =
 this.smoothedAudio;

 const mainWidth =
 w - 35;

 const color =
 mode.color ||
 '#ff7a45';

 const secondary =
 mode.secondaryColor ||
 '#ffffff';

 if (
 mode.type === 'line'
 ) {
 ctx.beginPath();

 for (
 let i = 0;
 i < data.length;
 i++
 ) {
 const x =
 (i /
 Math.max(
 1,
 data.length - 1
 )) *
 mainWidth;

 const y =
 h -
 (
 data[i] / 255
 ) *
 h *
 0.85;

 if (i === 0) {
 ctx.moveTo(x, y);
 } else {
 ctx.lineTo(x, y);
 }
 }

 ctx.strokeStyle =
 color;

 ctx.lineWidth = 2.5;

 ctx.shadowColor =
 color;

 ctx.shadowBlur = 9;

 ctx.stroke();

 ctx.shadowBlur = 0;
 } else if (
 mode.type === 'dots'
 ) {
 for (
 let i = 0;
 i < data.length;
 i++
 ) {
 const x =
 (i /
 Math.max(
 1,
 data.length - 1
 )) *
 mainWidth;

 const y =
 h -
 (
 data[i] / 255
 ) *
 h *
 0.85;

 const radius =
 1.5 +
 (
 data[i] / 255
 ) *
 3;

 ctx.beginPath();

 ctx.arc(
 x,
 y,
 radius,
 0,
 Math.PI * 2
 );

 ctx.fillStyle =
 i % 2 === 0
 ? color
 : secondary;

 ctx.fill();
 }
 } else {
 const count =
 data.length;

 const gap = 2;

 const barWidth =
 (
 mainWidth -
 gap *
 (
 count - 1
 )
 ) /
 count;

 for (
 let i = 0;
 i < count;
 i++
 ) {
 const value =
 data[i] / 255;

 const barHeight =
 value *
 h *
 0.85;

 const gradient =
 ctx.createLinearGradient(
 0,
 h,
 0,
 h - barHeight
 );

 gradient.addColorStop(
 0,
 secondary
 );

 gradient.addColorStop(
 1,
 color
 );

 ctx.fillStyle =
 gradient;

 ctx.fillRect(
 i *
 (
 barWidth + gap
 ),
 h - barHeight,
 Math.max(
 1,
 barWidth
 ),
 barHeight
 );
 }
 }

 this._drawRMSMeter(
 ctx,
 w,
 h
 );
 }

  _drawRMSMeter(ctx, w, h) {
    const meterW = 5;
    const meterH = h * 0.72;
    const y = h * 0.12;
    const xL = w - 20;
    const xR = w - 10;

    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < 32; i++) {
      sumL += this.smoothedAudioL[i] || 0;
      sumR += this.smoothedAudioR[i] || 0;
    }
    const rmsL = sumL / (32 * 255);
    const rmsR = sumR / (32 * 255);
    const fillHL = rmsL * meterH;
    const fillHR = rmsR * meterH;

    ctx.save();
    ctx.strokeStyle = 'rgba(139, 155, 180, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xL, y, meterW, meterH);
    ctx.strokeRect(xR, y, meterW, meterH);

    const rmsGrad = ctx.createLinearGradient(0, y + meterH, 0, y);
    rmsGrad.addColorStop(0, '#2ed573');
    rmsGrad.addColorStop(0.7, '#e2b17a');
    rmsGrad.addColorStop(1, '#ff4757');

    ctx.fillStyle = rmsGrad;
    ctx.fillRect(xL + 1, y + meterH - fillHL, meterW - 2, fillHL);
    ctx.fillRect(xR + 1, y + meterH - fillHR, meterW - 2, fillHR);

    ctx.font = 'bold 9px var(--font-primary), sans-serif';
    ctx.fillStyle = 'rgba(139, 155, 180, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('L', xL + meterW / 2, y + meterH + 11);
    ctx.fillText('R', xR + meterW / 2, y + meterH + 11);
    ctx.restore();
  }
}

window.EQVisualizer = new EQVisualizerEngine();