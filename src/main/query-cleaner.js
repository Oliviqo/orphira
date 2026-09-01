const path = require('path');

/**
 * COSMIC PLAYER - QUERY CLEANER & NORMALIZER
 * Универсальный математический очиститель метаданных с предотвращением дублирования артистов
 */
const UNIVERSAL_DOMAIN_REGEX = /\b[a-zA-Z0-9-]+\.(?:com|ru|net|org|me|pro|info|io|co|biz|site|online|top|club|xyz|app|mobi|audio|fm|store|art|tech|live|cc|by|ua|kz|eu|tv)\b/gi;
const GENERIC_TLD_REGEX = /\b[a-zA-Z0-9-]{2,}\.[a-zA-Z]{2,6}\b/gi;
const URL_PREFIX_REGEX = /(?:https?:\/\/|ftps?:\/\/|www\.|t\.me\/|vk\.com\/|@)[^\s]+/gi;

const JUNK_PATTERNS = [
  /\s*[\(\[\{].*?\b(?:official|video|music video|official video|audio|official audio|hd|4k|remastered|remaster|explicit|clean|live|prod\.|produced by|deluxe|bonus|edit|radio edit|mono|stereo|lyrics|lyric video|version|feat\.|ft\.|featuring|with|vocal cover|cover|remix)\b.*?[\)\]\}]/gi,
  /\b(?:official video|official audio|lyric video|hd|4k|remastered|remaster)\b/gi,
  /\s*[\(—\-]\s*(?:копия|copy)(?:\s*\d+)?\)?/gi
];

const PROFANITY_PATTERN = /\b(?:shit|fuck|bitch|cunt|asshole|nigger|nigga|pussy|cock)\b/gi;
const GARBAGE_ARTIST_PATTERN = /^(?:[a-z0-9]{12,}|[a-z]+\d{5,}|dj какоita.*|mashups by.*|soundpad.*)$/i;
const TRACK_NUMBER_PREFIX = /^\s*(?:0\d{1,2}|\d{1,3}\s*[-._]\s+|\d{1,2}\.\s+)/;
const IGNORED_SYSTEM_FOLDERS = /^(?:telegram|desktop|downloads|music|documents|pictures|videos|загрузки|рабочий стол|музыка|документы|изображения|видео|новая папка|new folder|temp|tmp|uncategorized|music\s*folder)$/i;

function stripWebWatermarks(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(URL_PREFIX_REGEX, '')
    .replace(UNIVERSAL_DOMAIN_REGEX, '')
    .replace(GENERIC_TLD_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWatermarks(str) {
  return stripWebWatermarks(str);
}

function isNumericOrJunkQuery(str) {
  if (!str || typeof str !== 'string') return true;
  const clean = str.trim();
  if (clean.length < 2) return true;
  if (/^[\d\s._\/\-\|\\]+$/.test(clean)) return true;
  if (/^[^\wа-яА-ЯёЁ]+$/u.test(clean)) return true;
  return false;
}

function isCoverTrack(rawTitle, filePath) {
  const str = `${rawTitle || ''} ${filePath || ''}`.toLowerCase();
  return /\b(?:vocal cover|cover|tribute|remix|bootleg)\b/i.test(str);
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const AUDIO_EXT_REGEX = /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma)$/i;

function cleanString(str) {
  if (!str || typeof str !== 'string') return '';
  let cleaned = stripWebWatermarks(str);
  cleaned = cleaned.replace(AUDIO_EXT_REGEX, '');
  for (const pattern of JUNK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned
    .replace(AUDIO_EXT_REGEX, '')
    .replace(/\b([a-z])\*+\b/gi, '$1')
    .replace(/[()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim();
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = cleanString(str1).toLowerCase().replace(/\*/g, '');
  const s2 = cleanString(str2).toLowerCase().replace(/\*/g, '');
  if (s1 === s2) return 1.0;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  
  const levDist = levenshteinDistance(s1, s2);
  const levSim = 1.0 - levDist / maxLen;
  
  const words1 = s1.split(/\s+/).filter(w => w.length > 0);
  const words2 = s2.split(/\s+/).filter(w => w.length > 0);
  let wordMatches = 0;
  const set2 = new Set(words2);
  words1.forEach(w => {
    if (set2.has(w)) wordMatches++;
  });
  
  const diceSim = (2.0 * wordMatches) / (words1.length + words2.length || 1);
  return (levSim * 0.6) + (diceSim * 0.4);
}

function cleanTitle(title) {
  if (!title) return '';
  let cleaned = title.replace(TRACK_NUMBER_PREFIX, '');
  return cleanString(cleaned);
}

function getPrimaryArtist(artist) {
 if (!artist) return '';

 const bracketMatch =
 artist.match(/\(([^)]+)\)/);

 if (
 bracketMatch &&
 bracketMatch[1]
 ) {
 return cleanString(
 bracketMatch[1]
 );
 }

 const clean =
 cleanString(artist);

 const parts =
 clean.split(
 /\s*(?:feat\.|ft\.|featuring|with)\s+|\s+[x×&]\s+|\s*,\s*/i
 );

 return parts[0]
 ? parts[0].trim()
 : clean;
}

function parseFilename(filePath) {
  if (!filePath) return { artist: '', title: '' };
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const cleanBase = stripWebWatermarks(baseName.replace(TRACK_NUMBER_PREFIX, '')).trim();

  if (cleanBase.includes(' - ')) {
    const parts = cleanBase.split(' - ');
    return {
      artist: cleanString(parts[0]),
      title: cleanTitle(parts.slice(1).join(' - '))
    };
  }

  if (cleanBase.includes(',') && !cleanBase.includes(' - ')) {
    const commaIndex = cleanBase.indexOf(',');
    const potentialArtist = cleanBase.substring(0, commaIndex).trim();
    const potentialTitle = cleanBase.substring(commaIndex + 1).trim();
    if (potentialArtist.length >= 2 && potentialTitle.length >= 2) {
      return {
        artist: cleanString(potentialArtist),
        title: cleanTitle(potentialTitle)
      };
    }
  }

  return { artist: '', title: cleanTitle(cleanBase) };
}

function generateQueryPasses(rawArtist, rawTitle, filePath = '') {
  const passes = [];
  const seen = new Set();
  const isUnknownArtist = !rawArtist || /unknown artist/i.test(rawArtist) || GARBAGE_ARTIST_PATTERN.test(rawArtist);
  const isUnknownTitle = !rawTitle || /unknown title/i.test(rawTitle);
  let artist = isUnknownArtist ? '' : rawArtist;
  let title = isUnknownTitle ? '' : rawTitle;
  if (filePath) {
    const parsed = parseFilename(filePath);
    if (!artist && !GARBAGE_ARTIST_PATTERN.test(parsed.artist)) {
      artist = parsed.artist;
      if (!title && parsed.title) {
        title = parsed.title;
      }
    }
  }

  if (filePath) {
    const parsed = parseFilename(filePath);
    if (!artist && !GARBAGE_ARTIST_PATTERN.test(parsed.artist)) {
      artist = parsed.artist;
      title = parsed.title;
    }
  }

  if (artist && title.toLowerCase().startsWith(artist.toLowerCase() + ' ')) {
    title = title.substring(artist.length).trim();
  }

  const cleanedArtist = GARBAGE_ARTIST_PATTERN.test(artist) ? '' : cleanString(artist);
  const primaryArtist = getPrimaryArtist(artist);
  const cleanedTitle = cleanTitle(title);
  const isCover = isCoverTrack(rawTitle, filePath) || isCoverTrack(title, filePath);

  const addPass = (art, ttl, customQuery = null) => {
    const cleanArt = GARBAGE_ARTIST_PATTERN.test(art) ? '' : cleanString(art);
    let cleanTtl = cleanTitle(ttl);
    if (cleanArt && cleanTtl.toLowerCase().startsWith(cleanArt.toLowerCase() + ' ')) {
      cleanTtl = cleanTtl.substring(cleanArt.length).trim();
    }
    const targetTitle = cleanTtl || cleanedTitle;
    if (!targetTitle && !cleanArt) return;

    if (!cleanArt && isNumericOrJunkQuery(targetTitle)) return;

    const query = customQuery || (cleanArt && cleanTtl ? `${cleanArt} ${cleanTtl}` : (cleanArt || cleanTtl));
    if (isNumericOrJunkQuery(query)) return;

    const key = `${cleanArt.toLowerCase()}|||${targetTitle.toLowerCase()}|||${query.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      passes.push({
        artist: cleanArt,
        title: targetTitle,
        query: query.trim(),
        isCover
      });
    }
  };

  // Pass 1: Полный артист + название
  if (cleanedArtist && cleanedTitle) addPass(cleanedArtist, cleanedTitle);

  // Pass 2: Поиск по чистому названию песни (для ситуаций, когда слитный запрос API не сработал)
  if (cleanedTitle && !isNumericOrJunkQuery(cleanedTitle)) {
    addPass(cleanedArtist, cleanedTitle, cleanedTitle);
  }

 // Pass 3: Разделение двуязычного имени одиночного артиста.
 // Collaboration credits намеренно не разделяем по алфавиту,
 // иначе "JEIN, Ира PSP, Lena Rush" превращается в ложные имена.
 const hasMultipleArtistCredits =
 /[,;&]|\s+[x×]\s+|\b(?:feat\.?|ft\.?|featuring)\b/i.test(
 cleanedArtist
 );

 if (
 cleanedArtist &&
 !hasMultipleArtistCredits &&
 /[a-z]/i.test(cleanedArtist) &&
 /[а-яё]/i.test(cleanedArtist)
 ) {
 const cyrillicPart =
 cleanString(
 cleanedArtist.replace(
 /[a-z0-9$]/gi,
 ''
 )
 );

 const latinPart =
 cleanString(
 cleanedArtist.replace(
 /[а-яё]/gi,
 ''
 )
 );

 if (
 cyrillicPart &&
 cleanedTitle
 ) {
 addPass(
 cyrillicPart,
 cleanedTitle
 );
 }

 if (
 latinPart &&
 cleanedTitle
 ) {
 addPass(
 latinPart,
 cleanedTitle
 );
 }
 }

  // Pass 4: Извлеченный главный артист
  if (primaryArtist && primaryArtist !== cleanedArtist && cleanedTitle) {
    addPass(primaryArtist, cleanedTitle);
  }

  return passes;
}

module.exports = {
  stripWebWatermarks,
  cleanWatermarks,
  cleanString,
  cleanTitle,
  getPrimaryArtist,
  parseFilename,
  generateQueryPasses,
  calculateSimilarity,
  isCoverTrack,
  isNumericOrJunkQuery
};