/**
 * COSMIC PLAYER - ALBUM COVER VIEWER
 * Самостоятельный Artwork Viewer внутри workspace.
 *
 * Возможности:
 * - динамический ambient из палитры обложки;
 * - определение нативного разрешения изображения;
 * - защита от бессмысленного растягивания маленьких обложек;
 * - zoom 1x-4x колесом, кнопками и клавиатурой;
 * - двойной клик 1x / 2x;
 * - pan изображения мышью только при увеличении;
 * - Find HD Cover через существующий album cover pipeline;
 * - автоскрытие курсора и управляющего UI;
 * - плавное проявление изображения после decode;
 * - Escape сначала сбрасывает zoom, затем закрывает viewer.
 */
class AlbumCoverViewerManager {
 constructor() {
 this.isOpen = false;
 this.viewerEl = null;
 this.imageEl = null;
 this.closeBtn = null;

 this.toolbarEl = null;
 this.resolutionEl = null;
 this.hdButtonEl = null;
 this.zoomValueEl = null;

 this.currentCoverPath = null;
 this.currentAlbumInfo = null;

 this.naturalWidth = 0;
 this.naturalHeight = 0;
 this.isSmallArtwork = false;

 this.zoom = 1;
 this.minZoom = 1;
 this.maxZoom = 4;
 this.zoomStep = 0.25;

 this.panX = 0;
 this.panY = 0;
 this.isPanning = false;
 this.panStartX = 0;
 this.panStartY = 0;
 this.panOriginX = 0;
 this.panOriginY = 0;

 this.closeTimer = null;
 this.controlsHideTimer = null;
 this.controlsHideDelay = 4000;

 this.loadToken = 0;
 this.paletteToken = 0;

 this.initialized = false;
 }

 init() {
 if (this.initialized) return;

 this.viewerEl = document.getElementById('album-cover-viewer');
 this.imageEl = document.getElementById('album-cover-viewer-image');
 this.closeBtn = document.getElementById('album-cover-viewer-close');

 if (!this.viewerEl || !this.imageEl) return;

 this.initialized = true;

 this._injectInterface();
 this._bindCloseButton();
 this._bindPointerControls();
 this._bindWheelZoom();
 this._bindDoubleClickZoom();
 this._bindKeyboardControls();
 this._bindActivityDetection();
 this._applyTransform();
 }

 _injectInterface() {
 if (!this.viewerEl) return;

 if (!document.getElementById('album-cover-viewer-resolution')) {
 const resolution = document.createElement('div');
 resolution.id = 'album-cover-viewer-resolution';
 resolution.className = 'album-cover-viewer-resolution';
 resolution.textContent = '';
 this.viewerEl.appendChild(resolution);
 this.resolutionEl = resolution;
 } else {
 this.resolutionEl =
 document.getElementById('album-cover-viewer-resolution');
 }

 if (!document.getElementById('album-cover-viewer-toolbar')) {
 const toolbar = document.createElement('div');
 toolbar.id = 'album-cover-viewer-toolbar';
 toolbar.className = 'album-cover-viewer-toolbar';

 const zoomOut = document.createElement('button');
 zoomOut.className = 'album-cover-viewer-action';
 zoomOut.id = 'album-cover-viewer-zoom-out';
 zoomOut.setAttribute('data-i18n-tooltip', 'cover_viewer_zoom_out');
 zoomOut.innerHTML = `
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
 <circle cx="11" cy="11" r="6"></circle>
 <path d="M8 11h6"></path>
 <path d="M16 16l4 4"></path>
 </svg>
 `;

 const resetZoom = document.createElement('button');
 resetZoom.className = 'album-cover-viewer-action album-cover-viewer-reset';
 resetZoom.id = 'album-cover-viewer-reset';
 resetZoom.setAttribute('data-i18n-tooltip', 'cover_viewer_reset_zoom');
 resetZoom.innerHTML = `
 <span class="album-cover-viewer-zoom-value" id="album-cover-viewer-zoom-value">100%</span>
 `;

 const zoomIn = document.createElement('button');
 zoomIn.className = 'album-cover-viewer-action';
 zoomIn.id = 'album-cover-viewer-zoom-in';
 zoomIn.setAttribute('data-i18n-tooltip', 'cover_viewer_zoom_in');
 zoomIn.innerHTML = `
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
 <circle cx="11" cy="11" r="6"></circle>
 <path d="M8 11h6"></path>
 <path d="M11 8v6"></path>
 <path d="M16 16l4 4"></path>
 </svg>
 `;

 const separator = document.createElement('div');
 separator.className = 'album-cover-viewer-toolbar-separator';

 const hdButton = document.createElement('button');
 hdButton.className =
 'album-cover-viewer-action album-cover-viewer-hd-action';
 hdButton.id = 'album-cover-viewer-find-hd';
 hdButton.setAttribute('data-i18n-tooltip', 'cover_viewer_find_hd');
 hdButton.innerHTML = `
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
 <circle cx="11" cy="11" r="6"></circle>
 <path d="M16 16l4 4"></path>
 <path d="M8 11h6"></path>
 <path d="M11 8v6"></path>
 </svg>
 <span data-i18n="cover_viewer_find_hd">Find HD Cover</span>
 `;

 toolbar.appendChild(zoomOut);
 toolbar.appendChild(resetZoom);
 toolbar.appendChild(zoomIn);
 toolbar.appendChild(separator);
 toolbar.appendChild(hdButton);

 this.viewerEl.appendChild(toolbar);

 this.toolbarEl = toolbar;
 this.hdButtonEl = hdButton;
 this.zoomValueEl =
 resetZoom.querySelector('#album-cover-viewer-zoom-value');

 zoomOut.addEventListener('click', (e) => {
 e.stopPropagation();
 this.setZoom(this.zoom - this.zoomStep);
 this._showControlsTemporarily();
 });

 zoomIn.addEventListener('click', (e) => {
 e.stopPropagation();
 this.setZoom(this.zoom + this.zoomStep);
 this._showControlsTemporarily();
 });

 resetZoom.addEventListener('click', (e) => {
 e.stopPropagation();
 this.resetTransform();
 this._showControlsTemporarily();
 });

 hdButton.addEventListener('click', async (e) => {
 e.stopPropagation();
 await this._findHdCover();
 });
 } else {
 this.toolbarEl =
 document.getElementById('album-cover-viewer-toolbar');
 this.hdButtonEl =
 document.getElementById('album-cover-viewer-find-hd');
 this.zoomValueEl =
 document.getElementById('album-cover-viewer-zoom-value');
 }

 if (window.i18n) {
 window.i18n.updateDOM();
 }
 }

 _bindCloseButton() {
 this.closeBtn?.addEventListener('click', (e) => {
 e.preventDefault();
 e.stopPropagation();
 this.close();
 });
 }

 _bindPointerControls() {
 if (!this.imageEl) return;

 this.imageEl.addEventListener('pointerdown', (e) => {
 if (!this.isOpen || this.zoom <= 1) return;
 if (e.button !== 0) return;

 e.preventDefault();

 this.isPanning = true;
 this.panStartX = e.clientX;
 this.panStartY = e.clientY;
 this.panOriginX = this.panX;
 this.panOriginY = this.panY;

 this.imageEl.classList.add('is-panning');

 try {
 this.imageEl.setPointerCapture(e.pointerId);
 } catch (err) {}
 });

 this.imageEl.addEventListener('pointermove', (e) => {
 if (!this.isPanning || this.zoom <= 1) return;

 e.preventDefault();

 this.panX =
 this.panOriginX + (e.clientX - this.panStartX);
 this.panY =
 this.panOriginY + (e.clientY - this.panStartY);

 this._clampPan();
 this._applyTransform();
 });

 const stopPan = (e) => {
 if (!this.isPanning) return;

 this.isPanning = false;
 this.imageEl.classList.remove('is-panning');

 try {
 if (
 e?.pointerId !== undefined &&
 this.imageEl.hasPointerCapture(e.pointerId)
 ) {
 this.imageEl.releasePointerCapture(e.pointerId);
 }
 } catch (err) {}
 };

 this.imageEl.addEventListener('pointerup', stopPan);
 this.imageEl.addEventListener('pointercancel', stopPan);
 }

 _bindWheelZoom() {
 if (!this.viewerEl) return;

 this.viewerEl.addEventListener('wheel', (e) => {
 if (!this.isOpen) return;

 e.preventDefault();

 const direction = e.deltaY < 0 ? 1 : -1;
 this.setZoom(
 this.zoom + direction * this.zoomStep
 );

 this._showControlsTemporarily();
 }, { passive: false });
 }

 _bindDoubleClickZoom() {
 if (!this.imageEl) return;

 this.imageEl.addEventListener('dblclick', (e) => {
 e.preventDefault();
 e.stopPropagation();

 if (this.zoom > 1.01) {
 this.resetTransform();
 } else {
 this.setZoom(2);
 }

 this._showControlsTemporarily();
 });
 }

 _bindKeyboardControls() {
 document.addEventListener('keydown', (e) => {
 if (!this.isOpen) return;

 if (
 ['INPUT', 'TEXTAREA'].includes(
 document.activeElement?.tagName
 )
 ) {
 return;
 }

 if (e.key === 'Escape') {
 e.preventDefault();
 e.stopPropagation();
 e.stopImmediatePropagation();

 if (
 this.zoom > 1.01 ||
 Math.abs(this.panX) > 0.5 ||
 Math.abs(this.panY) > 0.5
 ) {
 this.resetTransform();
 this._showControlsTemporarily();
 } else {
 this.close();
 }

 return;
 }

 if (
 e.key === '+' ||
 e.key === '=' ||
 e.code === 'NumpadAdd'
 ) {
 e.preventDefault();
 this.setZoom(this.zoom + this.zoomStep);
 this._showControlsTemporarily();
 return;
 }

 if (
 e.key === '-' ||
 e.key === '_' ||
 e.code === 'NumpadSubtract'
 ) {
 e.preventDefault();
 this.setZoom(this.zoom - this.zoomStep);
 this._showControlsTemporarily();
 return;
 }

 if (
 e.key === '0' ||
 e.code === 'Numpad0'
 ) {
 e.preventDefault();
 this.resetTransform();
 this._showControlsTemporarily();
 }
 }, true);
 }

 _bindActivityDetection() {
 if (!this.viewerEl) return;

 const handleActivity = () => {
 if (!this.isOpen) return;
 this._showControlsTemporarily();
 };

 this.viewerEl.addEventListener(
 'mousemove',
 handleActivity
 );

 this.viewerEl.addEventListener(
 'pointerdown',
 handleActivity
 );

 this.viewerEl.addEventListener(
 'wheel',
 handleActivity,
 { passive: true }
 );
 }

 async open(coverPath, albumInfo = null) {
 if (!this.initialized) {
 this.init();
 }

 if (
 !this.viewerEl ||
 !this.imageEl ||
 !coverPath
 ) {
 return;
 }

 if (this.closeTimer) {
 clearTimeout(this.closeTimer);
 this.closeTimer = null;
 }

 this.currentCoverPath = coverPath;
 this.currentAlbumInfo =
 albumInfo ||
 window.AlbumView?.currentAlbumInfo ||
 null;

 this.isOpen = true;

 this.resetTransform();
 this._resetPalette();

 this.viewerEl.classList.remove('viewer-open');
 this.viewerEl.classList.remove('viewer-closing');
 this.viewerEl.classList.add('viewer-opening');
 this.viewerEl.classList.remove('hidden');
 this.viewerEl.classList.add('is-loading');
 this.viewerEl.classList.remove('small-artwork');

 this._setArtworkSource(coverPath);

 requestAnimationFrame(() => {
 requestAnimationFrame(() => {
 if (
 !this.isOpen ||
 !this.viewerEl
 ) {
 return;
 }

 this.viewerEl.classList.remove('viewer-opening');
 this.viewerEl.classList.add('viewer-open');
 });
 });

 this._showControlsTemporarily();

 await Promise.allSettled([
 this._loadArtworkMetadata(coverPath),
 this._applyAmbientPalette(coverPath)
 ]);
 }

 close() {
 if (
 !this.isOpen ||
 !this.viewerEl
 ) {
 return;
 }

 this.isOpen = false;
 this.loadToken++;
 this.paletteToken++;

 this._clearControlsHideTimer();

 this.isPanning = false;
 this.imageEl?.classList.remove('is-panning');

 this.viewerEl.classList.remove('controls-hidden');
 this.viewerEl.classList.remove('viewer-opening');
 this.viewerEl.classList.remove('viewer-open');
 this.viewerEl.classList.add('viewer-closing');

 if (this.closeTimer) {
 clearTimeout(this.closeTimer);
 }

 this.closeTimer = setTimeout(() => {
 if (
 this.isOpen ||
 !this.viewerEl
 ) {
 this.closeTimer = null;
 return;
 }

 this.viewerEl.classList.add('hidden');
 this.viewerEl.classList.remove('viewer-closing');
 this.viewerEl.classList.remove('is-loading');
 this.viewerEl.classList.remove('small-artwork');

 this._clearArtworkSource();
 this._resetPalette();
 this.resetTransform();

 this.currentCoverPath = null;
 this.currentAlbumInfo = null;
 this.naturalWidth = 0;
 this.naturalHeight = 0;
 this.isSmallArtwork = false;

 if (this.resolutionEl) {
 this.resolutionEl.textContent = '';
 }

 this.closeTimer = null;
 }, 180);
 }

 _setArtworkSource(coverPath) {
 if (!this.viewerEl || !this.imageEl) return;

 const mediaUrl =
 `media://${encodeURIComponent(coverPath)}`;

 this.viewerEl.style.setProperty(
 '--cover-viewer-image',
 `url("${mediaUrl}")`
 );

 this.imageEl.style.backgroundImage =
 `url("${mediaUrl}")`;
 }

 _clearArtworkSource() {
 if (!this.viewerEl || !this.imageEl) return;

 this.viewerEl.style.removeProperty(
 '--cover-viewer-image'
 );

 this.imageEl.style.backgroundImage = '';
 this.imageEl.style.removeProperty(
 '--cover-viewer-native-max'
 );
 }

 async _loadArtworkMetadata(coverPath) {
 const requestToken = ++this.loadToken;
 const mediaUrl =
 `media://${encodeURIComponent(coverPath)}`;

 try {
 const image = new Image();
 image.decoding = 'async';
 image.src = mediaUrl;

 if (typeof image.decode === 'function') {
 await image.decode();
 } else {
 await new Promise((resolve, reject) => {
 image.onload = resolve;
 image.onerror = reject;
 });
 }

 if (
 requestToken !== this.loadToken ||
 !this.isOpen ||
 this.currentCoverPath !== coverPath
 ) {
 return;
 }

 this.naturalWidth =
 image.naturalWidth || image.width || 0;

 this.naturalHeight =
 image.naturalHeight || image.height || 0;

 this.isSmallArtwork =
 this.naturalWidth > 0 &&
 this.naturalHeight > 0 &&
 (
 this.naturalWidth < 700 ||
 this.naturalHeight < 700
 );

 if (this.resolutionEl) {
 const resolution =
 `${this.naturalWidth} × ${this.naturalHeight}`;

 const suffix = this.isSmallArtwork
 ? (
 window.i18n?.t('cover_viewer_low_resolution') ||
 'Low resolution'
 )
 : '';

 this.resolutionEl.textContent =
 suffix
 ? `${resolution} · ${suffix}`
 : resolution;
 }

 if (this.imageEl) {
 const maxNativeCssSize = Math.max(
 220,
 Math.min(
 760,
 this.naturalWidth || 760,
 this.naturalHeight || 760
 )
 );

 this.imageEl.style.setProperty(
 '--cover-viewer-native-max',
 `${maxNativeCssSize}px`
 );
 }

 if (this.viewerEl) {
 this.viewerEl.classList.toggle(
 'small-artwork',
 this.isSmallArtwork
 );

 this.viewerEl.classList.remove(
 'is-loading'
 );
 }

 this._updateHdActionState();
 } catch (e) {
 if (
 requestToken !== this.loadToken ||
 !this.isOpen
 ) {
 return;
 }

 if (this.resolutionEl) {
 this.resolutionEl.textContent =
 window.i18n?.t('cover_viewer_resolution_unknown') ||
 'Resolution unknown';
 }

 this.viewerEl?.classList.remove('is-loading');
 }
 }

 async _applyAmbientPalette(coverPath) {
 if (
 !window.CoverColor ||
 !this.viewerEl
 ) {
 return;
 }

 const requestToken = ++this.paletteToken;
 const mediaUrl =
 `media://${encodeURIComponent(coverPath)}`;

 const palette =
 await window.CoverColor.extractPalette(mediaUrl);

 if (
 requestToken !== this.paletteToken ||
 !this.isOpen ||
 this.currentCoverPath !== coverPath ||
 !palette ||
 !this.viewerEl
 ) {
 return;
 }

 this.viewerEl.style.setProperty(
 '--cover-viewer-dominant-rgb',
 palette.dominantRgb
 );

 this.viewerEl.style.setProperty(
 '--cover-viewer-accent',
 palette.accent
 );

 this.viewerEl.style.setProperty(
 '--cover-viewer-accent-rgb',
 palette.accentRgb
 );

 this.viewerEl.style.setProperty(
 '--cover-viewer-ambient-rgb',
 palette.ambientRgb
 );

 this.viewerEl.classList.add(
 'has-cover-palette'
 );
 }

 _resetPalette() {
 if (!this.viewerEl) return;

 this.viewerEl.classList.remove(
 'has-cover-palette'
 );

 this.viewerEl.style.removeProperty(
 '--cover-viewer-dominant-rgb'
 );

 this.viewerEl.style.removeProperty(
 '--cover-viewer-accent'
 );

 this.viewerEl.style.removeProperty(
 '--cover-viewer-accent-rgb'
 );

 this.viewerEl.style.removeProperty(
 '--cover-viewer-ambient-rgb'
 );
 }

 setZoom(value) {
 const nextZoom =
 Math.max(
 this.minZoom,
 Math.min(
 this.maxZoom,
 Number(value) || 1
 )
 );

 this.zoom =
 Math.round(nextZoom * 100) / 100;

 if (this.zoom <= 1) {
 this.zoom = 1;
 this.panX = 0;
 this.panY = 0;
 this.isPanning = false;
 }

 this._clampPan();
 this._applyTransform();
 }

 resetTransform() {
 this.zoom = 1;
 this.panX = 0;
 this.panY = 0;
 this.isPanning = false;

 if (this.imageEl) {
 this.imageEl.classList.remove('is-panning');
 }

 this._applyTransform();
 }

 _clampPan() {
 if (
 !this.imageEl ||
 this.zoom <= 1
 ) {
 this.panX = 0;
 this.panY = 0;
 return;
 }

 const rect =
 this.imageEl.getBoundingClientRect();

 const unscaledWidth =
 rect.width / this.zoom;

 const unscaledHeight =
 rect.height / this.zoom;

 const overflowX =
 Math.max(
 0,
 (unscaledWidth * this.zoom - unscaledWidth) / 2
 );

 const overflowY =
 Math.max(
 0,
 (unscaledHeight * this.zoom - unscaledHeight) / 2
 );

 this.panX =
 Math.max(
 -overflowX,
 Math.min(overflowX, this.panX)
 );

 this.panY =
 Math.max(
 -overflowY,
 Math.min(overflowY, this.panY)
 );
 }

 _applyTransform() {
 if (!this.imageEl) return;

 this.imageEl.style.transform =
 `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;

 this.imageEl.classList.toggle(
 'is-zoomed',
 this.zoom > 1
 );

 if (this.zoomValueEl) {
 this.zoomValueEl.textContent =
 `${Math.round(this.zoom * 100)}%`;
 }
 }

 async _findHdCover() {
 if (
 !this.isOpen ||
 !window.api?.batch?.downloadAlbumCover
 ) {
 return;
 }

 const albumInfo =
 this.currentAlbumInfo ||
 window.AlbumView?.currentAlbumInfo;

 const albumTracks =
 Array.isArray(albumInfo?.tracks)
 ? albumInfo.tracks
 : (
 Array.isArray(window.AlbumView?.currentAlbumTracks)
 ? window.AlbumView.currentAlbumTracks
 : []
 );

 const trackIds =
 albumTracks
 .map(track => track?.id)
 .filter(Boolean);

 if (trackIds.length === 0) return;

 if (this.hdButtonEl) {
 this.hdButtonEl.disabled = true;
 this.hdButtonEl.classList.add('is-loading');
 }

 this._showControls();

 try {
 const result =
 await window.api.batch.downloadAlbumCover(
 trackIds
 );

 if (
 !result?.success ||
 !result.coverPath
 ) {
 if (window.Toast) {
 window.Toast.warn(
 window.i18n?.t('album_cover_not_found') ||
 'No suitable cover found'
 );
 }

 return;
 }

 if (Array.isArray(result.updatedLibrary)) {
 window.state.library =
 result.updatedLibrary;
 }

 if (window.AlbumView) {
 window.AlbumView.currentAlbumTracks =
 window.AlbumView.currentAlbumTracks.map(track => {
 const updatedTrack =
 window.state.library.find(
 item => item.id === track.id
 );

 return updatedTrack || {
 ...track,
 coverPath: result.coverPath
 };
 });

 if (window.AlbumView.currentAlbumInfo) {
 window.AlbumView.currentAlbumInfo.tracks =
 [...window.AlbumView.currentAlbumTracks];

 window.AlbumView.currentAlbumInfo.coverPath =
 result.coverPath;

 window.AlbumView.renderLeftMeta(
 window.AlbumView.currentAlbumInfo
 );

 if (
 typeof window.AlbumView._applyAlbumPalette ===
 'function'
 ) {
 await window.AlbumView._applyAlbumPalette(
 window.AlbumView.currentAlbumInfo
 );
 }
 }
 }

 if (
 this.currentAlbumInfo &&
 window.AlbumView?.currentAlbumInfo
 ) {
 this.currentAlbumInfo =
 window.AlbumView.currentAlbumInfo;
 }

 if (
 window.LibraryViews?.currentView ===
 'albums'
 ) {
 window.LibraryViews.renderGrid('albums');
 }

 this.currentCoverPath =
 result.coverPath;

 this.resetTransform();
 this._resetPalette();

 this.viewerEl.classList.add('is-loading');
 this.viewerEl.classList.remove('small-artwork');

 this._setArtworkSource(
 result.coverPath
 );

 await Promise.allSettled([
 this._loadArtworkMetadata(
 result.coverPath
 ),
 this._applyAmbientPalette(
 result.coverPath
 )
 ]);

 if (window.Toast) {
 window.Toast.success(
 window.i18n?.t('album_cover_found') ||
 'Album cover downloaded'
 );
 }
 } finally {
 if (this.hdButtonEl) {
 this.hdButtonEl.disabled = false;
 this.hdButtonEl.classList.remove('is-loading');
 }

 this._updateHdActionState();
 this._showControlsTemporarily();
 }
 }

 _updateHdActionState() {
 if (!this.hdButtonEl) return;

 this.hdButtonEl.classList.toggle(
 'recommended',
 this.isSmallArtwork
 );
 }

 _showControls() {
 if (!this.viewerEl) return;

 this.viewerEl.classList.remove(
 'controls-hidden'
 );
 }

 _showControlsTemporarily() {
 if (
 !this.isOpen ||
 !this.viewerEl
 ) {
 return;
 }

 this._showControls();
 this._clearControlsHideTimer();

 this.controlsHideTimer =
 setTimeout(() => {
 if (
 this.isOpen &&
 !this.isPanning &&
 this.viewerEl
 ) {
 this.viewerEl.classList.add(
 'controls-hidden'
 );
 }
 }, this.controlsHideDelay);
 }

 _clearControlsHideTimer() {
 if (this.controlsHideTimer) {
 clearTimeout(this.controlsHideTimer);
 this.controlsHideTimer = null;
 }
 }
}

window.AlbumCoverViewer =
 new AlbumCoverViewerManager();

document.addEventListener(
 'DOMContentLoaded',
 () => {
 window.AlbumCoverViewer.init();
 }
);