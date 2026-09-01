/**
 * COSMIC PLAYER - WEB AUDIO API ENGINE
 * Двухканальный звуковой движок с эквалайзером, Crossfade и анализатором спектра
 */

class CosmicAudioEngine {
  constructor() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    this.crossfadeTimer = null;

    // Двойная нода для бесшовного кроссфейда между треками (Player A и Player B)
    this.playerA = {
      audio: new Audio(),
      gain: this.audioContext.createGain(),
      key: 'A'
    };
    this.playerB = {
      audio: new Audio(),
      gain: this.audioContext.createGain(),
      key: 'B'
    };

    this.playerA.audio.crossOrigin = "anonymous";
    this.playerB.audio.crossOrigin = "anonymous";

    this.sourceA = this.audioContext.createMediaElementSource(this.playerA.audio);
    this.sourceB = this.audioContext.createMediaElementSource(this.playerB.audio);
    this.currentPlaybackRate = 1.0;

    this.sourceA.connect(this.playerA.gain);
    this.sourceB.connect(this.playerB.gain);

    this.activeKey = 'A'; // Активный плеер в текущий момент

    // 10-полосный эквалайзер (BiquadFilterNode)
    this.eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.filters = [];
    let prevNode = null;
    this.eqBands.forEach((freq, index) => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      if (index === 0) {
        this.playerA.gain.connect(filter);
        this.playerB.gain.connect(filter);
      } else {
        prevNode.connect(filter);
      }
      prevNode = filter;
      this.filters.push(filter);
    });

    // Стерео сплиттер и независимый гейн L/R каналов
    this.splitter = this.audioContext.createChannelSplitter(2);
    this.merger = this.audioContext.createChannelMerger(2);
    this.gainL = this.audioContext.createGain();
    this.gainR = this.audioContext.createGain();
    this.analyserL = this.audioContext.createAnalyser();
    this.analyserR = this.audioContext.createAnalyser();
    this.analyserL.fftSize = 256;
    this.analyserR.fftSize = 256;

    prevNode.connect(this.splitter);
    this.splitter.connect(this.gainL, 0);
    this.splitter.connect(this.gainR, 1);

    this.gainL.connect(this.analyserL);
    this.gainR.connect(this.analyserR);

    this.analyserL.connect(this.merger, 0, 0);
    this.analyserR.connect(this.merger, 0, 1);

    // Анализатор мастер-спектра
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.merger.connect(this.analyser);

    // Мастер-громкость
    this.masterGain = this.audioContext.createGain();
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    this.playerA.gain.gain.value = 1;
    this.playerB.gain.gain.value = 0;
    this.isPlaying = false;

    this._bindPlayerEvents(this.playerA.audio);
    this._bindPlayerEvents(this.playerB.audio);
  }

  get audioElement() {
    return this.activePlayer.audio;
  }

  get activePlayer() {
    return this.activeKey === 'A' ? this.playerA : this.playerB;
  }

  get standbyPlayer() {
    return this.activeKey === 'A' ? this.playerB : this.playerA;
  }

   isActiveAudioPlaying() {
 const audio =
 this.audioElement;

 return Boolean(
 this.isPlaying &&
 audio &&
 !audio.paused &&
 !audio.ended &&
 audio.src
 );
 }

  _bindPlayerEvents(audioEl) {
    const updateUI = () => {
      if (window.State && typeof window.State.updatePlayButtonUI === 'function') {
        window.State.updatePlayButtonUI();
      }
    };

    audioEl.addEventListener('play', () => {
      if (audioEl === this.audioElement) {
        this.isPlaying = true;
        if (window.api?.media) window.api.media.syncState(true);
 if (window.MediaSession) window.MediaSession.setPlaybackState(true);
 if (window.PluginRuntime) {
 window.PluginRuntime.emit('player.stateChanged', {
 isPlaying: true
 });
 }
 updateUI();
      }
    });

    audioEl.addEventListener('pause', () => {
      if (audioEl === this.audioElement) {
        this.isPlaying = false;
        if (window.api?.media) window.api.media.syncState(false);
 if (window.MediaSession) window.MediaSession.setPlaybackState(false);
 if (window.PluginRuntime) {
 window.PluginRuntime.emit('player.stateChanged', {
 isPlaying: false
 });
 }
 updateUI();
      }
    });
  }

  /** Получение массива частот для анимированного Canvas-визуализатора */
  getVisualizerData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /** Загрузка трека в плеер с поддержкой динамического Crossfade */
  async loadTrack(filePath, playNow = true, crossfade = false) {
    const safeUrl = `media://${encodeURIComponent(filePath)}`;
    if (this.crossfadeTimer) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    const durationSec = window.state?.config?.crossfadeDuration ?? 2;

    if (crossfade && durationSec > 0 && this.isPlaying && this.audioElement.src) {
      await this.doCrossfade(safeUrl, durationSec * 1000);
    } else {
      const active = this.activePlayer;
      const standby = this.standbyPlayer;

      standby.audio.pause();
      standby.audio.currentTime = 0;
      standby.gain.gain.value = 0;

      active.gain.gain.value = 1;
      active.audio.preservesPitch = true;
      active.audio.webkitPreservesPitch = true;
      active.audio.playbackRate = this.currentPlaybackRate;
      active.audio.src = safeUrl;
      active.audio.load();

      if (playNow) await this.play();
    }
  }

  /** Плавный Crossfade заданной длительности между треками */
    async doCrossfade(newSrc, durationMs = 2000) {
        if (this.crossfadeTimer) {
            clearTimeout(this.crossfadeTimer);
            this.crossfadeTimer = null;
        }
        const oldPlayer = this.activePlayer;
        const newPlayer = this.standbyPlayer;
        this.activeKey = newPlayer.key;

        this.crossfadeTimer = setTimeout(() => {
            try {
                oldPlayer.audio.pause();
                oldPlayer.audio.currentTime = 0;
            } catch (e) {}
            this.crossfadeTimer = null;
        }, durationMs + 100);

    newPlayer.audio.preservesPitch = true;
    newPlayer.audio.webkitPreservesPitch = true;
    newPlayer.audio.playbackRate = this.currentPlaybackRate;
    newPlayer.audio.src = newSrc;
    newPlayer.audio.load();

    const now = this.audioContext.currentTime;
    const durationSec = durationMs / 1000;

    // Затухание старого трека
    oldPlayer.gain.gain.cancelScheduledValues(now);
    oldPlayer.gain.gain.setValueAtTime(oldPlayer.gain.gain.value, now);
    oldPlayer.gain.gain.linearRampToValueAtTime(0.001, now + durationSec);

    // Усиление нового трека
    newPlayer.gain.gain.cancelScheduledValues(now);
    newPlayer.gain.gain.setValueAtTime(0.001, now);
    newPlayer.gain.gain.linearRampToValueAtTime(1.0, now + durationSec);

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      await newPlayer.audio.play();
      this.isPlaying = true;
      if (window.api?.media) window.api.media.syncState(true);
      if (window.MediaSession) window.MediaSession.setPlaybackState(true);
    } catch (e) {
      console.warn('[AudioEngine] Ошибка запуска Crossfade:', e);
    }
  }

  async play() {
    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      await this.audioElement.play();
      this.isPlaying = true;
      if (window.api?.media) window.api.media.syncState(true);
      if (window.MediaSession) window.MediaSession.setPlaybackState(true);
    } catch (e) {
      console.warn('[AudioEngine] Ошибка воспроизведения:', e);
    }
  }

  pause() {
    this.playerA.audio.pause();
    this.playerB.audio.pause();
    this.isPlaying = false;
    if (window.api?.media) window.api.media.syncState(false);
    if (window.MediaSession) window.MediaSession.setPlaybackState(false);
  }

  setVolume(value) {
    const normalized = Math.max(0, Math.min(1, value));
    this.masterGain.gain.setValueAtTime(normalized, this.audioContext.currentTime);
  }

  setEqBand(index, gainValue) {
    if (this.filters[index]) {
      const now = this.audioContext.currentTime;
      this.filters[index].gain.setValueAtTime(gainValue, now);
    }
  }

  applyEqGains(gains) {
    if (!Array.isArray(gains)) return;
    const now = this.audioContext.currentTime;
    gains.forEach((g, idx) => {
      if (this.filters[idx]) {
        this.filters[idx].gain.setValueAtTime(g, now);
      }
    });
  }

  /** Установка скорости воспроизведения со 100% сохранением тональности вокала */
  setPlaybackRate(rate) {
    const clamped = Math.max(0.2, Math.min(2.0, parseFloat(rate) || 1.0));
    this.currentPlaybackRate = clamped;

    [this.playerA.audio, this.playerB.audio].forEach(audioEl => {
      audioEl.preservesPitch = true;       // Стандарт W3C (сохранение тона)
      audioEl.webkitPreservesPitch = true; // Поддержка движка Chromium
      audioEl.playbackRate = clamped;      // Скорость (0.2x - 2.0x)
    });

 window.PluginRuntime?.emit(
 'player.playbackRateChanged',
 {
 playbackRate: clamped
 }
 );

  }

  setChannelGains(gainL_dB, gainR_dB) {
    if (!this.gainL || !this.gainR) return;
    const now = this.audioContext.currentTime;
    const linearL = Math.pow(10, (Number(gainL_dB) || 0) / 20);
    const linearR = Math.pow(10, (Number(gainR_dB) || 0) / 20);
    this.gainL.gain.setValueAtTime(linearL, now);
    this.gainR.gain.setValueAtTime(linearR, now);
  }

  getStereoVisualizerData() {
    const dataL = new Uint8Array(this.analyserL ? this.analyserL.frequencyBinCount : 0);
    const dataR = new Uint8Array(this.analyserR ? this.analyserR.frequencyBinCount : 0);
    if (this.analyserL) this.analyserL.getByteFrequencyData(dataL);
    if (this.analyserR) this.analyserR.getByteFrequencyData(dataR);
    return { left: dataL, right: dataR };
  }

}



window.AudioEngine = new CosmicAudioEngine();