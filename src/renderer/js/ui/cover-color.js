/**
 * COSMIC PLAYER - DYNAMIC COVER COLOR EXTRACTOR
 * Извлечение характерного цвета обложки и построение локальной
 * theme-aware палитры для Album View / Fullscreen UI.
 */
class CoverColorExtractor {
 constructor() {
  this.canvas = document.createElement('canvas');
  this.canvas.width = 48;
  this.canvas.height = 48;
  this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  this.cache = new Map();
 }

 _rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
   const d = max - min;
   s = l > 0.5
    ? d / (2 - max - min)
    : d / (max + min);

   switch (max) {
    case r:
     h = (g - b) / d + (g < b ? 6 : 0);
     break;
    case g:
     h = (b - r) / d + 2;
     break;
    case b:
     h = (r - g) / d + 4;
     break;
    default:
     h = 0;
   }

   h /= 6;
  }

  return [h * 360, s, l];
 }

 _hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  h /= 360;

  let r;
  let g;
  let b;

  if (s === 0) {
   r = g = b = l;
  } else {
   const hueToRgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
   };

   const q = l < 0.5
    ? l * (1 + s)
    : l + s - l * s;

   const p = 2 * l - q;

   r = hueToRgb(p, q, h + 1 / 3);
   g = hueToRgb(p, q, h);
   b = hueToRgb(p, q, h - 1 / 3);
  }

  return [
   Math.round(r * 255),
   Math.round(g * 255),
   Math.round(b * 255)
  ];
 }

 _relativeLuminance(r, g, b) {
  const transform = (channel) => {
   const value = channel / 255;
   return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return (
   0.2126 * transform(r) +
   0.7152 * transform(g) +
   0.0722 * transform(b)
  );
 }

 _contrastRatio(rgbA, rgbB) {
  const lumA = this._relativeLuminance(rgbA[0], rgbA[1], rgbA[2]);
  const lumB = this._relativeLuminance(rgbB[0], rgbB[1], rgbB[2]);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (lighter + 0.05) / (darker + 0.05);
 }

 _getThemeType() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  if (theme === 'light') return 'light';
  if (theme === 'warm' || theme === 'soft' || theme === 'warm-ivory') return 'warm';

  return 'dark';
 }

 _getThemeNeutral(themeType) {
  if (themeType === 'light') {
   return [246, 248, 251];
  }

  if (themeType === 'warm') {
   return [245, 242, 234];
  }

  return [19, 20, 25];
 }

 _mixRgb(source, target, amount) {
  const t = Math.max(0, Math.min(1, amount));

  return [
   Math.round(source[0] + (target[0] - source[0]) * t),
   Math.round(source[1] + (target[1] - source[1]) * t),
   Math.round(source[2] + (target[2] - source[2]) * t)
  ];
 }

 _chooseAccentText(accentRgb) {
  const white = [255, 255, 255];
  const dark = [12, 14, 18];

  const whiteContrast = this._contrastRatio(accentRgb, white);
  const darkContrast = this._contrastRatio(accentRgb, dark);

  return whiteContrast >= darkContrast ? '#ffffff' : '#0c0e12';
 }

 _buildAccent(dominantRgb, themeType) {
  const [h, rawS] = this._rgbToHsl(
   dominantRgb[0],
   dominantRgb[1],
   dominantRgb[2]
  );

  let saturation;
  let lightness;

  if (themeType === 'dark') {
   saturation = Math.max(0.34, Math.min(0.56, rawS * 0.72));
   lightness = 0.72;
  } else if (themeType === 'warm') {
   saturation = Math.max(0.30, Math.min(0.50, rawS * 0.66));
   lightness = 0.47;
  } else {
   saturation = Math.max(0.32, Math.min(0.52, rawS * 0.68));
   lightness = 0.48;
  }

  let accentRgb = this._hslToRgb(
   h,
   saturation,
   lightness
  );

  const themeNeutral = this._getThemeNeutral(themeType);
  let contrast = this._contrastRatio(
   accentRgb,
   themeNeutral
  );

  let attempts = 0;

  while (contrast < 2.35 && attempts < 14) {
   if (themeType === 'dark') {
    lightness = Math.min(
     0.84,
     lightness + 0.022
    );
   } else {
    lightness = Math.max(
     0.27,
     lightness - 0.022
    );
   }

   accentRgb = this._hslToRgb(
    h,
    saturation,
    lightness
   );

   contrast = this._contrastRatio(
    accentRgb,
    themeNeutral
   );

   attempts++;
  }

  return accentRgb;
 }

 _buildPanel(dominantRgb, themeType) {
  const [h, rawS] = this._rgbToHsl(
   dominantRgb[0],
   dominantRgb[1],
   dominantRgb[2]
  );

  let saturation;
  let lightness;
  let panelRgb;

  if (themeType === 'dark') {
   saturation = Math.max(
    0.075,
    Math.min(0.18, rawS * 0.22)
   );
   lightness = 0.115;

   panelRgb = this._hslToRgb(
    h,
    saturation,
    lightness
   );

   return this._mixRgb(
    panelRgb,
    [19, 20, 25],
    0.18
   );
  }

  if (themeType === 'warm') {
   saturation = Math.max(
    0.055,
    Math.min(0.14, rawS * 0.18)
   );
   lightness = 0.915;

   panelRgb = this._hslToRgb(
    h,
    saturation,
    lightness
   );

   return this._mixRgb(
    panelRgb,
    [245, 242, 234],
    0.28
   );
  }

  saturation = Math.max(
   0.06,
   Math.min(0.15, rawS * 0.19)
  );
  lightness = 0.925;

  panelRgb = this._hslToRgb(
   h,
   saturation,
   lightness
  );

  return this._mixRgb(
   panelRgb,
   [246, 248, 251],
   0.22
  );
 }

 _selectDominantColor(imageData) {
  const buckets = new Map();
  let mostSaturated = null;
  let mostSaturatedScore = -Infinity;

  for (let i = 0; i < imageData.length; i += 4) {
   const alpha = imageData[i + 3];
   if (alpha < 180) continue;

   const r = imageData[i];
   const g = imageData[i + 1];
   const b = imageData[i + 2];

   const [h, s, l] = this._rgbToHsl(r, g, b);

   if (l < 0.035 || l > 0.965) continue;

   const quantR = Math.round(r / 24) * 24;
   const quantG = Math.round(g / 24) * 24;
   const quantB = Math.round(b / 24) * 24;
   const key = `${quantR},${quantG},${quantB}`;

   const colorWeight =
    1 +
    s * 2.8 +
    (1 - Math.abs(l - 0.5) * 1.4);

   const existing = buckets.get(key) || {
    score: 0,
    count: 0,
    r: 0,
    g: 0,
    b: 0,
    saturation: 0
   };

   existing.score += colorWeight;
   existing.count += 1;
   existing.r += r;
   existing.g += g;
   existing.b += b;
   existing.saturation += s;

   buckets.set(key, existing);

   if (s >= 0.22 && l >= 0.09 && l <= 0.90) {
    const saturationScore =
     s * 3.2 +
     (1 - Math.abs(l - 0.52) * 1.5);

    if (saturationScore > mostSaturatedScore) {
     mostSaturatedScore = saturationScore;
     mostSaturated = [r, g, b];
    }
   }
  }

  let bestBucket = null;
  let bestScore = -Infinity;

  for (const bucket of buckets.values()) {
   const averageSaturation = bucket.saturation / Math.max(1, bucket.count);
   const score =
    bucket.score *
    Math.log2(bucket.count + 2) *
    (0.65 + averageSaturation * 1.35);

   if (score > bestScore) {
    bestScore = score;
    bestBucket = bucket;
   }
  }

  if (bestBucket) {
   const dominant = [
    Math.round(bestBucket.r / bestBucket.count),
    Math.round(bestBucket.g / bestBucket.count),
    Math.round(bestBucket.b / bestBucket.count)
   ];

   const dominantHsl = this._rgbToHsl(
    dominant[0],
    dominant[1],
    dominant[2]
   );

   if (dominantHsl[1] >= 0.12 || !mostSaturated) {
    return dominant;
   }
  }

  if (mostSaturated) {
   return mostSaturated;
  }

  return [129, 140, 248];
 }

  _buildAmbientColor(dominantRgb, themeType) {
 const [h, rawS, rawL] = this._rgbToHsl(
 dominantRgb[0],
 dominantRgb[1],
 dominantRgb[2]
 );

 let saturation = rawS;
 let lightness = rawL;

 if (themeType === 'dark') {
 saturation = Math.max(0.42, Math.min(0.72, rawS * 1.12));
 lightness = Math.max(0.48, Math.min(0.68, rawL * 1.35));
 } else if (themeType === 'warm') {
 saturation = Math.max(0.32, Math.min(0.58, rawS * 0.95));
 lightness = Math.max(0.42, Math.min(0.60, rawL));
 } else {
 saturation = Math.max(0.34, Math.min(0.60, rawS));
 lightness = Math.max(0.44, Math.min(0.62, rawL));
 }

 return this._hslToRgb(
 h,
 saturation,
 lightness
 );
 }

 _buildPalette(dominantRgb) {
 const themeType = this._getThemeType();
 const panelRgb = this._buildPanel(dominantRgb, themeType);
 const accentRgb = this._buildAccent(dominantRgb, themeType);
 const ambientRgb = this._buildAmbientColor(dominantRgb, themeType);
 const accentText = this._chooseAccentText(accentRgb);

 return {
 dominant: `rgb(${dominantRgb[0]}, ${dominantRgb[1]}, ${dominantRgb[2]})`,
 dominantRgb: `${dominantRgb[0]}, ${dominantRgb[1]}, ${dominantRgb[2]}`,
 rgb: `${dominantRgb[0]}, ${dominantRgb[1]}, ${dominantRgb[2]}`,
 panel: `rgb(${panelRgb[0]}, ${panelRgb[1]}, ${panelRgb[2]})`,
 panelRgb: `${panelRgb[0]}, ${panelRgb[1]}, ${panelRgb[2]}`,
 panelBg: `rgba(${panelRgb[0]}, ${panelRgb[1]}, ${panelRgb[2]}, 0.84)`,
 accent: `rgb(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]})`,
 accentRgb: `${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}`,
 accentText,
 ambientRgb: `${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}`,
 ambient: `rgba(${ambientRgb[0]}, ${ambientRgb[1]}, ${ambientRgb[2]}, 0.34)`
 };
 }

 async extractPalette(imageSrc) {
  if (!imageSrc) return null;

  const themeType = this._getThemeType();
  const cacheKey = `${themeType}|||${imageSrc}`;

  if (this.cache.has(cacheKey)) {
   return this.cache.get(cacheKey);
  }

  try {
   const img = new Image();
   img.crossOrigin = 'Anonymous';
   img.src = imageSrc;

   await new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
     resolve();
     return;
    }

    img.onload = resolve;
    img.onerror = reject;
   });

   this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
   this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

   const imageData = this.ctx.getImageData(
    0,
    0,
    this.canvas.width,
    this.canvas.height
   ).data;

   const dominantRgb = this._selectDominantColor(imageData);
   const palette = this._buildPalette(dominantRgb);

   this.cache.set(cacheKey, palette);

   return palette;
  } catch (e) {
   return null;
  }
 }

 async extractAndApply(imageSrc, targetElement) {
  if (!targetElement) return;

  const palette = await this.extractPalette(imageSrc);

  if (!palette) {
   this._resetColor(targetElement);
   return;
  }

  targetElement.style.setProperty('--fs-cover-color-rgb', palette.dominantRgb);
  targetElement.classList.add('has-custom-cover-color');
 }

 _resetColor(el) {
  if (!el) return;

  el.style.removeProperty('--fs-cover-color-rgb');
  el.classList.remove('has-custom-cover-color');
 }

 clearCache() {
  this.cache.clear();
 }
}

window.CoverColor = new CoverColorExtractor();