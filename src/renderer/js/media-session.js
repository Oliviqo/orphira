/**
 * COSMIC PLAYER - NATIVE WINDOWS SMTC MEDIA SESSION
 * Синхронизация с экраном блокировки Windows (Win + L) + Генератор фирменных обложек
 */
class CosmicMediaSessionManager {
  constructor() {
    this.isSupported = 'mediaSession' in navigator;
    this.currentCoverBlobUrl = null;
    this.currentTrackId = null;
    this.init();
  }

  init() {
    if (!this.isSupported) return;
    this._bindHandlers();
  }

  /**
   * Освобождение памяти от предыдущего Blob URL
   */
  _revokeCoverUrl() {
    if (this.currentCoverBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentCoverBlobUrl);
      } catch (e) {}
      this.currentCoverBlobUrl = null;
    }
  }

  /**
   * Загрузка реальной обложки трека в Blob URL
   */
  async _createBlobUrl(filePath) {
    if (!filePath) return null;
    try {
      const mediaUrl = `media://${encodeURIComponent(filePath)}`;
      const res = await fetch(mediaUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size === 0) return null;
      return URL.createObjectURL(blob);
    } catch (e) {
      return null;
    }
  }

  /**
   * ГЕНЕРАТОР ФИРМЕННОЙ ОБЛОЖКИ COSMIC PLAYER (для треков без картинок)
   */
  async _generateFallbackCover(title = '', artist = '') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // 1. Космический глубокий градиент
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#0f0823');
      grad.addColorStop(0.4, '#1a0f38');
      grad.addColorStop(0.7, '#321643');
      grad.addColorStop(1, '#461c47');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // 2. Декоративное неоновое свечение по центру
      const glow = ctx.createRadialGradient(256, 200, 10, 256, 200, 180);
      glow.addColorStop(0, 'rgba(244, 114, 182, 0.35)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 512, 512);

      // 3. Звездная пыль
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const x = (Math.sin(i * 99) * 0.5 + 0.5) * 512;
        const y = (Math.cos(i * 33) * 0.5 + 0.5) * 512;
        const r = (i % 3 === 0) ? 2 : 1;
        ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

    // 4. Текст логотипа "COSMIC PLAYER"
    ctx.fillStyle = '#ff7a45';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '3px';
 const appName =
 window.state?.appIdentity?.name ||
 'Orphira';

 ctx.fillText(
 appName.toUpperCase(),
 256,
 120
 );
 
      // 5. Название песни
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      const displayTitle = title.length > 22 ? title.substring(0, 20) + '...' : title;
 ctx.fillText(
 displayTitle || appName,
 256,
 260
 );

 ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
 ctx.font = '500 22px sans-serif';
 const displayArtist =
 artist.length > 28
 ? artist.substring(0, 26) + '...'
 : artist;
 ctx.fillText(
 displayArtist || appName,
 256,
 310
 );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(URL.createObjectURL(blob));
          else resolve(null);
        }, 'image/png');
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Передача обложки, названия, артиста и альбома операционной системе
   */
  async update(track) {
    if (!this.isSupported || !track) return;

    const requestId = track.id || track.path;
    this.currentTrackId = requestId;

 const appName =
 window.state?.appIdentity?.name ||
 'Orphira';
 const displayTitle =
 track.title ||
 appName;
 const displayArtist =
 track.artist ||
 'Unknown Artist';
 const displayAlbum =
 (!track.album || track.album === 'Unknown Album')
 ? appName
 : track.album;

    // 1. Устанавливаем базовые текстовые данные мгновенно
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle,
        artist: displayArtist,
        album: displayAlbum,
        artwork: []
      });
    } catch (e) {}

    // 2. Загружаем или генерируем фирменную обложку
    let blobUrl = null;
    if (track.coverPath) {
      blobUrl = await this._createBlobUrl(track.coverPath);
    } else {
      blobUrl = await this._generateFallbackCover(displayTitle, displayArtist);
    }

    // Защита от наложения при быстром переключении треков
    if (this.currentTrackId !== requestId) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }

    this._revokeCoverUrl();
    this.currentCoverBlobUrl = blobUrl;

    if (this.currentCoverBlobUrl) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: displayTitle,
          artist: displayArtist,
          album: displayAlbum,
          artwork: [
            { src: this.currentCoverBlobUrl, sizes: '96x96', type: 'image/png' },
            { src: this.currentCoverBlobUrl, sizes: '128x128', type: 'image/png' },
            { src: this.currentCoverBlobUrl, sizes: '192x192', type: 'image/png' },
            { src: this.currentCoverBlobUrl, sizes: '256x256', type: 'image/png' },
            { src: this.currentCoverBlobUrl, sizes: '512x512', type: 'image/png' }
          ]
        });
      } catch (e) {
        console.warn('[MediaSession] Ошибка установки обложки:', e);
      }
    }
    if (window.api?.media?.syncTrayTrack) {
      window.api.media.syncTrayTrack({
        title: displayTitle,
        artist: displayArtist,
        album: displayAlbum
      });
    }
  }

  setPlaybackState(isPlaying) {
    if (window.api?.media?.syncTrayState) {
      const volInput = document.getElementById('ui-volume');
      const isMuted = volInput ? parseFloat(volInput.value) === 0 : false;
      window.api.media.syncTrayState({ isPlaying: Boolean(isPlaying), isMuted });
    }
    if (!this.isSupported) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }

  setPosition(duration = 0, currentTime = 0, rate = 1.0) {
    if (!this.isSupported || !duration || isNaN(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: Math.max(0.2, Math.min(2.0, rate)),
        position: Math.min(Math.max(0, currentTime), duration)
      });
    } catch (e) {}
  }

  _bindHandlers() {
    const safe = (fn) => { try { fn(); } catch (e) {} };
    const handlers = {
      play: () => safe(() => window.AudioEngine?.play()),
      pause: () => safe(() => window.AudioEngine?.pause()),
      previoustrack: () => safe(() => window.State?.playPrev()),
      nexttrack: () => safe(() => window.State?.playNext()),
      seekto: (details) => safe(() => {
        if (details.seekTime !== undefined && window.AudioEngine?.audioElement) {
          window.AudioEngine.audioElement.currentTime = details.seekTime;
          if (window.Timeline) {
            window.Timeline.updateUI(details.seekTime, window.Timeline.getDuration());
          }
        }
      })
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {}
    }
  }
}

window.MediaSession = new CosmicMediaSessionManager();