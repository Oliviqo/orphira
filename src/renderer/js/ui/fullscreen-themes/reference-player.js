/**
 * ORPHIRA - FULLSCREEN PLAYER THEME: REFERENCE
 *
 * Изолированный runtime-слой Reference fullscreen layout.
 *
 * Reference-specific DOM создаётся только при активной Reference теме
 * и полностью удаляется при возвращении в Classic.
 */
class ReferenceFullscreenPlayerTheme {
 constructor() {
 this.overlay = null;
 this.metaContainer = null;
 this.referenceMetaRow = null;
 this.themeClass =
 'fullscreen-theme-reference';
 this.initialized = false;
 this.paletteRequestToken = 0;
 }
 init() {
 if (this.initialized) {
 return;
 }
 this.overlay =
 document.getElementById(
 'fullscreen-overlay'
 );
 this.metaContainer =
 this.overlay?.querySelector(
 '.fullscreen-meta'
 );
 if (
 !this.overlay ||
 !this.metaContainer
 ) {
 return;
 }
 this.initialized = true;
 this.applyConfiguredTheme();
 }
 applyConfiguredTheme() {
 const configuredTheme =
 window.state?.config
 ?.fullscreenPlayerTheme ||
 'classic';
 if (
 configuredTheme ===
 'reference'
 ) {
 this.enable();
 } else {
 this.disable();
 }
 }
 setTheme(themeId) {
 const normalized =
 themeId === 'reference'
 ? 'reference'
 : 'classic';
 if (window.state?.config) {
 window.state.config
 .fullscreenPlayerTheme =
 normalized;
 if (window.api?.db?.saveConfig) {
 window.api.db.saveConfig(
 window.state.config
 );
 }
 }
 if (normalized === 'reference') {
 this.enable();
 } else {
 this.disable();
 }
 }


 
  enable() {
    if (!this.overlay) {
      return;
    }
    if (!this.ambientContainer) {
      this.ambientContainer = document.createElement('div');
      this.ambientContainer.className = 'reference-ambient-container';
      this.overlay.insertBefore(this.ambientContainer, this.overlay.firstChild);
    }
    this.overlay.classList.add(
      this.themeClass
    );
    this._createReferenceMetadata();
    this.sync();
  }

  disable() {
    if (!this.overlay) {
      return;
    }
    this.paletteRequestToken++;
    this.overlay.classList.remove(
      this.themeClass
    );
    this._removeReferenceMetadata();
    this._resetDynamicArtwork();
    this._restoreClassicMetadata();
    if (this.ambientContainer) {
      this.ambientContainer.remove();
      this.ambientContainer = null;
    }
  }

  isEnabled() {
    return Boolean(
      this.overlay &&
      this.overlay.classList.contains(
        this.themeClass
      )
    );
  }

  _createReferenceMetadata() {
    if (
      !this.metaContainer ||
      !this.isEnabled()
    ) {
      return;
    }
    if (
      !this.referenceMetaRow ||
      !this.referenceMetaRow.isConnected
    ) {
      this.referenceMetaRow =
        document.createElement('div');
      this.referenceMetaRow.className =
        'reference-meta-row';
      this.metaContainer.appendChild(
        this.referenceMetaRow
      );
    }
    let technicalRow =
      this.metaContainer.querySelector(
        '.reference-technical-row'
      );
    if (!technicalRow) {
      technicalRow =
        document.createElement('div');
      technicalRow.className =
        'reference-technical-row';
      this.metaContainer.appendChild(
        technicalRow
      );
    }
    this.technicalMetaRow =
      technicalRow;
    this.metaContainer
      .querySelectorAll(
        '.reference-track-technical'
      )
      .forEach(
        element =>
        element.remove()
      );
  }

  _removeReferenceMetadata() {
    if (this.referenceMetaRow) {
      this.referenceMetaRow.remove();
      this.referenceMetaRow = null;
    }
    if (this.metaContainer) {
      this.metaContainer
        .querySelectorAll(
          '.reference-track-technical, .reference-meta-row, .reference-technical-row'
        )
        .forEach(
          element =>
          element.remove()
        );
    }
  }

  _findCurrentTrack() {
    const trackId =
      window.state?.currentTrackId;
    if (!trackId) {
      return null;
    }
    return (
      window.state?.library?.find(
        track =>
        track?.id === trackId
      ) ||
      window.state?.playbackList?.find(
        track =>
        track?.id === trackId
      ) ||
      window.state?.queue?.find(
        track =>
        track?.id === trackId
      ) ||
      window.state?.currentList?.find(
        track =>
        track?.id === trackId
      ) ||
      null
    );
  }

  _restoreClassicMetadata() {
    const track =
      this._findCurrentTrack();
    const artistElement =
      document.getElementById(
        'fs-artist'
      );
    if (
      track &&
      artistElement
    ) {
      artistElement.textContent =
        track.artist || '';
    }
  }

  _createDot() {
    const dot =
      document.createElement('span');
    dot.className =
      'reference-meta-dot';
    dot.setAttribute(
      'aria-hidden',
      'true'
    );
    return dot;
  }

  _appendMetadataItems(
    container,
    values
  ) {
    if (!container) {
      return;
    }
    container.innerHTML = '';
    const filtered =
      values
      .map(value =>
        String(value || '').trim()
      )
      .filter(Boolean);
    filtered.forEach(
      (value, index) => {
        if (index > 0) {
          container.appendChild(
            this._createDot()
          );
        }
        const item =
          document.createElement('span');
        item.className =
          'reference-meta-item';
        item.textContent =
          value;
        container.appendChild(
          item
        );
      }
    );
  }

  _getArtist(track) {
    const artist =
      String(
        track?.artist || ''
      )
      .trim();
    if (
      !artist ||
      artist.toLowerCase() ===
      'unknown artist'
    ) {
      return '';
    }
    return artist;
  }

  _getAlbum(track) {
    const album =
      String(
        track?.album || ''
      )
      .trim();
    if (
      !album ||
      album.toLowerCase() ===
      'unknown album'
    ) {
      return '';
    }
    return album;
  }

  _getYear(track) {
    const year =
      Number(track?.year);
    if (
      !Number.isFinite(year) ||
      year < 1000 ||
      year > 9999
    ) {
      return '';
    }
    return String(
      Math.floor(year)
    );
  }

  _getAudioFormat(track) {
    const codec =
      String(
        track?.codec ||
        track?.container ||
        ''
      )
      .trim()
      .toUpperCase();
    if (!codec) {
      return '';
    }
    const aliases = {
      'MPEG 1 LAYER 3': 'MP3',
      'MPEG 2 LAYER 3': 'MP3',
      'MPEG LAYER 3': 'MP3',
      'MPEG-1 AUDIO LAYER III': 'MP3',
      'MPEG-2 AUDIO LAYER III': 'MP3',
      'MPEG AUDIO': 'MP3',
      'MPEG': 'MP3'
    };
    return aliases[codec] || codec;
  }

  _getBitrate(track) {
    const rawBitrate =
      Number(track?.bitrate);
    if (
      !Number.isFinite(rawBitrate) ||
      rawBitrate <= 0
    ) {
      return '';
    }
    const kbps =
      rawBitrate >= 1000
      ? Math.round(rawBitrate / 1000)
      : Math.round(rawBitrate);
    return `${kbps} kb/s`;
  }

  _getSampleRate(track) {
    const sampleRate =
      Number(track?.sampleRate);
    if (
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0
    ) {
      return '';
    }
    const khz =
      sampleRate >= 1000
      ? sampleRate / 1000
      : sampleRate;
    const formatted =
      Number.isInteger(khz)
      ? String(khz)
      : khz
      .toFixed(1)
      .replace(/\.0$/, '');
    return `${formatted} kHz`;
  }

  _getChannelLayout(track) {
    const channels =
      Number(track?.numberOfChannels);
    if (
      !Number.isFinite(channels) ||
      channels <= 0
    ) {
      return '';
    }
    if (channels === 1) {
      return 'Mono';
    }
    if (channels === 2) {
      return 'Stereo';
    }
    return `${channels} channels`;
  }

  _getTechnicalMetadata(track) {
    return [
      this._getAudioFormat(track),
      this._getBitrate(track),
      this._getSampleRate(track),
      this._getChannelLayout(track)
    ]
    .filter(Boolean);
  }

  _resetDynamicArtwork() {
    if (!this.overlay) {
      return;
    }
    this.overlay.classList.remove(
      'reference-has-cover-palette'
    );
    if (this.ambientContainer) {
      this.ambientContainer.innerHTML = '';
    }
  }

  async _applyDynamicArtwork(track) {
    if (
      !this.overlay ||
      !this.isEnabled()
    ) {
      return;
    }
    const requestToken =
      ++this.paletteRequestToken;
    const coverPath =
      track?.coverPath || null;
      
    if (!coverPath) {
      this._resetDynamicArtwork();
      return;
    }
    
    const mediaUrl =
      `media://${encodeURIComponent(coverPath)}`;
      
    if (!window.CoverColor) {
      return;
    }
    
    const palette =
      await window.CoverColor.extractPalette(
        mediaUrl
      );
      
    if (
      requestToken !==
        this.paletteRequestToken ||
      !this.isEnabled() ||
      !palette
    ) {
      return;
    }

    if (!this.ambientContainer) {
      this.ambientContainer = document.createElement('div');
      this.ambientContainer.className = 'reference-ambient-container';
      this.overlay.insertBefore(this.ambientContainer, this.overlay.firstChild);
    }

    const layer = document.createElement('div');
    layer.className = 'reference-bg-layer';

    const crossfadeEnabled = window.state?.config?.crossfadeEnabled ?? false;
    const crossfadeSec = window.state?.config?.crossfadeDuration ?? 2;
    const isPlaying = window.AudioEngine?.isPlaying || false;
    const fadeMs = (crossfadeEnabled && isPlaying) ? (crossfadeSec * 1000) : 400;

    layer.style.transition = `opacity ${fadeMs}ms ease-in-out`;
    layer.style.setProperty('--reference-artwork-image', `url("${mediaUrl}")`);
    layer.style.setProperty('--reference-cover-rgb', palette.dominantRgb);
    layer.style.setProperty('--reference-accent', palette.accent);
    layer.style.setProperty('--reference-accent-rgb', palette.accentRgb);
    layer.style.setProperty('--reference-ambient-rgb', palette.ambientRgb);
    
    this.ambientContainer.appendChild(layer);
    
    void layer.offsetWidth;
    layer.classList.add('active');

    const allLayers = this.ambientContainer.querySelectorAll('.reference-bg-layer');
    allLayers.forEach(oldLayer => {
      if (oldLayer !== layer) {
        oldLayer.classList.remove('active');
        setTimeout(() => {
          if (oldLayer.parentNode === this.ambientContainer) {
            oldLayer.remove();
          }
        }, fadeMs + 100);
      }
    });

    this.overlay.classList.add(
      'reference-has-cover-palette'
    );
  }
 sync(trackInput = null) {
 if (
 !this.initialized ||
 !this.isEnabled()
 ) {
 return;
 }

 this._createReferenceMetadata();

 const track =
 trackInput ||
 this._findCurrentTrack();

 if (!track) {
 if (this.referenceMetaRow) {
 this.referenceMetaRow.innerHTML = '';
 }
 if (this.technicalMetaRow) {
 this.technicalMetaRow.innerHTML = '';
 this.technicalMetaRow.classList.add(
 'is-empty'
 );
 }
 this._resetDynamicArtwork();
 return;
 }

 const originalArtistElement =
 document.getElementById(
 'fs-artist'
 );

 if (originalArtistElement) {
 originalArtistElement.textContent = '';
 }

 this._appendMetadataItems(
 this.referenceMetaRow,
 [
 this._getArtist(track),
 this._getAlbum(track),
 this._getYear(track)
 ]
 );

 this._appendMetadataItems(
 this.technicalMetaRow,
 this._getTechnicalMetadata(track)
 );

 if (this.technicalMetaRow) {
 this.technicalMetaRow.classList.toggle(
 'is-empty',
 this.technicalMetaRow.children.length === 0
 );
 }

 this._applyDynamicArtwork(track);
 }
}
window.ReferenceFullscreenPlayerTheme =
 new ReferenceFullscreenPlayerTheme();
document.addEventListener(
 'DOMContentLoaded',
 () => {
 window.ReferenceFullscreenPlayerTheme
 .init();
 }
);