/**
 * COSMIC PLAYER - KEPLER SPLASH ORBIT ENGINE
 *
 * Физически корректная эллиптическая орбита декоративной планеты
 * вокруг фокуса в центре буквы O.
 *
 * Используется уравнение Кеплера:
 * M = E - e * sin(E)
 *
 * M — средняя аномалия, равномерно растущая со временем.
 * E — эксцентрическая аномалия.
 * e — эксцентриситет орбиты.
 *
 * Анимация переведена на предварительную генерацию CSS @keyframes,
 * чтобы работать 100% плавно на уровне GPU (Compositor Thread)
 * даже при жесткой блокировке основного потока во время загрузки.
 */
(function () {
  const ORBIT_CONFIG = {
    // Большая полуось эллипса в CSS-пикселях.
    semiMajorAxis: 24,

    // Эксцентриситет: 0 = круг, ближе к 1 = сильнее вытянутый эллипс.
    // Одновременно определяет реальную разницу скоростей в перицентре и апоцентре.
    eccentricity: 0.8,

    // Поворот большой оси в градусах.
    // 0° = вправо, -90° = вверх.
    // 111° сохраняет прежнюю диагональную ось, но инвертирует перицентр и апоцентр.
    rotationDeg: 95,

    // Полный физический орбитальный период в секундах.
    periodSeconds: 1.6,

    // Дополнительное дизайнерское смещение всей орбиты вдоль большой оси.
    // После инверсии отрицательное значение отодвигает перицентр от центра буквы O.
    axialOffset: 13,

    // Дополнительное дизайнерское смещение поперек большой оси.
    // Используется только для визуальной центровки относительно формы глифа O.
    normalOffset: 4,

    // Начальное положение планеты в градусах средней аномалии.
    // Не меняет форму орбиты и физический закон изменения скорости.
    startMeanAnomalyDeg: 0,

    // Максимальное количество итераций метода Ньютона для решения уравнения Кеплера.
    // 7 итераций дают большой запас точности даже при высокой эксцентриситетности.
    solverIterations: 7,

    // Допуск остановки численного решения уравнения Кеплера.
    solverTolerance: 0.000001
  };

  class SplashOrbitEngine {
    constructor(config) {
      this.config = config;
      this.planetEl = null;
      this.isRunning = false;
    }

    init() {
      this.planetEl = document.querySelector('.letter-o .orbit-dot');
      if (!this.planetEl) {
        return;
      }
      this.start();
    }

    start() {
      if (this.isRunning || !this.planetEl) {
        return;
      }
      this.isRunning = true;

      // 1. Создаем или находим тег style для нашей анимации
      let styleEl = document.getElementById('splash-orbit-keyframes');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'splash-orbit-keyframes';
        document.head.appendChild(styleEl);
      }

      // 2. Генерируем 100 шагов CSS анимации на основе физики Кеплера
      styleEl.textContent = this._generateKeyframes();

      // 3. Запускаем аппаратную анимацию
      const period = Math.max(0.2, Number(this.config.periodSeconds) || 3.2);
      // Важно: используем linear, так как физика скорости уже заложена в координатах ключевых кадров!
      this.planetEl.style.animation = `cosmicKeplerOrbit ${period}s linear infinite`;
    }

    stop() {
      this.isRunning = false;
      if (this.planetEl) {
        this.planetEl.style.animation = 'none';
      }
    }

    _generateKeyframes() {
      const steps = 100;
      let keyframes = `@keyframes cosmicKeplerOrbit {\n`;
      const startMeanAnomaly = this._degreesToRadians(this.config.startMeanAnomalyDeg);

      // Генерируем позиции для каждого процента анимации
      for (let i = 0; i <= steps; i++) {
        const percent = (i / steps) * 100;
        
        // Линейный ход времени (Средняя Аномалия)
        const meanAnomaly = startMeanAnomaly + (i / steps) * Math.PI * 2;
        
        // Вычисление позиции
        const orbitalPosition = this._calculateOrbitalPosition(meanAnomaly);
        const finalPosition = this._applyRotationAndOffsets(orbitalPosition);
        
        // Запись кадра (GPU-ускоренный translate3d)
        keyframes += `  ${percent.toFixed(2)}% { transform: translate3d(${finalPosition.x.toFixed(3)}px, ${finalPosition.y.toFixed(3)}px, 0); }\n`;
      }
      
      keyframes += `}\n`;
      return keyframes;
    }

    _normalizeAngle(angle) {
      const fullTurn = Math.PI * 2;
      return ((angle % fullTurn) + fullTurn) % fullTurn;
    }

    _degreesToRadians(degrees) {
      return (Number(degrees || 0) * Math.PI) / 180;
    }

    _solveEccentricAnomaly(meanAnomaly, eccentricity) {
      const e = Math.max(0, Math.min(0.95, Number(eccentricity) || 0));
      const M = this._normalizeAngle(meanAnomaly);
      
      let E = e < 0.8 ? M : Math.PI;
      const iterations = Math.max(1, Math.floor(Number(this.config.solverIterations) || 5));
      const tolerance = Math.max(1e-10, Number(this.config.solverTolerance) || 0.000001);

      for (let i = 0; i < iterations; i++) {
        const f = E - e * Math.sin(E) - M;
        const derivative = 1 - e * Math.cos(E);
        
        if (Math.abs(derivative) < 1e-10) {
          break;
        }
        
        const delta = f / derivative;
        E -= delta;
        
        if (Math.abs(delta) <= tolerance) {
          break;
        }
      }
      return E;
    }

    _calculateOrbitalPosition(meanAnomaly) {
      const a = Math.max(1, Number(this.config.semiMajorAxis) || 22);
      const e = Math.max(0, Math.min(0.95, Number(this.config.eccentricity) || 0));
      const b = a * Math.sqrt(1 - e * e);
      const E = this._solveEccentricAnomaly(meanAnomaly, e);

      const orbitalX = a * (Math.cos(E) - e);
      const orbitalY = b * Math.sin(E);

      return {
        x: orbitalX,
        y: orbitalY
      };
    }

    _applyRotationAndOffsets(orbitalPosition) {
      const rotation = this._degreesToRadians(this.config.rotationDeg);
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);
      const axialOffset = Number(this.config.axialOffset) || 0;
      const normalOffset = Number(this.config.normalOffset) || 0;

      const axisX = cosRotation;
      const axisY = sinRotation;
      const normalX = -sinRotation;
      const normalY = cosRotation;

      const rotatedX = orbitalPosition.x * cosRotation - orbitalPosition.y * sinRotation;
      const rotatedY = orbitalPosition.x * sinRotation + orbitalPosition.y * cosRotation;

      return {
        x: rotatedX + axisX * axialOffset + normalX * normalOffset,
        y: rotatedY + axisY * axialOffset + normalY * normalOffset
      };
    }
  }

  window.SplashOrbit = new SplashOrbitEngine(ORBIT_CONFIG);
  
  document.addEventListener('DOMContentLoaded', () => {
    window.SplashOrbit.init();
  });
})();