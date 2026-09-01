/**
 * COSMIC PLAYER - GPU SUB-PIXEL TIMELINE MANAGER
 * Абсолютно плавный GPU-ускоренный таймлайн без пиксельных шагов и задержек
 */
let smoothTime = 0;
let lastFrameTime = performance.now();

class TimelineManager {
  constructor() {
    this.progressEl = null;
    this.fsProgressEl = null;
    this.fillEl = null;
    this.fsFillEl = null;
    this.thumbEl = null;
    this.fsThumbEl = null;
    this.boxEl = null;
    this.fsBoxEl = null;
    this.timeCurrentEl = null;
    this.fsTimeCurrentEl = null;
    this.timeTotalEl = null;
    this.fsTimeTotalEl = null;
    this.isSeeking = false;
    this.currentDuration = 0;
    this.animFrame = null;
    this.onTrackEndCallback = null;
    this.onTimeUpdateCallback = null;
  }

  init({ onTrackEnd, onTimeUpdate }) {
    this.progressEl = document.getElementById('ui-progress');
    this.fsProgressEl = document.getElementById('fs-progress');
    this.fillEl = document.getElementById('ui-seekbar-fill');
    this.fsFillEl = document.getElementById('fs-seekbar-fill');
    this.thumbEl = document.getElementById('ui-seekbar-thumb');
    this.fsThumbEl = document.getElementById('fs-seekbar-thumb');
    this.boxEl = document.getElementById('ui-seekbar-box');
    this.fsBoxEl = document.getElementById('fs-seekbar-box');
    this.timeCurrentEl = document.getElementById('ui-time-current');
    this.fsTimeCurrentEl = document.getElementById('fs-time-current');
    this.timeTotalEl = document.getElementById('ui-time-total');
    this.fsTimeTotalEl = document.getElementById('fs-time-total');

    [this.progressEl, this.fsProgressEl].forEach(el => {
      if (el) {
        el.setAttribute('min', '0');
        el.setAttribute('max', '100000');
        el.setAttribute('step', 'any');
      }
    });

    this.onTrackEndCallback = onTrackEnd;
    this.onTimeUpdateCallback = onTimeUpdate;
    this._bindSliderEvents();
    this._bindAudioEndedEvents();
    this._startLoop();
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s}`;
    }
    return `${m}:${s}`;
  }

  setDuration(durationSec) {
    this.currentDuration = durationSec || 0;
    const formatted = this.formatTime(this.currentDuration);
    if (this.timeTotalEl) this.timeTotalEl.textContent = formatted;
    if (this.fsTimeTotalEl) this.fsTimeTotalEl.textContent = formatted;
        window.PluginRuntime?.emit(
      'player.durationChanged',
      {
        duration:
          this.currentDuration
      }
    );
  }

  getDuration() {
    const audio = window.AudioEngine?.audioElement;
    if (audio && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    return this.currentDuration || 0;
  }

  resetTime(newTime = 0) {
    smoothTime = newTime;
    lastFrameTime = performance.now();
  }

  updateUI(current, total) {
    if (this.isSeeking) return;

    const formatted = this.formatTime(current);
    // Обновляем DOM-текст ТОЛЬКО при реальной смене секунды (сберегает CPU)
    if (formatted !== this._lastFormattedTime) {
      this._lastFormattedTime = formatted;
      if (this.timeCurrentEl) this.timeCurrentEl.textContent = formatted;
      if (this.fsTimeCurrentEl) this.fsTimeCurrentEl.textContent = formatted;
    }

    const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
    const progressVal = ratio * 100000;
    const pct = `${(ratio * 100).toFixed(4)}%`;

    if (this.progressEl) this.progressEl.value = progressVal;
    if (this.fsProgressEl) this.fsProgressEl.value = progressVal;

    // 1. Заполнение полоски (scaleX)
    if (this.fillEl) this.fillEl.style.transform = `scaleX(${ratio})`;
    if (this.fsFillEl) this.fsFillEl.style.transform = `scaleX(${ratio})`;

    // 2. Идеально скрепленное процентное позиционирование ползунка
    if (this.thumbEl) this.thumbEl.style.left = pct;
    if (this.fsThumbEl) this.fsThumbEl.style.left = pct;
        const now =
      performance.now();

    if (
      !this._lastPluginTimelineEmit ||
      now -
        this._lastPluginTimelineEmit >=
        250
    ) {
      this._lastPluginTimelineEmit =
        now;

      window.PluginRuntime?.emit(
        'player.positionChanged',
        {
          currentTime:
            Number(current || 0),
          duration:
            Number(total || 0),
          ratio
        }
      );
    }
  }

  _bindSliderEvents() {
    const setupSeekbar = (boxEl) => {
      if (!boxEl) return;

      const getRatioFromEvent = (e) => {
        const rect = boxEl.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const x = clientX - rect.left;
        return Math.min(1, Math.max(0, x / rect.width));
      };

      const updateDragUI = (ratio) => {
        const dur = this.getDuration();
        const seekTime = ratio * dur;
        const formatted = this.formatTime(seekTime);
        const pct = `${(ratio * 100).toFixed(4)}%`;

        if (this.timeCurrentEl) this.timeCurrentEl.textContent = formatted;
        if (this.fsTimeCurrentEl) this.fsTimeCurrentEl.textContent = formatted;

        if (this.fillEl) this.fillEl.style.transform = `scaleX(${ratio})`;
        if (this.fsFillEl) this.fsFillEl.style.transform = `scaleX(${ratio})`;

        if (this.thumbEl) this.thumbEl.style.left = pct;
        if (this.fsThumbEl) this.fsThumbEl.style.left = pct;
      };

      const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        this.isSeeking = true;
                window.PluginRuntime?.emit(
          'player.seekStarted',
          {
            currentTime:
              Number(
                window.AudioEngine
                ?.audioElement
                ?.currentTime ||
                0
              )
          }
        );
        const ratio = getRatioFromEvent(e);
        updateDragUI(ratio);

        const onPointerMove = (moveEv) => {
          if (!this.isSeeking) return;
          moveEv.preventDefault();
          const moveRatio = getRatioFromEvent(moveEv);
          updateDragUI(moveRatio);
        };

        const onPointerUp = (upEv) => {
          if (!this.isSeeking) return;
          this.isSeeking = false;
                    window.PluginRuntime?.emit(
            'player.seekEnded',
            {
              currentTime:
                Number(
                  window.AudioEngine
                  ?.audioElement
                  ?.currentTime ||
                  0
                )
            }
          );

          window.removeEventListener('mousemove', onPointerMove);
          window.removeEventListener('mouseup', onPointerUp);
          window.removeEventListener('touchmove', onPointerMove);
          window.removeEventListener('touchend', onPointerUp);

          const dur = this.getDuration();
          const finalRatio = getRatioFromEvent(upEv);

          if (dur > 0) {
            const newTime = finalRatio * dur;
            this.resetTime(newTime);

            const audio = window.AudioEngine?.audioElement;
            if (audio) {
              audio.currentTime = newTime;
            }

            if (window.state?.config?.lastState) {
              window.state.config.lastState.currentTime = newTime;
              window.api.db.saveConfig(window.state.config);
            }

            this.updateUI(newTime, dur);

            if (window.FullscreenPlayer) {
              window.FullscreenPlayer.lastFocusedIdx = -1;
              window.FullscreenPlayer.syncHighlight(newTime, false);
            }
            if (window.Lyrics) {
              window.Lyrics.syncHighlight(newTime, false);
            }
          }
        };

        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('touchend', onPointerUp);
      };

      boxEl.addEventListener('mousedown', onPointerDown);
      boxEl.addEventListener('touchstart', onPointerDown, { passive: true });
    };

    setupSeekbar(this.boxEl);
    setupSeekbar(this.fsBoxEl);
  }

 _bindAudioEndedEvents() {
 let isEndingHandled = false;

 const handleEnded = (e) => {
 const activeAudio =
 window.AudioEngine?.audioElement;

 if (
 e &&
 e.target &&
 activeAudio &&
 e.target !== activeAudio
 ) {
 return;
 }

 if (
 activeAudio &&
 activeAudio.duration > 0
 ) {
 const timeLeft =
 activeAudio.duration -
 activeAudio.currentTime;

 if (timeLeft > 2.5) {
 if (window.AudioEngine.isPlaying) {
 window.AudioEngine.play();
 }

 return;
 }
 }

 if (isEndingHandled) return;

 isEndingHandled = true;

 setTimeout(() => {
 isEndingHandled = false;
 }, 1000);

 window.PluginRuntime?.emit(
 'player.ended',
 {
 trackId:
 window.state
 ?.currentTrackId ||
 null
 }
 );

 if (
 typeof this.onTrackEndCallback ===
 'function'
 ) {
 this.onTrackEndCallback();
 }
 };

 const syncLoopState = () => {
 requestAnimationFrame(() => {
 const engine =
 window.AudioEngine;

 if (!engine) {
 this._stopLoop();
 return;
 }

 const activeAudio =
 engine.audioElement;

 const isActuallyPlaying =
 typeof engine.isActiveAudioPlaying ===
 'function'
 ? engine.isActiveAudioPlaying()
 : Boolean(
 engine.isPlaying &&
 activeAudio &&
 !activeAudio.paused &&
 !activeAudio.ended
 );

 if (isActuallyPlaying) {
 if (!this.animFrame) {
 this.resetTime(
 Number(activeAudio.currentTime) || 0
 );

 this._startLoop();
 }

 return;
 }

 if (!engine.isPlaying) {
 this._stopLoop();
 }
 });
 };

 const watchdogLoop = (e) => {
 const engine =
 window.AudioEngine;

 if (!engine) return;

 const activeAudio =
 engine.audioElement;

 if (
 e?.target !== activeAudio
 ) {
 return;
 }

 if (
 engine.isPlaying &&
 !activeAudio.paused &&
 !activeAudio.ended &&
 !this.animFrame
 ) {
 this.resetTime(
 Number(activeAudio.currentTime) || 0
 );

 this._startLoop();
 }
 };

 if (window.AudioEngine) {
 const audioElements = [
 window.AudioEngine.playerA?.audio,
 window.AudioEngine.playerB?.audio
 ].filter(Boolean);

 audioElements.forEach(audioEl => {
 audioEl.addEventListener(
 'ended',
 handleEnded
 );

 audioEl.addEventListener(
 'play',
 syncLoopState
 );

 audioEl.addEventListener(
 'playing',
 syncLoopState
 );

 audioEl.addEventListener(
 'pause',
 syncLoopState
 );

 audioEl.addEventListener(
 'timeupdate',
 watchdogLoop
 );

 audioEl.addEventListener(
 'loadedmetadata',
 () => {
 if (
 window.AudioEngine?.audioElement !==
 audioEl
 ) {
 return;
 }

 const duration =
 Number(audioEl.duration);

 if (
 Number.isFinite(duration) &&
 duration > 0
 ) {
 this.setDuration(duration);
 }
 }
 );

 });
 }
 }

 _startLoop() {
 if (this.animFrame) {
 return;
 }

 lastFrameTime =
 performance.now();

 let lastActiveAudio =
 window.AudioEngine?.audioElement || null;

 const render = () => {
 const engine =
 window.AudioEngine;

 if (!engine) {
 this.animFrame = null;
 return;
 }

 const audio =
 engine.audioElement;

 if (!audio) {
 this.animFrame = null;
 return;
 }

 if (
 !engine.isPlaying &&
 !this.isSeeking
 ) {
 this.animFrame = null;
 return;
 }

 if (
 engine.isPlaying &&
 (
 audio.paused ||
 audio.ended
 )
 ) {
 this.animFrame = null;
 return;
 }

 this.animFrame =
 requestAnimationFrame(render);

 const now =
 performance.now();

 const dt =
 Math.max(
 0,
 (now - lastFrameTime) / 1000
 );

 lastFrameTime = now;

 if (audio !== lastActiveAudio) {
 lastActiveAudio = audio;

 smoothTime =
 Number(audio.currentTime) || 0;

 lastFrameTime = now;
 }

 const dur =
 this.getDuration();

 if (dur <= 0) return;

 const rawTime =
 Number(audio.currentTime) || 0;

 const playbackRate =
 audio.playbackRate || 1.0;

 if (
 Math.abs(smoothTime - rawTime) > 0.3 ||
 smoothTime === 0
 ) {
 smoothTime =
 rawTime;
 } else {
 const drift =
 rawTime - smoothTime;

 smoothTime +=
 dt * playbackRate +
 drift * 0.05;
 }

 const extrapolatedTime =
 Math.min(
 dur,
 Math.max(
 0,
 smoothTime
 )
 );

 this.updateUI(
 extrapolatedTime,
 dur
 );

 if (
 typeof this.onTimeUpdateCallback ===
 'function'
 ) {
 this.onTimeUpdateCallback(
 extrapolatedTime
 );
 }

 if (
 window.FullscreenPlayer &&
 window.FullscreenPlayer.isOpen &&
 window.FullscreenPlayer.isLyricsOpen
 ) {
 window.FullscreenPlayer.syncHighlight(
 extrapolatedTime
 );
 }

 if (window.MediaSession) {
 window.MediaSession.setPosition(
 dur,
 extrapolatedTime,
 playbackRate
 );
 }

 if (
 window.state?.config?.lastState
 ) {
 window.state.config.lastState.currentTime =
 extrapolatedTime;
 }
 };

 this.animFrame =
 requestAnimationFrame(render);
 }

  _stopLoop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
}

window.Timeline = new TimelineManager();