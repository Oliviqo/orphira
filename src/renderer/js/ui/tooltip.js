/**
 * COSMIC PLAYER - TOOLTIP MANAGER
 * Всплывающие подсказки при наведении на элемент (CosmicTooltipManager)
 */

class CosmicTooltipManager {
  constructor() {
    this.tooltipEl = null;
    this.activeTarget = null;
    this.showTimer = null;
    this.delayMs = 700;
    this.init();
  }

  init() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'cosmic-tooltip';
    document.body.appendChild(this.tooltipEl);

    document.addEventListener('mouseover', (e) => this._handleMouseOver(e));
    document.addEventListener('mouseout', (e) => this._handleMouseOut(e));
  }

  _handleMouseOver(e) {
    // Проверка глобального отключения тултипов в настройках
    if (window.state?.config?.tooltipsEnabled === false) {
      this._clearTimer();
      this._hideTooltip();
      return;
    }

    // ЗАПРЕТ ВСПЛЫВАШЕК ДЛЯ КНОПОК УПРАВЛЕНИЯ ОКНОМ И ЗАКРЫТИЯ
    if (e.target.closest('.window-btn, .titlebar-controls, .fullscreen-close-btn, #btn-fullscreen-close')) {
      this._clearTimer();
      this._hideTooltip();
      return;
    }
    
    const target = e.target.closest('[data-tooltip], [data-i18n-tooltip], [title]');
    if (!target) return;

    if (target.hasAttribute('title')) {
      const nativeTitle = target.getAttribute('title');
      if (nativeTitle) target.setAttribute('data-tooltip', nativeTitle);
      target.removeAttribute('title');
    }

    if (this.activeTarget === target) return;
    this._clearTimer();
    this.activeTarget = target;

    const customDelay = parseInt(target.getAttribute('data-tooltip-delay'), 10);
    const delay = !isNaN(customDelay) ? customDelay : this.delayMs;

    this.showTimer = setTimeout(() => this._showTooltip(target), delay);
  }

  _handleMouseOut(e) {
    const related = e.relatedTarget;
    if (this.activeTarget && (!related || !this.activeTarget.contains(related))) {
      this._clearTimer();
      this._hideTooltip();
    }
  }

  _clearTimer() {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  _showTooltip(target) {
    if (!target || !document.body.contains(target)) return;
    let text = target.getAttribute('data-tooltip');
    const i18nKey = target.getAttribute('data-i18n-tooltip');

    if (i18nKey && window.i18n) text = window.i18n.t(i18nKey);
    if (!text) return;

    this.tooltipEl.textContent = text;
    this.tooltipEl.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.top - tooltipRect.height - 8;

    if (top < 10) top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }

  _hideTooltip() {
    this.activeTarget = null;
    if (this.tooltipEl) this.tooltipEl.classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.CosmicTooltip = new CosmicTooltipManager();
});