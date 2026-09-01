/**
 * COSMIC PLAYER - DYNAMIC SPLASH PROGRESS MANAGER
 *
 * Реальный progress-controller запуска приложения.
 *
 * Принципы:
 * - targetProgress изменяется только после реального завершения этапа;
 * - displayedProgress плавно догоняет targetProgress через requestAnimationFrame;
 * - отображаемый прогресс никогда не опережает фактическую контрольную точку;
 * - после удаления Splash RAF автоматически прекращается;
 * - подпись этапа использует общую систему локализации приложения.
 */
class SplashProgressManager {
 constructor() {
 this.rootEl = null;
 this.fillEl = null;
 this.textEl = null;

 this.targetProgress = 0;
 this.displayedProgress = 0;

 this.currentStageKey = 'splash_starting';

 this.animationFrameId = null;
 this.lastTimestamp = null;

 this.completionResolvers = [];
 this.isInitialized = false;

 // Скорость визуального догоняния реального значения.
 // Больше значение = быстрее полоса приходит к фактическому проценту.
 this.followSpeed = 7.5;

 this._frame = this._frame.bind(this);
 }

 init() {
 if (this.isInitialized) return true;

 this.rootEl =
 document.getElementById('cosmicLoading');

 this.fillEl =
 this.rootEl?.querySelector('.progress-fill') || null;

 this.textEl =
 this.rootEl?.querySelector('.loading-text') || null;

 if (
 !this.rootEl ||
 !this.fillEl ||
 !this.textEl
 ) {
 return false;
 }

 this.isInitialized = true;

 this._renderProgress();
 this._renderStage();

 this._ensureAnimation();

 return true;
 }

 setStage(stageKey, progress) {
 if (!this.init()) return;

 if (
 stageKey &&
 typeof stageKey === 'string'
 ) {
 this.currentStageKey = stageKey;
 this._renderStage();
 }

 const numericProgress =
 Number(progress);

 if (Number.isFinite(numericProgress)) {
 this.targetProgress =
 Math.max(
 this.targetProgress,
 Math.min(
 100,
 Math.max(0, numericProgress)
 )
 );
 }

 this._ensureAnimation();
 }

 refreshLanguage() {
 if (!this.init()) return;

 this._renderStage();
 }

 complete() {
 this.setStage(
 'splash_ready',
 100
 );
 }

 waitUntilComplete() {
 if (
 this.displayedProgress >= 99.9
 ) {
 return Promise.resolve();
 }

 return new Promise(resolve => {
 this.completionResolvers.push(resolve);
 this._ensureAnimation();
 });
 }

 _translateStage() {
 const translated =
 window.i18n?.t?.(this.currentStageKey);

 if (
 translated &&
 translated !== this.currentStageKey
 ) {
 return translated;
 }

 const fallbacks = {
 splash_starting: 'Starting Orphira',
 splash_config: 'Restoring settings',
 splash_library: 'Loading music library',
 splash_playlists: 'Loading playlists',
 splash_interface: 'Preparing interface',
 splash_audio: 'Preparing audio engine',
 splash_session: 'Restoring playback session',
 splash_ready: 'Ready'
 };

 return (
 fallbacks[this.currentStageKey] ||
 fallbacks.splash_starting
 );
 }

 _renderStage() {
 if (!this.textEl) return;

 const label =
 this._translateStage();

 const percent =
 Math.round(
 this.displayedProgress
 );

 this.textEl.textContent =
 `${label} · ${percent}%`;
 }

 _renderProgress() {
 if (!this.fillEl) return;

 const ratio =
 Math.max(
 0,
 Math.min(
 1,
 this.displayedProgress / 100
 )
 );

 this.fillEl.style.transform =
 `scaleX(${ratio.toFixed(5)})`;
 }

 _ensureAnimation() {
 if (
 this.animationFrameId ||
 !this.rootEl?.isConnected
 ) {
 return;
 }

 this.lastTimestamp = null;

 this.animationFrameId =
 requestAnimationFrame(
 this._frame
 );
 }

 _frame(timestamp) {
 this.animationFrameId = null;

 if (
 !this.rootEl ||
 !this.rootEl.isConnected
 ) {
 this._resolveCompletion();
 return;
 }

 if (this.lastTimestamp === null) {
 this.lastTimestamp = timestamp;
 }

 const deltaSeconds =
 Math.min(
 0.1,
 Math.max(
 0,
 (timestamp - this.lastTimestamp) / 1000
 )
 );

 this.lastTimestamp = timestamp;

 const distance =
 this.targetProgress -
 this.displayedProgress;

 if (Math.abs(distance) > 0.01) {
 const followFactor =
 1 -
 Math.exp(
 -this.followSpeed * deltaSeconds
 );

 this.displayedProgress +=
 distance * followFactor;

 if (
 this.targetProgress >= 100 &&
 100 - this.displayedProgress < 0.15
 ) {
 this.displayedProgress = 100;
 }
 }

 if (
 this.displayedProgress >
 this.targetProgress
 ) {
 this.displayedProgress =
 this.targetProgress;
 }

 this._renderProgress();
 this._renderStage();

 if (
 this.targetProgress >= 100 &&
 this.displayedProgress >= 99.9
 ) {
 this.displayedProgress = 100;

 this._renderProgress();
 this._renderStage();
 this._resolveCompletion();

 return;
 }

 if (
 Math.abs(
 this.targetProgress -
 this.displayedProgress
 ) > 0.01
 ) {
 this.animationFrameId =
 requestAnimationFrame(
 this._frame
 );
 }
 }

 _resolveCompletion() {
 if (
 this.completionResolvers.length === 0
 ) {
 return;
 }

 const resolvers =
 [...this.completionResolvers];

 this.completionResolvers = [];

 resolvers.forEach(resolve => {
 try {
 resolve();
 } catch (e) {}
 });
 }
}

window.SplashProgress =
 new SplashProgressManager();