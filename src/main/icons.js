const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Кэш сгенерированных иконок
const iconCache = {};

/**
 * Получение главной иконки приложения (.ico / .png) с фолбэком на векторную генерацию
 * @returns {Electron.NativeImage}
 */
function getAppIcon() {
  // Проверяем возможные пути размещения иконки (включая корень проекта)
  const pathsToTry = [
    path.join(app.getAppPath(), 'icon.ico'),
    path.join(__dirname, '..', '..', 'icon.ico'),
    path.join(app.getAppPath(), 'src', 'main', 'assets', 'icon.ico'),
    path.join(app.getAppPath(), 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.ico')
  ];

  for (const icoPath of pathsToTry) {
    if (fs.existsSync(icoPath)) {
      const img = nativeImage.createFromPath(icoPath);
      img.setTemplateImage(false);
      return img;
    }
  }

  // Резервный фолбэк: векторная иконка логотипа Cosmic Player
  return createPixelIcon('appLogo');
}

/**
 * Генерация векторных RGBA-иконок 24x24 в буфере для системного трея и панели задач Windows
 * @param {'play' | 'pause' | 'prev' | 'next' | 'appLogo'} type - Тип создаваемой иконки
 * @returns {Electron.NativeImage}
 */
function createPixelIcon(type) {
  if (iconCache[type]) return iconCache[type];

  const size = 24;
  const buf = Buffer.alloc(size * size * 4); // 24x24 RGBA буфер

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let draw = false;
      let r = 255, g = 255, b = 255, a = 255;

      if (type === 'play') {
        // Воспроизведение (Острие смотрит строго вправо)
        if (x >= 7 && x <= 17) {
          const halfH = (17 - x) * 0.65;
          if (Math.abs(y - 11.5) <= halfH) draw = true;
        }
      } else if (type === 'pause') {
        // Пауза (Две вертикальные полосы)
        if ((x >= 6 && x <= 9) || (x >= 14 && x <= 17)) {
          if (y >= 5 && y <= 18) draw = true;
        }
      } else if (type === 'prev') {
        // Назад (Черта + Треугольник влево)
        if (x >= 4 && x <= 6 && y >= 5 && y <= 18) draw = true;
        if (x >= 8 && x <= 18) {
          const halfH = (x - 8) * 0.65;
          if (Math.abs(y - 11.5) <= halfH) draw = true;
        }
      } else if (type === 'next') {
        // Вперед (Треугольник вправо + Черта)
        if (x >= 17 && x <= 19 && y >= 5 && y <= 18) draw = true;
        if (x >= 5 && x <= 15) {
          const halfH = (15 - x) * 0.65;
          if (Math.abs(y - 11.5) <= halfH) draw = true;
        }
      } else if (type === 'appLogo') {
        // Резервный космический фиолетовый логотип
        const dx = x - 11.5;
        const dy = y - 11.5;
        if (dx * dx + dy * dy <= 80) {
          draw = true;
          r = 244; g = 114; b = 182; // Акцентный розовый #f472b6
        }
      }

      if (draw) {
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = a;
      } else {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0;
      }
    }
  }

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  img.setTemplateImage(false);
  iconCache[type] = img;
  return img;
}

module.exports = { getAppIcon, createPixelIcon };