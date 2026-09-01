/**
 * COSMIC PLAYER - PHONETIC TRANSLITERATION & ADVANCED ACRONYM ENGINE
 * Модуль фонетической транслитерации и частичных акронимов (0ms overhead)
 */
(function () {
  const PHONETIC_RU_TO_EN = [
    [/щ/g, "shch"], [/ш/g, "sh"], [/ч/g, "ch"], [/ж/g, "zh"], [/ц/g, "ts"],
    [/ю/g, "yu"], [/я/g, "ya"], [/ё/g, "yo"], [/э/g, "e"], [/е/g, "e"],
    [/ый/g, "y"], [/ий/g, "y"], [/кс/g, "x"],
    [/а/g, "a"], [/б/g, "b"], [/в/g, "v"], [/г/g, "g"], [/д/g, "d"],
    [/з/g, "z"], [/и/g, "i"], [/й/g, "y"], [/к/g, "k"], [/л/g, "l"],
    [/м/g, "m"], [/н/g, "n"], [/о/g, "o"], [/п/g, "p"], [/р/g, "r"],
    [/с/g, "s"], [/т/g, "t"], [/у/g, "u"], [/ф/g, "f"], [/х/g, "kh"],
    [/ъ/g, ""], [/ы/g, "y"], [/ь/g, ""]
  ];

  const PHONETIC_EN_TO_RU = [
    [/shch/gi, "щ"], [/sh/gi, "ш"], [/ch/gi, "ч"], [/zh/gi, "ж"], [/ts/gi, "ц"],
    [/ph/gi, "ф"], [/th/gi, "т"], [/ck/gi, "к"], [/ee/gi, "и"], [/ea/gi, "и"],
    [/oo/gi, "у"], [/ow/gi, "ау"], [/ou/gi, "ау"], [/ay/gi, "эй"], [/ey/gi, "ей"],
    [/yu/gi, "ю"], [/ya/gi, "я"], [/yo/gi, "ё"], [/kh/gi, "х"],
    [/a/gi, "а"], [/b/gi, "б"], [/c/gi, "к"], [/d/gi, "д"], [/e/gi, "е"],
    [/f/gi, "ф"], [/g/gi, "г"], [/h/gi, "х"], [/i/gi, "и"], [/j/gi, "дж"],
    [/k/gi, "к"], [/l/gi, "л"], [/m/gi, "м"], [/n/gi, "н"], [/o/gi, "о"],
    [/p/gi, "п"], [/q/gi, "к"], [/r/gi, "р"], [/s/gi, "с"], [/t/gi, "т"],
    [/u/gi, "у"], [/v/gi, "в"], [/w/gi, "в"], [/x/gi, "кс"], [/y/gi, "й"], [/z/gi, "з"]
  ];

  window.phoneticTranslit = function (text) {
    if (!text) return "";
    let str = text.toLowerCase().trim();
    const hasCyrillic = /[а-яё]/i.test(str);
    if (hasCyrillic) {
      PHONETIC_RU_TO_EN.forEach(([reg, repl]) => { str = str.replace(reg, repl); });
    } else {
      PHONETIC_EN_TO_RU.forEach(([reg, repl]) => { str = str.replace(reg, repl); });
    }
    return str;
  };

  /**
   * Умный поиск по акронимам (подстрока и подпоследовательность)
   * Пример: "Red Hot Chili Peppers" -> акроним "rhcp"
   * Совпадения: "rh", "cp", "hcp", "rcp" -> true
   */
  window.matchAcronym = function (text, query) {
    if (!text || !query || query.length < 2) return false;
    const q = query.toLowerCase().trim();
    const clean = text.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, "").trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 1) return false;

    const acronym = words.map(w => w[0].toLowerCase()).join("");

    // 1. Подстрока акронима ("rh", "cp", "hcp" внутри "rhcp")
    if (acronym.includes(q)) return true;

    // 2. Подпоследовательность ("rcp" внутри "rhcp")
    let qIdx = 0;
    for (let i = 0; i < acronym.length && qIdx < q.length; i++) {
      if (acronym[i] === q[qIdx]) {
        qIdx++;
      }
    }
    return qIdx === q.length;
  };
})();