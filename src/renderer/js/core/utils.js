/**
 * COSMIC PLAYER - UTILITIES & HELPERS
 * Вспомогательные функции общего назначения
 */

/**
 * Форматирование секунд в часовой/минутный формат MM:SS
 * @param {number} seconds - Время в секундах
 * @returns {string} Строка вида "3:45"
 */
window.formatTime = (seconds) => {
  if (window.Timeline) return window.Timeline.formatTime(seconds);
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s}`;
  }
  return `${m}:${s}`;
};

/**
 * Защита от XSS путем экранирования HTML-тегов
 * @param {string} str - Необработанная строка
 * @returns {string} Экранированная строка
 */
window.escapeHTML = (str) => {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Парсер файлов плейлистов .m3u / .m3u8
 * @param {string} content - Содержимое файла плейлиста
 * @returns {Array<string>} Массив путей к аудиотрекам
 */
window.parseM3U = (content, baseFilePath = '') => {
    if (!content) return [];
    const lines = content.split(/\r?\n/);
    const paths = [];
    let baseDir = '';
    if (baseFilePath) {
        const normalizedBase = baseFilePath.replace(/\\/g, '/');
        const lastSlash = normalizedBase.lastIndexOf('/');
        if (lastSlash !== -1) {
            baseDir = normalizedBase.substring(0, lastSlash);
        }
    }
    for (let line of lines) {
        let cleanLine = line.trim();
        if (cleanLine && !cleanLine.startsWith('#')) {
            cleanLine = cleanLine.replace(/\\/g, '/');
            const isAbsolute = /^(?:[a-zA-Z]:\/|\/)/.test(cleanLine);
            if (!isAbsolute && baseDir) {
                if (cleanLine.startsWith('./')) {
                    cleanLine = cleanLine.substring(2);
                }
                cleanLine = `${baseDir}/${cleanLine}`;
            }
            paths.push(cleanLine);
        }
    }
    return paths;
};

/**
 * Алгоритм случайного перемешивания Фишера-Йейтса (Fisher-Yates Shuffle)
 * @param {Array} array - Исходный массив
 * @returns {Array} Новый перемешанный массив
 */
window.fisherYatesShuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Быстрое вычисление расстояния Левенштейна (количества опечаток) между двумя словами
 */
function fastLevenshtein(a, b) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const row = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) row[j] = j;

  for (let i = 1; i <= aLen; i++) {
    let prev = i;
    for (let j = 1; j <= bLen; j++) {
      const val = (a[i - 1] === b[j - 1]) ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[bLen] = prev;
  }
  return row[bLen];
}

/**
 * Ультра-умный Fuzzy Search сопоставитель:
 * - Прощает опечатки (donw -> down, slovly -> slowly) через Левенштейна
 * - Работает при любом порядке слов (let slowly down me)
 * - Прощает лишние/неточные слова (let dont slowly)
 * @param {any} text - Текст для проверки (название, артист, альбом, путь)
 * @param {string} query - Поисковый запрос
 * @returns {{ match: boolean, score: number }}
 */
window.fuzzyMatch = (text, query) => {
  if (!query || !query.trim()) return { match: true, score: 100 };
  if (text === null || text === undefined) return { match: false, score: 0 };
  const target = String(text).toLowerCase().trim();
  const q = String(query).toLowerCase().trim();

  // 1. Абсолютное точное совпадение
  if (target === q) return { match: true, score: 1000 };

  // 2. Полное вхождение фразы целиком
  const exactIdx = target.indexOf(q);
  if (exactIdx !== -1) {
    return { match: true, score: 600 - exactIdx };
  }

  // 3. Токенизация слов (разбивка по пробелам и знакам препинания)
  const targetTokens = target.split(/[\s._\-\/\\,()\[\]{}]+/).filter(Boolean);
  const queryTokens = q.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return { match: true, score: 100 };

  let totalMatchScore = 0;
  let matchedTokensCount = 0;

  for (const qToken of queryTokens) {
    let bestTokenScore = 0;
    for (const tToken of targetTokens) {
      // Точное совпадение отдельного слова
      if (tToken === qToken) {
        bestTokenScore = Math.max(bestTokenScore, 100);
        break;
      }
      // Префиксное совпадение слова (например "slow" найдет "slowly")
      if (tToken.startsWith(qToken) || qToken.startsWith(tToken)) {
        const ratio = Math.min(qToken.length, tToken.length) / Math.max(qToken.length, tToken.length);
        bestTokenScore = Math.max(bestTokenScore, 85 * ratio);
        continue;
      }
      // Нечеткое сопоставление (Левенштейн) только для слов от 4 символов
      if (qToken.length >= 4 && tToken.length >= 4) {
        const maxLen = Math.max(qToken.length, tToken.length);
        const dist = fastLevenshtein(qToken, tToken);
        const maxAllowedEdits = maxLen <= 4 ? 1 : (maxLen <= 7 ? 2 : 3);
        if (dist <= maxAllowedEdits) {
          const sim = 1.0 - (dist / maxLen);
          bestTokenScore = Math.max(bestTokenScore, 75 * sim);
        }
      }
    }
    if (bestTokenScore > 35) {
      matchedTokensCount++;
      totalMatchScore += bestTokenScore;
    }
  }

  const tokenMatchRatio = matchedTokensCount / queryTokens.length;
  if (tokenMatchRatio >= 0.5 || (queryTokens.length === 1 && matchedTokensCount === 1)) {
    const finalScore = (totalMatchScore / queryTokens.length) * tokenMatchRatio;
    if (finalScore >= 18) {
      return { match: true, score: Math.round(finalScore) };
    }
  }
  return { match: false, score: 0 };
};

/**
 * Двусторонняя таблица символов раскладки QWERTY <-> ЙЦУКЕН
 */
const LAYOUT_MAP_EN_TO_RU = {
  'q':'й','w':'ц','e':'у','r':'к','t':'е','y':'н','u':'г','i':'ш','o':'щ','p':'з','[':'х',']':'ъ',
  'a':'ф','s':'ы','d':'в','f':'а','g':'п','h':'р','j':'о','k':'л','l':'д',';':'ж','\'':'э',
  'z':'я','x':'ч','c':'с','v':'м','b':'и','n':'т','m':'ь',',':'б','.':'ю','/':'.'
};

const LAYOUT_MAP_RU_TO_EN = {};
for (const [en, ru] of Object.entries(LAYOUT_MAP_EN_TO_RU)) {
  LAYOUT_MAP_RU_TO_EN[ru] = en;
}

/**
 * Пословный умный конвертер раскладки (поддерживает смешанный ввод "let me дуе")
 * @param {string} text - Исходный текст
 * @returns {string} - Конвертированный текст
 */
window.convertKeyboardLayout = (text) => {
  if (!text) return '';
  const words = text.split(/(\s+)/);

  return words.map(word => {
    if (!word.trim()) return word;

    const hasCyrillic = /[а-яё]/i.test(word);
    const hasLatin = /[a-z]/i.test(word);

    let converted = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      if (hasCyrillic && LAYOUT_MAP_RU_TO_EN[char]) {
        converted += LAYOUT_MAP_RU_TO_EN[char];
      } else if (hasLatin && LAYOUT_MAP_EN_TO_RU[char]) {
        converted += LAYOUT_MAP_EN_TO_RU[char];
      } else {
        converted += word[i];
      }
    }
    return converted;
  }).join('');
};

/** Глобальный объект настроек сортировки колонок таблицы */
window.sortConfig = { field: null, asc: true };