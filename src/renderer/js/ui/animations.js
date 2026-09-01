/**
 * COSMIC PLAYER - STANDALONE ANIMATIONS ENGINE
 * Тактильный эффект волнового клика (Ripple Effect) и глобальный сброс фокуса с кнопок
 */
(function () {
  // 1. ЭФФЕКТ ВОЛНЫ (RIPPLE EFFECT) ПРИ НАЖАТИИ
  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.custom-btn, .speed-chip, .window-btn, .cover-expand-btn');
    if (!btn || btn.closest('.control-btn')) return;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement('span');
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.style.position = 'absolute';
    circle.style.borderRadius = '50%';
    circle.style.background = 'rgba(255, 255, 255, 0.35)';
    circle.style.transform = 'scale(0)';
    circle.style.animation = 'cosmicRipple 0.5s ease-out';
    circle.style.pointerEvents = 'none';

    const prevOverflow = btn.style.overflow;
    btn.style.overflow = 'hidden';
    if (getComputedStyle(btn).position === 'static') {
      btn.style.position = 'relative';
    }
    btn.appendChild(circle);
    setTimeout(() => {
      circle.remove();
      btn.style.overflow = prevOverflow;
    }, 500);
  });

  // 2. АВТОМАТИЧЕСКИЙ СБРОС ФОКУСА ПОСЛЕ КЛИКА МЫШЬЮ (Убирает рамки и застревание клавиши Пробел)
  document.addEventListener('mouseup', (e) => {
    const interactive = e.target.closest('button, input[type="button"], input[type="submit"], [role="button"]');
    if (interactive && typeof interactive.blur === 'function') {
      interactive.blur();
    }
  });

  const style = document.createElement('style');
  style.textContent = `@keyframes cosmicRipple { to { transform: scale(2.5); opacity: 0; } }`;
  document.head.appendChild(style);
})();