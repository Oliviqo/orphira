/**
 * COSMIC PLAYER - GLOBAL STATE & FONT CATALOG
 * Центральный объект состояния приложения и шрифтовое ядро
 */

window.state = {
  library: [],                  // Вся библиотека треков
  currentList: [],              // Список треков, отображаемый в текущей вкладке UI
  queue: [],                    // Очередь "Далее в воспроизведении"
  playlists: [],                // Список плейлистов пользователя
 appIdentity: null,
 appVersion: '',
  
  // Разделение источника звука и интерфейса (позволяет скроллить библиотеку без сброса очереди)
  playbackList: [],             // Список треков, из которого идет текущее воспроизведение
  playbackSource: 'library',    // Идентификатор источника ('library', 'queue' или ID плейлиста)
  playbackShuffledList: [],     // Зафиксированная перемешанная колода треков (Shuffle)
  playbackShuffledIndex: -1,    // Позиция в перемешанной колоде
  playbackIndex: -1,            // Позиция в обычном списке playbackList
  
  currentTrackId: null,         // MD5 ID текущего трека
  currentQueueId: null,         // Уникальный ID экземпляра трека в очереди
  currentIndex: -1,             // Индекс текущего трека в currentList
 config: {
 lastState: {}
 },
   rowHeight: 45,                // Высота строки виртуализированного списка (px)
  renderBuffer: 15,             // Буфер виртуализации (количество предзагружаемых строк)
  shuffle: false,               // Режим перемешивания
  repeat: 0,                    // Режим повтора: 0 - off, 1 - repeat all, 2 - repeat one
  activeNav: 'library',         // Активная вкладка навигации ('library', 'queue', или ID плейлиста)
  contextTrack: null,           // Трек, на котором открыто контекстное меню
  parsedLyrics: []              // Распарсенные караоке-строки с таймингами [.lrc]
};

/** Каталог доступных веб-шрифтов с автоматической подгрузкой с Google Fonts */
window.FONT_CATALOG = {
  outfit: { name: 'Outfit (Space)', family: "'Outfit', sans-serif", google: 'Outfit:wght@300;400;500;600;700' },
  jakarta: { name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700' },
  inter: { name: 'Inter (Neutral Pristine)', family: "'Inter', sans-serif", google: 'Inter:wght@300;400;500;600;700' },
  roboto: { name: 'Roboto (Neutral Classic)', family: "'Roboto', sans-serif", google: 'Roboto:wght@300;400;500;600;700' },
  space: { name: 'Space Grotesk (Cosmic)', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@400;500;600;700' },
  sora: { name: 'Sora (Futuristic)', family: "'Sora', sans-serif", google: 'Sora:wght@300;400;500;600;700' },
  urbanist: { name: 'Urbanist (Sleek)', family: "'Urbanist', sans-serif", google: 'Urbanist:wght@300;400;500;600;700' },
  poppins: { name: 'Poppins (Soft Round)', family: "'Poppins', sans-serif", google: 'Poppins:wght@300;400;500;600;700' },
  montserrat: { name: 'Montserrat (Bold)', family: "'Montserrat', sans-serif", google: 'Montserrat:wght@300;400;500;600;700' },
  manrope: { name: 'Manrope (Modern UI)', family: "'Manrope', sans-serif", google: 'Manrope:wght@300;400;500;600;700' },
  lexend: { name: 'Lexend (Readable)', family: "'Lexend', sans-serif", google: 'Lexend:wght@300;400;500;600;700' },
  syne: { name: 'Syne (Artistic)', family: "'Syne', sans-serif", google: 'Syne:wght@400;500;600;700' },
  system: { name: 'System Default', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', google: null }
};

/**
 * Динамическое применение выбранного шрифта к интерфейсу
 * @param {string} fontKey - Ключ шрифта из FONT_CATALOG
 */
window.applyFont = function(fontKey) {
  const font = window.FONT_CATALOG[fontKey] || window.FONT_CATALOG.outfit;
  
  if (font.google && !document.getElementById(`font-link-${fontKey}`)) {
    const link = document.createElement('link');
    link.id = `font-link-${fontKey}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
  }
  
  document.documentElement.style.setProperty('--font-primary', font.family);
  document.documentElement.setAttribute('data-font', fontKey);
};