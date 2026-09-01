/**
 * COSMIC PLAYER - LYRICS & KARAOKE MANAGER
 * Автономный парсер субтитров .lrc, сетевой поиск LRCLIB и караоке-синхронизация
 */
class LyricsManager {
  constructor() {
    this.activeTrackId = null;
    this.searchTimer = null;
  }

  async parseAndRender(trackInput) {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }

    const setFading = () => {
      const c1 = document.getElementById('lyrics-content');
      const c2 = document.getElementById('fs-lyrics-content');
      if (c1) c1.classList.add('fading');
      if (c2) c2.classList.add('fading');
    };

    const showPlaceholder = (textKey, defaultText) => {
      const text = window.i18n?.t(textKey) || defaultText;
      const html = `<div class="lyrics-placeholder"><span>${text}</span></div>`;
      const c1 = document.getElementById('lyrics-content');
      const c2 = document.getElementById('fs-lyrics-content');
      if (c1) {
        c1.innerHTML = html;
        c1.scrollTop = 0;
        c1.classList.remove('fading');
      }
      if (c2) {
        c2.innerHTML = html;
        c2.scrollTop = 0;
        c2.classList.remove('fading');
      }
    };

    let track = typeof trackInput === 'object' && trackInput !== null ? trackInput : null;
    if (!track && window.state?.currentTrackId) {
      track = window.state.library.find(item => item.id === window.state.currentTrackId);
    }

    if (!track) {
      window.state.parsedLyrics = [];
      showPlaceholder('lyrics_empty', 'No lyrics found');
      if (window.FullscreenPlayer) {
        window.FullscreenPlayer.syncLyrics();
      }
      return;
    }

    const requestId = track.id;
    this.activeTrackId = requestId;
    window.state.parsedLyrics = [];

    // 1. Мгновенно растворяем текст предыдущей песни
    setFading();

    // 2. Таймер 500мс: если загрузка затянулась, плавно показываем "Поиск текста..."
    this.searchTimer = setTimeout(() => {
      if (this.activeTrackId === requestId) {
        showPlaceholder('lyrics_searching', 'Searching for lyrics...');
      }
    }, 500);

    if (window.api?.os?.resolveTrackLyrics) {
      const localAsset = await window.api.os.resolveTrackLyrics(track);
      if (this.activeTrackId !== requestId) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        return;
      }
      if (localAsset?.content && localAsset.content.trim()) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        track.lyricsPath = localAsset.path || track.lyricsPath;
        if (localAsset.type === 'downloaded') {
          track.downloadedLyricsPath = localAsset.path || null;
        }
        this._renderLrcData(localAsset.content);
        if (!localAsset.synced) {
          this._upgradePlainLyricsInBackground(track, requestId);
        }
        return;
      }
    } else if (track.lyricsPath) {
      const data = await window.api.os.readLyrics(track.lyricsPath);
      if (this.activeTrackId !== requestId) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        return;
      }
      if (data && data.trim()) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        this._renderLrcData(data);
        return;
      }
    }

    if (track.title) {
      const onlineLrc = await window.api.os.fetchOnlineLyrics(
        track.artist,
        track.title,
        track.path
      );
      if (this.activeTrackId !== requestId) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        return;
      }
      if (onlineLrc && window.api?.os?.resolveTrackLyrics) {
        const resolvedAsset = await window.api.os.resolveTrackLyrics(track);
        if (this.activeTrackId !== requestId) {
          if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
          return;
        }
        if (resolvedAsset?.content && resolvedAsset.content.trim()) {
          if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
          track.lyricsPath = resolvedAsset.path || track.lyricsPath;
          if (resolvedAsset.type === 'downloaded') {
            track.downloadedLyricsPath = resolvedAsset.path || null;
          }
          this._renderLrcData(resolvedAsset.content);
          return;
        }
      }
      if (onlineLrc) {
        if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
        this._renderLrcData(onlineLrc);
        return;
      }
    }

    if (this.activeTrackId === requestId) {
      if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
      window.state.parsedLyrics = [];
      showPlaceholder('lyrics_empty', 'No lyrics found');
      if (window.FullscreenPlayer) {
        window.FullscreenPlayer.syncLyrics();
      }
    }
  }

 async _upgradePlainLyricsInBackground(
  track,
  requestId
 ) {
  if (
   !track?.title ||
   !window.api?.os
    ?.fetchOnlineLyrics
  ) {
   return;
  }

  const onlineLrc =
   await window.api.os
    .fetchOnlineLyrics(
     track.artist,
     track.title,
     track.path
    );

  if (
   !onlineLrc ||
   this.activeTrackId !==
    requestId
  ) {
   return;
  }

  const hasSyncedTiming =
   /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(
    onlineLrc
   );

  if (!hasSyncedTiming) {
   return;
  }

  let resolvedAsset = null;

  if (
   window.api?.os
    ?.resolveTrackLyrics
  ) {
   resolvedAsset =
    await window.api.os
     .resolveTrackLyrics(
      track
     );
  }

  if (
   this.activeTrackId !==
    requestId
  ) {
   return;
  }

  const upgradedContent =
   resolvedAsset?.synced
    ? resolvedAsset.content
    : onlineLrc;

  if (
   !upgradedContent ||
   !/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(
    upgradedContent
   )
  ) {
   return;
  }

  if (
   resolvedAsset?.type ===
    'downloaded'
  ) {
   track.downloadedLyricsPath =
    resolvedAsset.path ||
    null;

   track.lyricsPath =
    resolvedAsset.path ||
    track.lyricsPath;
  }

  this._renderLrcData(
   upgradedContent
  );
 }

  _renderLrcData(data) {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const lines = data.split('\n');
    const parsed = [];
    lines.forEach(l => {
      const timeMatches = [...l.matchAll(/\[(\d{2}):(\d{2}(?:\.\d+)?)\]/g)];
      const text = l.replace(/\[\d{2}:\d{2}(?:\.\d+)?\]/g, '').trim();
      if (timeMatches.length > 0 && text) {
        timeMatches.forEach(m => {
          const min = parseInt(m[1], 10);
          const sec = parseFloat(m[2]);
          const time = min * 60 + sec;
          parsed.push({ time, text });
        });
      }
    });
    parsed.sort((a, b) => a.time - b.time);
    window.state.parsedLyrics = parsed;
    window.PluginRuntime?.emit(
      'lyrics.changed',
      {
        trackId: window.state?.currentTrackId || null,
        lines: parsed.map(line => ({
          time: Number(line.time || 0),
          text: String(line.text || '')
        }))
      }
    );
    const container = document.getElementById('lyrics-content');
    if (container) {
      container.innerHTML = '';
      parsed.forEach((line, idx) => {
        const p = document.createElement('p');
        p.className = 'karaoke-line';
        p.textContent = line.text;
        p.id = `lrc-${idx}`;
        container.appendChild(p);
      });
      container.classList.remove('fading');
    }
    if (window.FullscreenPlayer) {
      window.FullscreenPlayer.syncLyrics();
    }
  }

  syncHighlight(cTime, instant = false) {
    if (!this.isOpen || !this.isLyricsOpen) return;
    const container = document.getElementById('fs-lyrics-content');
    const parsed = window.state?.parsedLyrics;
    if (!container || !parsed || parsed.length === 0) return;
    if (container.classList.contains('fading')) return;
    if (window.FullscreenPlayer && window.FullscreenPlayer.isOpen) {
      window.FullscreenPlayer.syncHighlight(cTime, instant);
    }
  }
}

window.Lyrics = new LyricsManager();