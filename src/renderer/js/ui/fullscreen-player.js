/**
 * COSMIC PLAYER - FULLSCREEN IN-APP OVERLAY CONTROLLER
 * Модуль выезда пелены полноэкранного режима снизу с автономной анимацией звёзд и караоке-слежением
 */
class FullscreenPlayerManager {
  constructor() {
    this.isOpen = false;
    this.overlayEl = null;
    this.isLyricsOpen = false;
    this.isSeeking = false;
    this.isUserScrollingLyrics = false;
    this.userScrollLyricsTimeout = null;
    this.lastFocusedIdx = -1;
    this.stars = [];
    this.cursorHideTimeout = null;
    this.cursorDelay = 6000; // 6 секунд бездействия до скрытия курсора
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.overlayEl = document.getElementById('fullscreen-overlay');
      this._bindExpandButton();
      this._bindCloseButton();
      this._bindTopZoneControls();
      this._bindCoverClick();
      this._bindControls();
      this._bindKeyboardShortcuts();
      this._initFsStars();
      this._bindLyricsUserScroll();
      this._bindCursorAutoHide();
    });
  }

  _bindTopZoneControls() {
    if (!this.overlayEl) return;
    const controls = this.overlayEl.querySelector('.fullscreen-window-controls');
    if (!controls) return;
    let hideTimeout = null;
    this.overlayEl.addEventListener('mousemove', (e) => {
      if (!this.isOpen) return;
      if (e.clientY <= 70 || controls.contains(e.target)) {
        controls.classList.add('visible');
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
          if (e.clientY > 70 && !controls.contains(e.target)) {
            controls.classList.remove('visible');
          }
        }, 2500);
      } else {
        controls.classList.remove('visible');
      }
    });
  }

  _initFsStars() {
    const canvas = document.getElementById('fs-stars-layer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let fsStarsAnimId = null;
    let lastW = window.innerWidth || 1280;
    let lastH = window.innerHeight || 720;
    canvas.width = lastW;
    canvas.height = lastH;

    this.stopStarsAnim = () => {
      if (fsStarsAnimId) {
        cancelAnimationFrame(fsStarsAnimId);
        fsStarsAnimId = null;
      }
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    this.recreateStars = () => {
      this.stopStarsAnim();
      lastW = window.innerWidth || 1280;
      lastH = window.innerHeight || 720;
      canvas.width = lastW;
      canvas.height = lastH;
      this.stars = [];
      const count = window.state?.config?.starsCount || 70;
      const speed = window.state?.config?.starsSpeed || 0.3;
      const margin = 50;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: -margin + Math.random() * (lastW + margin * 2),
          y: -margin + Math.random() * (lastH + margin * 2),
          r: Math.random() * 1.5 + 0.5,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          alpha: Math.random(),
          dAlpha: (Math.random() - 0.5) * 0.02
        });
      }
      if (this.isOpen && window.state?.config?.starsEnabled) {
        this.startStarsAnim();
      }
    };

    const handleResize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      if (newW === lastW && newH === lastH) return;
      canvas.width = newW;
      canvas.height = newH;
      const scaleX = lastW > 0 ? newW / lastW : 1;
      const scaleY = lastH > 0 ? newH / lastH : 1;
      this.stars.forEach(s => {
        s.x *= scaleX;
        s.y *= scaleY;
      });
      lastW = newW;
      lastH = newH;
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      if (!this.isOpen || !window.state?.config?.starsEnabled) {
        this.stopStarsAnim();
        return;
      }
      if (fsStarsAnimId) cancelAnimationFrame(fsStarsAnimId);
      fsStarsAnimId = requestAnimationFrame(draw);

      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;
      ctx.clearRect(0, 0, w, h);
      const margin = 50;
      this.stars.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.alpha += s.dAlpha;
        if (s.alpha <= 0 || s.alpha >= 1) s.dAlpha = -s.dAlpha;
        if (s.x < -margin) s.x = w + margin;
        if (s.x > w + margin) s.x = -margin;
        if (s.y < -margin) s.y = h + margin;
        if (s.y > h + margin) s.y = -margin;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.1, s.r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, s.alpha))})`;
        ctx.fill();
      });
    };

    this.startStarsAnim = () => {
      this.stopStarsAnim();
      if (this.isOpen && window.state?.config?.starsEnabled) {
        draw();
      }
    };

    this.recreateStars();
  }

  _bindExpandButton() {
    const expandBtn = document.getElementById('btn-expand-cover');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMode(true);
      });
    }
  }

 _bindCloseButton() {
 const closeBtn = document.getElementById('btn-fullscreen-close');
 if (closeBtn) {
 closeBtn.addEventListener('click', () => this.toggleMode(false));
 }
 document.getElementById('fs-btn-minimize')?.addEventListener('click', () => {
 window.api?.window?.control('minimize');
 });
 document.getElementById('fs-btn-maximize')?.addEventListener('click', () => {
 window.api?.window?.control('maximize');
 });
 document.getElementById('fs-btn-close')?.addEventListener('click', () => {
 this.toggleMode(false);
 });
 }

  _bindCoverClick() {
    const coverEl = document.getElementById('fs-cover');
    if (coverEl) {
      coverEl.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('fs-btn-play-pause')?.click();
      });
    }
  }

 _bindLyricsUserScroll() {
 const container = document.getElementById('fs-lyrics-content');
 if (!container) return;

 const handleUserScroll = () => {
 if (!this.isOpen || !this.isLyricsOpen) return;

 this.isUserScrollingLyrics = true;
 container.classList.add('is-scrolling');

 if (this.userScrollLyricsTimeout) {
 clearTimeout(this.userScrollLyricsTimeout);
 }

 const configuredDelay = Number(
 window.state?.config?.karaokeScrollDelay
 );

 const delaySeconds =
 Number.isFinite(configuredDelay) && configuredDelay > 0
 ? configuredDelay
 : 4;

 this.userScrollLyricsTimeout = setTimeout(() => {
 this.isUserScrollingLyrics = false;
 container.classList.remove('is-scrolling');
 this.lastFocusedIdx = -1;

 const curTime =
 window.AudioEngine?.audioElement?.currentTime || 0;

 this.syncHighlight(curTime, false);
 }, delaySeconds * 1000);
 };

 container.addEventListener(
 'wheel',
 handleUserScroll,
 { passive: true }
 );

 container.addEventListener(
 'touchmove',
 handleUserScroll,
 { passive: true }
 );
 }

  _smoothScrollContainer(container, targetTop, duration = 320) {
    if (this._lyricsScrollAnim) {
      cancelAnimationFrame(this._lyricsScrollAnim);
      this._lyricsScrollAnim = null;
    }
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 1.5) {
      container.scrollTop = targetTop;
      return;
    }
    const startTime = performance.now();
    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + distance * easeOut;
      if (progress < 1) {
        this._lyricsScrollAnim = requestAnimationFrame(animateScroll);
      } else {
        this._lyricsScrollAnim = null;
      }
    };
    this._lyricsScrollAnim = requestAnimationFrame(animateScroll);
  }

  _bindControls() {
    document.getElementById('fs-btn-play-pause')?.addEventListener('click', () => {
      if (window.AudioEngine) {
        if (window.AudioEngine.isPlaying) {
          window.AudioEngine.pause();
        } else {
          window.AudioEngine.play();
        }
      }
    });
    document.getElementById('fs-btn-next')?.addEventListener('click', () => {
      if (window.State) window.State.playNext();
    });
    document.getElementById('fs-btn-prev')?.addEventListener('click', () => {
      if (window.State) window.State.playPrev();
    });
    document.getElementById('fs-btn-shuffle')?.addEventListener('click', () => {
      document.getElementById('btn-shuffle')?.click();
    });
    document.getElementById('fs-btn-repeat')?.addEventListener('click', () => {
      document.getElementById('btn-repeat')?.click();
    });
    document.getElementById('fs-btn-eq')?.addEventListener('click', () => {
      const eqModal = document.getElementById('eq-modal');
      if (eqModal) eqModal.classList.remove('hidden');
    });
    document.getElementById('fs-btn-lyrics-toggle')?.addEventListener('click', () => {
      this.toggleLyrics();
    });
    const fsVol = document.getElementById('fs-volume');
    const mainVol = document.getElementById('ui-volume');
    if (fsVol && mainVol) {
      fsVol.addEventListener('input', (e) => {
        mainVol.value = e.target.value;
        mainVol.dispatchEvent(new Event('input'));
      });
    }
    document.getElementById('fs-btn-mute')?.addEventListener('click', () => {
      document.getElementById('btn-mute')?.click();
    });
  }

  _bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // ИЗОЛЯЦИЯ: пресекает всплытие события к главному менеджеру навигации
          this.toggleMode(false);
          return;
        } else if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('fs-btn-play-pause')?.click();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey) {
          window.State?.playPrev();
        } else if (window.AudioEngine?.audioElement) {
          const cur = window.AudioEngine.audioElement.currentTime;
          const newTime = Math.max(0, cur - 5);
          window.AudioEngine.audioElement.currentTime = newTime;
          if (window.Timeline) window.Timeline.updateUI(newTime, window.Timeline.getDuration());
          this.lastFocusedIdx = -1;
          this.syncHighlight(newTime, false);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey) {
          window.State?.playNext();
        } else if (window.AudioEngine?.audioElement) {
          const dur = window.Timeline ? window.Timeline.getDuration() : 0;
          const cur = window.AudioEngine.audioElement.currentTime;
          const newTime = Math.min(dur, cur + 5);
          window.AudioEngine.audioElement.currentTime = newTime;
          if (window.Timeline) window.Timeline.updateUI(newTime, dur);
          this.lastFocusedIdx = -1;
          this.syncHighlight(newTime, false);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const mainVol = document.getElementById('ui-volume');
        if (mainVol) {
          const newVol = Math.min(100, parseFloat(mainVol.value) + 5);
          mainVol.value = newVol;
          mainVol.dispatchEvent(new Event('input'));
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const mainVol = document.getElementById('ui-volume');
        if (mainVol) {
          const newVol = Math.max(0, parseFloat(mainVol.value) - 5);
          mainVol.value = newVol;
          mainVol.dispatchEvent(new Event('input'));
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        document.getElementById('fs-btn-mute')?.click();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        this.toggleLyrics();
      }
    });
  }

  toggleLyrics(forceState = null) {
    this.isLyricsOpen = forceState !== null ? forceState : !this.isLyricsOpen;
    const toggleBtn = document.getElementById('fs-btn-lyrics-toggle');
    if (this.overlayEl) {
      this.overlayEl.classList.toggle('fullscreen-lyrics-open', this.isLyricsOpen);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isLyricsOpen);
    }
    if (this.isLyricsOpen) {
      this.lastFocusedIdx = -1;
      this.syncLyrics(false);
      this.syncHighlight(window.AudioEngine?.audioElement?.currentTime || 0, true);
    }
  }

  syncLyrics(forceFetch = false) {
    const container = document.getElementById('fs-lyrics-content');
    if (!container) return;
    this.lastFocusedIdx = -1;

    // Применяем сохраненный размер шрифта из настроек ко всему контейнеру
    const fontSize = window.state?.config?.karaokeFontSize || 28;
    container.style.setProperty('--karaoke-font-size', `${fontSize}px`);

    const currentTrack = window.state?.library?.find(t => t.id === window.state?.currentTrackId)
      || window.state?.playbackList?.find(t => t.id === window.state?.currentTrackId)
      || window.state?.currentList?.find(t => t.id === window.state?.currentTrackId);

    if (!currentTrack) {
      container.innerHTML = `<div class="lyrics-placeholder"><span>${window.i18n?.t('lyrics_empty') || 'No lyrics found'}</span></div>`;
      container.scrollTop = 0;
      container.classList.remove('fading');
      return;
    }
    if (window.Lyrics && (forceFetch || window.Lyrics.activeTrackId !== currentTrack.id)) {
      window.Lyrics.parseAndRender(currentTrack);
      return;
    }
    const parsed = window.state?.parsedLyrics || [];
    if (!parsed || parsed.length === 0) {
      const mainLyrics = document.getElementById('lyrics-content');
      if (mainLyrics) {
        container.innerHTML = mainLyrics.innerHTML;
      } else {
        container.innerHTML = `<div class="lyrics-placeholder"><span>${window.i18n?.t('lyrics_empty') || 'No lyrics found'}</span></div>`;
      }
      container.scrollTop = 0;
      container.classList.remove('fading');
      return;
    }
    container.innerHTML = '';
    parsed.forEach((line, idx) => {
      const p = document.createElement('p');
      p.className = 'karaoke-line';
      p.textContent = line.text;
      p.id = `fs-lrc-${idx}`;
      p.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof line.time === 'number' && window.AudioEngine) {
          const targetTime = line.time;
          window.AudioEngine.audioElement.currentTime = targetTime;
          this.isUserScrollingLyrics = false;
          container.classList.remove('is-scrolling');
          if (this.userScrollLyricsTimeout) clearTimeout(this.userScrollLyricsTimeout);
          if (window.Timeline) {
            window.Timeline.updateUI(targetTime, window.Timeline.getDuration());
          }
          this.lastFocusedIdx = -1;
          this.syncHighlight(targetTime, false);
        }
      });
      container.appendChild(p);
    });
    container.classList.remove('fading');
    if (this.isOpen && this.isLyricsOpen) {
      this.syncHighlight(window.AudioEngine?.audioElement?.currentTime || 0, true);
    }
  }

  toggleMode(active) {
    if (!this.overlayEl) return;
    this.isOpen = active;
    if (active) {
      this.syncAllUI();
      this.overlayEl.classList.remove('hidden');
      this.lastFocusedIdx = -1;
      this._resetCursorAutoHide();
      this.startStarsAnim();
      const container = document.getElementById('fs-lyrics-content');
      if (container) {
        const fontSize = window.state?.config?.karaokeFontSize || 28;
        container.style.setProperty('--karaoke-font-size', `${fontSize}px`);
      }
      requestAnimationFrame(() => {
        this.overlayEl.classList.add('active');
        if (this.isLyricsOpen) {
          this.syncHighlight(window.AudioEngine?.audioElement?.currentTime || 0, true);
        }
      });
    } else {
      this.overlayEl.classList.remove('active');
      this._clearCursorAutoHide();
      this.stopStarsAnim();
      setTimeout(() => {
        if (!this.isOpen) {
          this.overlayEl.classList.add('hidden');
        }
      }, 380);
    }
  }



    syncAllUI(targetTrack = null) {
        let track = targetTrack;
        if (!track && window.state?.currentTrackId) {
            const trkId = window.state.currentTrackId;
            track = window.state.library.find(t => t.id === trkId)
                 || window.state.playbackList?.find(t => t.id === trkId)
                 || window.state.currentList?.find(t => t.id === trkId)
                 || window.state.queue?.find(t => t.id === trkId);
        }
    if (track) {
      const titleEl = document.getElementById('fs-title');
      const artistEl = document.getElementById('fs-artist');
      const coverEl = document.getElementById('fs-cover');
      if (titleEl) titleEl.textContent = track.title;
      if (artistEl) artistEl.textContent = track.artist;
      if (coverEl) {
        coverEl.style.backgroundImage = track.coverPath
          ? `url("media://${encodeURIComponent(track.coverPath)}")`
          : `var(--bg-gradient)`;
      }
      this.syncLyrics();
    }
    this.syncPlayButton();
    this.syncModeButtons();
    this.syncVolumeUI();
  }

  syncPlayButton() {
    const btn = document.getElementById('fs-btn-play-pause');
    if (!btn) return;
    const isPlaying = window.AudioEngine?.isPlaying;
    btn.classList.toggle('is-playing', !!isPlaying);
  }

  syncModeButtons() {
    const sBtn = document.getElementById('fs-btn-shuffle');
    const rBtn = document.getElementById('fs-btn-repeat');
    if (sBtn) sBtn.classList.toggle('active', !!window.state?.shuffle);
    if (rBtn) {
      const repeatPlaylistSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
      const repeatOneSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10l1.5-1v5"/><path d="M10.5 14h3"/></svg>`;
      const repState = window.state?.repeat || 0;
      if (repState === 1) {
        rBtn.classList.add('active');
        rBtn.innerHTML = repeatPlaylistSVG;
      } else if (repState === 2) {
        rBtn.classList.add('active');
        rBtn.innerHTML = repeatOneSVG;
      } else {
        rBtn.classList.remove('active');
        rBtn.innerHTML = repeatPlaylistSVG;
      }
    }
  }

  syncVolumeUI() {
    const fsVol = document.getElementById('fs-volume');
    const mainVol = document.getElementById('ui-volume');
    const fsMuteBtn = document.getElementById('fs-btn-mute');
    if (fsVol && mainVol) {
      fsVol.value = mainVol.value;
    }
    if (fsMuteBtn && mainVol) {
      const isMuted = parseFloat(mainVol.value) === 0;
      const svgVolHigh = `<svg class="icon" id="fs-icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" strokelinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      const svgVolMute = `<svg class="icon" id="fs-icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" strokelinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      fsMuteBtn.innerHTML = isMuted ? svgVolMute : svgVolHigh;
    }
  }

  syncProgress(current, total) {
    // Вся отрисовка делегирована плавному GPU-хронометру TimelineManager
  }

  syncHighlight(cTime, instant = false) {
    if (!this.isOpen || !this.isLyricsOpen) return;
    const container = document.getElementById('fs-lyrics-content');
    const parsed = window.state?.parsedLyrics;
    if (!container || !parsed || parsed.length === 0) return;

    let focusedIdx = 0;
    let highlightedIdx = -1;
    if (cTime >= parsed[0].time) {
      for (let i = 0; i < parsed.length; i++) {
        if (cTime >= parsed[i].time) {
          focusedIdx = i;
          highlightedIdx = i;
        } else break;
      }
    }
    const lines = container.querySelectorAll('.karaoke-line');
    if (lines.length === 0) {
      this.syncLyrics();
      return;
    }

    const preset = window.state?.config?.karaokePreset || 'medium';
    const targetLine = lines[focusedIdx];

    lines.forEach((line, idx) => {
      const dist = Math.abs(idx - focusedIdx);
      if (idx === highlightedIdx) {
        line.classList.add('active');
        // Чистый GPU scale: меняет только визуальный размер, не разбивая строку на 2 части
        line.style.transform = 'scale(1.08) translate3d(0, 0, 0)';
        line.style.opacity = '1';

 line.style.filter = 'blur(0px)';
      } else {
        line.classList.remove('active');
        if (dist === 0) {
          line.style.transform = 'scale(1.0) translate3d(0, 0, 0)';
          line.style.opacity = preset === 'weak' ? '0.8' : (preset === 'strong' ? '0.6' : '0.7');
          line.style.filter = 'blur(0px)';
        } else {
          let scale, opacity, blur;

          if (preset === 'weak') {
            scale = Math.max(0.80, 0.96 - (dist - 1) * 0.04).toFixed(3);
            opacity = Math.max(0.15, 0.65 - (dist - 1) * 0.10).toFixed(3);
            blur = Math.min(2.5, dist * 0.5).toFixed(1);
          } else if (preset === 'strong') {
            scale = Math.max(0.60, 0.92 - (dist - 1) * 0.10).toFixed(3);
            opacity = Math.max(0.02, 0.35 - (dist - 1) * 0.15).toFixed(3);
            blur = Math.min(8.0, dist * 1.8).toFixed(1);
          } else {
            scale = Math.max(0.68, 0.94 - (dist - 1) * 0.08).toFixed(3);
            opacity = Math.max(0.05, 0.48 - (dist - 1) * 0.14).toFixed(3);
            blur = Math.min(5.0, dist * 1.1).toFixed(1);
          }

          line.style.transform = `scale(${scale}) translate3d(0, 0, 0)`;
          line.style.opacity = opacity;
          line.style.filter = `blur(${blur}px)`;
        }
      }
    });

    if (targetLine && (!this.isUserScrollingLyrics || instant)) {
      const lineChanged = this.lastFocusedIdx !== focusedIdx;
      if (lineChanged || instant) {
        this.lastFocusedIdx = focusedIdx;
        const targetTop = targetLine.offsetTop - (container.clientHeight / 2) + (targetLine.offsetHeight / 2);
        if (instant) {
          if (this._lyricsScrollAnim) {
            cancelAnimationFrame(this._lyricsScrollAnim);
            this._lyricsScrollAnim = null;
          }
          container.scrollTop = targetTop;
        } else {
          this._smoothScrollContainer(container, targetTop, 320);
        }
      }
    }
  }

  
  _bindCursorAutoHide() {
    if (!this.overlayEl) return;
    const handleMouseActivity = () => {
      if (!this.isOpen) return;
      this._resetCursorAutoHide();
    };
    this.overlayEl.addEventListener('mousemove', handleMouseActivity);
    this.overlayEl.addEventListener('mousedown', handleMouseActivity);
  }

  _resetCursorAutoHide() {
    if (!this.overlayEl) return;
    this.overlayEl.classList.remove('hide-cursor');
    if (this.cursorHideTimeout) {
      clearTimeout(this.cursorHideTimeout);
    }
    this.cursorHideTimeout = setTimeout(() => {
      if (this.isOpen) {
        this.overlayEl.classList.add('hide-cursor');
      }
    }, this.cursorDelay);
  }

  _clearCursorAutoHide() {
    if (this.cursorHideTimeout) {
      clearTimeout(this.cursorHideTimeout);
      this.cursorHideTimeout = null;
    }
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hide-cursor');
    }
  }
}

window.FullscreenPlayer = new FullscreenPlayerManager();