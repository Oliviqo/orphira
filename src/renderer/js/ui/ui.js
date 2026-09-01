/**
 * COSMIC PLAYER - MAIN UI DIALOGS & STARS ANIMATION
 * Диалоги подтверждения/ввода и canvas анимация звездного неба
 */
function showConfirm(title, message, isDanger, callback) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  const btnOk = document.getElementById('btn-confirm-ok');
  btnOk.className = isDanger ? 'custom-btn danger-btn' : 'custom-btn';
  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    btnOk.removeEventListener('click', handleOk);
    document.getElementById('btn-confirm-cancel').removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeyDown);
  };

  const handleOk = () => { cleanup(); callback(true); };
  const handleCancel = () => { cleanup(); callback(false); };
  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleOk();
    if (e.key === 'Escape') handleCancel();
  };

  btnOk.addEventListener('click', handleOk);
  document.getElementById('btn-confirm-cancel').addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeyDown);
}

function showPrompt(title, defaultValue, callback) {
  const modal = document.getElementById('prompt-modal');
  const input = document.getElementById('prompt-input');
  if (!modal || !input) return;
  
  document.getElementById('prompt-title').textContent = title;
  const initialValue = defaultValue || '';
  input.value = initialValue;
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 50);

  const cleanup = () => {
    modal.classList.add('hidden');
    document.getElementById('btn-prompt-ok').removeEventListener('click', handleOk);
    document.getElementById('btn-prompt-cancel').removeEventListener('click', handleCancel);
    input.removeEventListener('keydown', handleInputKeyDown);
  };

  const handleOk = () => { cleanup(); callback(input.value); };

  const handleCancel = () => {
    const hasChanges = input.value !== initialValue;
    if (hasChanges) {
      showConfirm(
        'Несохранённые изменения',
        'Вы изменили текст. Закрыть окно без сохранения?',
        true,
        (confirmed) => {
          if (confirmed) {
            cleanup();
            callback(null);
          }
        }
      );
    } else {
      cleanup();
      callback(null);
    }
  };

  const handleInputKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleOk();
    if (e.key === 'Escape') handleCancel();
  };

  document.getElementById('btn-prompt-ok').addEventListener('click', handleOk);
  document.getElementById('btn-prompt-cancel').addEventListener('click', handleCancel);
  input.addEventListener('keydown', handleInputKeyDown);
}

function initStars() {
  const canvas = document.getElementById('stars-layer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let starsAnimId = null;
  let lastStarsDraw = 0;

  const updateCanvasDimensions = () => {
    if (canvas.width !== window.innerWidth) canvas.width = window.innerWidth;
    if (canvas.height !== window.innerHeight) canvas.height = window.innerHeight;
  };
  updateCanvasDimensions();
  window.addEventListener('resize', updateCanvasDimensions);

  function stopStars() {
    if (starsAnimId) {
      cancelAnimationFrame(starsAnimId);
      starsAnimId = null;
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function draw(now = performance.now()) {
    if (!window.state?.config?.starsEnabled) {
      stopStars();
      return;
    }
    if (starsAnimId) cancelAnimationFrame(starsAnimId);
    starsAnimId = requestAnimationFrame((timestamp) => draw(timestamp));
    if (now - lastStarsDraw < 33) return;
    lastStarsDraw = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy; s.alpha += s.dAlpha;
      if (s.alpha <= 0 || s.alpha >= 1) s.dAlpha = -s.dAlpha;
      if (s.x < -50) s.x = canvas.width + 50;
      if (s.x > canvas.width + 50) s.x = -50;
      if (s.y < -50) s.y = canvas.height + 50;
      if (s.y > canvas.height + 50) s.y = -50;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.1, s.r), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, s.alpha))})`;
      ctx.fill();
    });
  }

  window.createStars = function() {
    stopStars();
    updateCanvasDimensions();
    stars = [];
    const count = window.state?.config?.starsCount || 70;
    const speed = window.state?.config?.starsSpeed || 0.3;
    const margin = 50;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: -margin + Math.random() * (canvas.width + margin * 2),
        y: -margin + Math.random() * (canvas.height + margin * 2),
        r: Math.random() * 1.5 + 0.5,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        alpha: Math.random(),
        dAlpha: (Math.random() - 0.5) * 0.02
      });
    }
    if (window.state?.config?.starsEnabled) {
      draw();
    }
    if (window.FullscreenPlayer && typeof window.FullscreenPlayer.recreateStars === 'function') {
      window.FullscreenPlayer.recreateStars();
    }
  };

  window.createStars();
}