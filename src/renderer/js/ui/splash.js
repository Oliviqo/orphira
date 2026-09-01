/**
 * COSMIC PLAYER - SPLASH SCREEN MANAGER MODULE
 * Управление скрытием встроенной статичной заставки с задержкой в 1000мс
 */
(function () {
  const startTime = Date.now();

  window.hideSplash = function () {
    const minDuration = 700; // Минимальное время показа
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, minDuration - elapsed);

    setTimeout(() => {
      const el = document.getElementById('cosmicLoading');
      if (el) {
        el.classList.add('hide');
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 650);
      }
    }, remainingTime);
  };
})();