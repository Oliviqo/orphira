/**
 * COSMIC PLAYER - CANVAS VISUALIZER MANAGER
 * Оптимизированный анимированный аудио-визуализатор с авто-заморозкой CPU на паузе
 */
class VisualizerManager {
  constructor() {
    this.animFrameId = null;
    this.isRunning = false;
  }

 init() {
 const canvas =
 document.getElementById(
 'visualizer-canvas'
 );

 if (!canvas) return;

 this.canvas = canvas;
 this.ctx =
 canvas.getContext('2d');

 const syncVisualizerState = () => {
 requestAnimationFrame(() => {
 const engine =
 window.AudioEngine;

 if (!engine) {
 this.stop();
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
 this.start();
 return;
 }

 if (!engine.isPlaying) {
 this.stop();
 }
 });
 };

 const watchdogVisualizer = (e) => {
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
 !this.isRunning
 ) {
 this.start();
 }
 };

 if (window.AudioEngine) {
 const audioElements = [
 window.AudioEngine.playerA?.audio,
 window.AudioEngine.playerB?.audio
 ].filter(Boolean);

 audioElements.forEach(audioEl => {
 audioEl.addEventListener(
 'play',
 syncVisualizerState
 );

 audioEl.addEventListener(
 'playing',
 syncVisualizerState
 );

 audioEl.addEventListener(
 'pause',
 syncVisualizerState
 );

 audioEl.addEventListener(
 'ended',
 syncVisualizerState
 );

 audioEl.addEventListener(
 'timeupdate',
 watchdogVisualizer
 );
 });
 }

 syncVisualizerState();
 }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.draw();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

 draw(now = performance.now()) {
 if (!this.isRunning) return;

 const engine =
 window.AudioEngine;

 const activeAudio =
 engine?.audioElement;

 if (
 !engine ||
 !engine.isPlaying ||
 !activeAudio ||
 activeAudio.paused ||
 activeAudio.ended
 ) {
 this.stop();
 return;
 }

 this.animFrameId =
 requestAnimationFrame(
 timestamp =>
 this.draw(timestamp)
 );

 if (
 this._lastDrawTime &&
 now - this._lastDrawTime < 33
 ) {
 return;
 }

 this._lastDrawTime = now;

 const w =
 this.canvas.offsetWidth;

 const h =
 this.canvas.offsetHeight;

 if (
 this.canvas.width !== w
 ) {
 this.canvas.width = w;
 }

 if (
 this.canvas.height !== h
 ) {
 this.canvas.height = h;
 }

 const data =
 engine.getVisualizerData();

 if (
 !data ||
 data.length === 0
 ) {
 return;
 }

 const barWidth =
 (this.canvas.width / data.length) *
 2.5;

 let x = 0;

 this.ctx.clearRect(
 0,
 0,
 this.canvas.width,
 this.canvas.height
 );

 for (
 let i = 0;
 i < data.length;
 i++
 ) {
 const barHeight =
 (data[i] / 255) *
 this.canvas.height;

 this.ctx.fillStyle =
 `rgba(165, 195, 255, ${data[i] / 255})`;

 this.ctx.fillRect(
 x,
 this.canvas.height - barHeight,
 barWidth,
 barHeight
 );

 x += barWidth + 1;
 }
 }
}

window.Visualizer = new VisualizerManager();