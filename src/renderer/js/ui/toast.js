/**
 * COSMIC PLAYER - TOAST NOTIFICATION MANAGER
 * Система всплывающих уведомлений (CosmicToastManager)
 */

class CosmicToastManager {
  constructor() {
    this.container = null;
    this.maxToasts = 1; // Максимальное количество одновременно видимых уведомлений
    this._injectStyles();
    this._createContainer();
  }

  _injectStyles() {
    if (document.getElementById('cosmic-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'cosmic-toast-styles';
    style.innerHTML = `
      .cosmic-toast-container {
        position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%);
        z-index: 100000; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
      }
      .cosmic-toast {
        pointer-events: auto; display: flex; align-items: center; gap: 12px;
        padding: 10px 16px; min-width: 240px; max-width: 420px;
        background: rgba(20, 10, 38, 0.45); backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4); color: #ffffff; font-size: 12px; font-weight: 500;
        animation: toastSpringUp 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .cosmic-toast.leaving {
        animation: toastFlyUpFade 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
      }
      .cosmic-toast.info { border-left: 3px solid #a5c3ff; }
      .cosmic-toast.success { border-left: 3px solid #2ed573; }
      .cosmic-toast.warning { border-left: 3px solid #ffa502; }
      .cosmic-toast.error { border-left: 3px solid #ff4757; }
      @keyframes toastSpringUp {
        0% { opacity: 0; transform: translateY(40px) scale(0.85); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes toastFlyUpFade {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-30px) scale(0.92); }
      }
    `;
    document.head.appendChild(style);
  }

  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'cosmic-toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 3000) {
    if (!this.container) return;
    const activeToasts = Array.from(this.container.children).filter(t => !t.classList.contains('leaving'));
    if (activeToasts.length >= this.maxToasts) this.dismiss(activeToasts[0]);

    const toast = document.createElement('div');
    toast.className = `cosmic-toast ${type}`;
    toast.innerHTML = `<div class="cosmic-toast-message">${message}</div>`;
    this.container.appendChild(toast);

    if (duration > 0) setTimeout(() => this.dismiss(toast), duration);
  }

  dismiss(toast) {
    if (!toast || toast.classList.contains('leaving')) return;
    toast.classList.add('leaving');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  }

  info(msg, dur) { this.show(msg, 'info', dur); }
  success(msg, dur) { this.show(msg, 'success', dur); }
  warn(msg, dur) { this.show(msg, 'warning', dur); }
  error(msg, dur) { this.show(msg, 'error', dur); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.Toast = new CosmicToastManager();
});