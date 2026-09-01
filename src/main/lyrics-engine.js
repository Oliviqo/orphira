const {
 net
} = require('electron');

const {
 generateQueryPasses,
 calculateSimilarity,
 cleanString,
 cleanTitle
} = require('./query-cleaner');

const debugEngine =
 require('./debug-engine');

const {
 getUserAgent
} = require('./app-identity');
 
const {
 buildLyricsArtistIdentities,
 matchLyricsArtistCandidate
} = require('./lyrics-artist-identity');

/**
 * COSMIC PLAYER - OPTIONAL LRCLIB RUNTIME LYRICS ENGINE
 *
 * Provider:
 * - LRCLIB only.
 *
 * Privacy:
 * - отправляются Artist/Title поисковой гипотезы;
 * - аудиофайл не отправляется.
 *
 * Storage policy:
 * - online lyrics НЕ записываются на диск;
 * - lyricsCache здесь не используется;
 * - результат существует только в памяти Renderer/runtime;
 * - embedded/external lyrics остаются отдельным локальным pipeline.
 */

const REQUEST_TIMEOUT_MS = 5000;

const HEADERS = {
 'User-Agent':
 getUserAgent(),
 'Accept':
 'application/json'
};

const inFlightLyricsRequests =
 new Map();

const runtimeLyricsCache =
 new Map();

function sleep(milliseconds) {
 return new Promise(resolve => {
 setTimeout(
 resolve,
 milliseconds
 );
 });
}

function getRetryAfterMs(
 response
) {
 const raw =
 response?.headers?.get(
 'retry-after'
 );

 if (!raw) {
 return 0;
 }

 const seconds =
 Number(raw);

 if (
 Number.isFinite(seconds) &&
 seconds >= 0
 ) {
 return Math.min(
 seconds * 1000,
 30000
 );
 }

 const retryDate =
 Date.parse(raw);

 if (
 Number.isFinite(retryDate)
 ) {
 return Math.min(
 Math.max(
 0,
 retryDate - Date.now()
 ),
 30000
 );
 }

 return 0;
}

async function fetchJson(
 url,
 retryAllowed = true
) {
 const controller =
 new AbortController();

 const timeout =
 setTimeout(
 () => controller.abort(),
 REQUEST_TIMEOUT_MS
 );

 try {
    const fetchFn = net.fetch;

 const response =
 await fetchFn(
 url,
 {
 headers: HEADERS,
 signal:
 controller.signal
 }
 );

 if (
 response.status === 429 &&
 retryAllowed
 ) {
 const retryAfter =
 getRetryAfterMs(
 response
 );

 debugEngine.addLog(
 'LYRICS',
 'warn',
 `LRCLIB rate limit. Retry after ${retryAfter}ms.`
 );

 if (retryAfter > 0) {
 await sleep(retryAfter);
 }

 return fetchJson(
 url,
 false
 );
 }

 if (!response.ok) {
 debugEngine.addLog(
 'LYRICS',
 'warn',
 `LRCLIB HTTP ${response.status}.`
 );

 return null;
 }

 return await response.json();
 } catch (error) {
 debugEngine.addLog(
 'LYRICS',
 'warn',
 `LRCLIB недоступен: ${error.message}`
 );

 return null;
 } finally {
 clearTimeout(timeout);
 }
}

function isKnownLyricsArtist(
 artist
) {
 const normalized =
 cleanString(
 artist || ''
 )
 .trim();

 return Boolean(
 normalized &&
 normalized.toLowerCase() !==
 'unknown artist'
 );
}

function evaluateLyricsCandidate(
 candidateArtist,
 candidateTitle,
 expectedArtist,
 expectedTitle
) {
 const cleanCandidateArtist =
 cleanString(
 candidateArtist || ''
 );

 const cleanCandidateTitle =
 cleanTitle(
 candidateTitle || ''
 );

 const cleanExpectedArtist =
 cleanString(
 expectedArtist || ''
 );

 const cleanExpectedTitle =
 cleanTitle(
 expectedTitle || ''
 );

 if (
 !cleanCandidateTitle ||
 !cleanExpectedTitle
 ) {
 return {
 accepted: false,
 score: 0,
 titleSimilarity: 0,
 artistSimilarity: 0
 };
 }

 const titleSimilarity =
 calculateSimilarity(
 cleanCandidateTitle,
 cleanExpectedTitle
 );

 if (
 !isKnownLyricsArtist(
 cleanExpectedArtist
 )
 ) {
 const accepted =
 titleSimilarity >= 0.90;

 return {
 accepted,
 score:
 accepted
 ? titleSimilarity
 : 0,
 titleSimilarity,
 artistSimilarity: 0
 };
 }

 if (!cleanCandidateArtist) {
 return {
 accepted: false,
 score: 0,
 titleSimilarity,
 artistSimilarity: 0
 };
 }

 const artistMatch =
 matchLyricsArtistCandidate(
 cleanCandidateArtist,
 cleanExpectedArtist,
 0.50
 );

 const artistSimilarity =
 artistMatch.similarity;

 const accepted =
 titleSimilarity >= 0.68 &&
 artistMatch.matched;

 return {
 accepted,
 score:
 accepted
 ? (
 titleSimilarity * 0.64 +
 artistSimilarity * 0.36
 )
 : 0,
 titleSimilarity,
 artistSimilarity
 };
}

async function fetchLrclibExact(
 artist,
 title
) {
 if (
 !artist ||
 !title
 ) {
 return null;
 }

 const url =
 `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;

 const data =
 await fetchJson(url);

 if (!data) {
 return null;
 }

 const candidateArtist =
 data.artistName ||
 data.artist_name ||
 '';

 const candidateTitle =
 data.trackName ||
 data.track_name ||
 title;

 const validation =
 evaluateLyricsCandidate(
 candidateArtist,
 candidateTitle,
 artist,
 title
 );

 if (!validation.accepted) {
 return null;
 }

 if (data.syncedLyrics) {
 return {
 lyrics:
 data.syncedLyrics,
 synced: true
 };
 }

 if (data.plainLyrics) {
 return {
 lyrics:
 data.plainLyrics,
 synced: false
 };
 }

 return null;
}

async function fetchLrclibSearch(
 query,
 expectedArtist,
 expectedTitle
) {
 if (
 !query ||
 !expectedTitle
 ) {
 return null;
 }

 const url =
 `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;

 const data =
 await fetchJson(url);

 if (
 !Array.isArray(data) ||
 data.length === 0
 ) {
 return null;
 }

 let best = null;

 for (const item of data) {
 if (
 !item ||
 (
 !item.syncedLyrics &&
 !item.plainLyrics
 )
 ) {
 continue;
 }

 const candidateArtist =
 item.artistName ||
 item.artist_name ||
 '';

 const candidateTitle =
 item.trackName ||
 item.track_name ||
 '';

 const validation =
 evaluateLyricsCandidate(
 candidateArtist,
 candidateTitle,
 expectedArtist,
 expectedTitle
 );

 if (!validation.accepted) {
 continue;
 }

 const qualityBonus =
 item.syncedLyrics
 ? 0.04
 : 0;

 const finalScore =
 validation.score +
 qualityBonus;

 if (
 !best ||
 finalScore >
 best.score
 ) {
 best = {
 item,
 score:
 finalScore
 };
 }
 }

 if (!best) {
 return null;
 }

 if (best.item.syncedLyrics) {
 return {
 lyrics:
 best.item.syncedLyrics,
 synced: true
 };
 }

 if (best.item.plainLyrics) {
 return {
 lyrics:
 best.item.plainLyrics,
 synced: false
 };
 }

 return null;
}

function buildLyricsPasses(
 rawArtist,
 rawTitle,
 filePath
) {
 const basePasses =
 generateQueryPasses(
 rawArtist,
 rawTitle,
 filePath
 );

 const artistIdentities =
 buildLyricsArtistIdentities(
 rawArtist
 );

 const passes = [];
 const seen = new Set();

 const addPass =
 pass => {
 if (!pass?.title) {
 return;
 }

 const artist =
 cleanString(
 pass.artist || ''
 );

 const title =
 cleanTitle(
 pass.title || ''
 );

 const query =
 String(
 pass.query ||
 (
 artist
 ? `${artist} ${title}`
 : title
 )
 )
 .replace(/\s+/g, ' ')
 .trim();

 if (
 !title ||
 !query
 ) {
 return;
 }

 const key =
 `${artist.toLocaleLowerCase()}|||${title.toLocaleLowerCase()}|||${query.toLocaleLowerCase()}`;

 if (seen.has(key)) {
 return;
 }

 seen.add(key);

 passes.push({
 artist,
 title,
 query
 });
 };

 basePasses.forEach(
 addPass
 );

 const primaryTitle =
 basePasses[0]?.title ||
 cleanTitle(rawTitle);

 if (primaryTitle) {
 artistIdentities.forEach(
 identity => {
 if (!identity?.artist) {
 return;
 }

 addPass({
 artist:
 identity.artist,
 title:
 primaryTitle,
 query:
 `${identity.artist} ${primaryTitle}`
 });
 }
 );
 }

 return passes;
}

function safeRuntimeCacheSet(
 key,
 value
) {
 if (
 runtimeLyricsCache.size >= 200
 ) {
 const oldest =
 runtimeLyricsCache
 .keys()
 .next()
 .value;

 if (oldest) {
 runtimeLyricsCache.delete(
 oldest
 );
 }
 }

 runtimeLyricsCache.set(
 key,
 value
 );
}

async function fetchLyrics(
 rawArtist,
 rawTitle,
 filePath = ''
) {
 const requestKey =
 filePath ||
 `${rawArtist || ''}_${rawTitle || ''}`;

 if (
 runtimeLyricsCache.has(
 requestKey
 )
 ) {
 return runtimeLyricsCache.get(
 requestKey
 );
 }

 if (
 inFlightLyricsRequests.has(
 requestKey
 )
 ) {
 return inFlightLyricsRequests.get(
 requestKey
 );
 }

 const requestPromise =
 (async () => {
 const startedAt =
 Date.now();

 const passes =
 buildLyricsPasses(
 rawArtist,
 rawTitle,
 filePath
 );

 if (passes.length === 0) {
 return null;
 }

 debugEngine.addLog(
 'LYRICS',
 'info',
 `LRCLIB runtime lookup: "${rawArtist || 'Unknown'}" — "${rawTitle || 'Unknown'}".`
 );

 let plainFallback =
 null;

 for (
 let index = 0;
 index < passes.length;
 index++
 ) {
 const pass =
 passes[index];

 if (
 pass.artist &&
 pass.title
 ) {
 const exact =
 await fetchLrclibExact(
 pass.artist,
 pass.title
 );

 if (exact?.synced) {
 safeRuntimeCacheSet(
 requestKey,
 exact.lyrics
 );

 debugEngine.addLog(
 'LYRICS',
 'success',
 `LRCLIB synced lyrics получены за ${Date.now() - startedAt}мс без записи на диск.`
 );

 return exact.lyrics;
 }

 if (
 exact?.lyrics &&
 !plainFallback
 ) {
 plainFallback =
 exact.lyrics;
 }
 }

 const search =
 await fetchLrclibSearch(
 pass.query,
 pass.artist,
 pass.title
 );

 if (search?.synced) {
 safeRuntimeCacheSet(
 requestKey,
 search.lyrics
 );

 debugEngine.addLog(
 'LYRICS',
 'success',
 `LRCLIB synced lyrics получены за ${Date.now() - startedAt}мс без записи на диск.`
 );

 return search.lyrics;
 }

 if (
 search?.lyrics &&
 !plainFallback
 ) {
 plainFallback =
 search.lyrics;
 }
 }

 if (plainFallback) {
 safeRuntimeCacheSet(
 requestKey,
 plainFallback
 );

 debugEngine.addLog(
 'LYRICS',
 'info',
 `LRCLIB plain lyrics получены за ${Date.now() - startedAt}мс без записи на диск.`
 );

 return plainFallback;
 }

 debugEngine.addLog(
 'LYRICS',
 'info',
 `LRCLIB не нашёл текст за ${Date.now() - startedAt}мс.`
 );

 return null;
 })();

 inFlightLyricsRequests.set(
 requestKey,
 requestPromise
 );

 try {
 return await requestPromise;
 } finally {
 if (
 inFlightLyricsRequests.get(
 requestKey
 ) === requestPromise
 ) {
 inFlightLyricsRequests.delete(
 requestKey
 );
 }
 }
}

function clearRuntimeLyricsCache() {
 runtimeLyricsCache.clear();
}

module.exports = {
 fetchLyrics,
 clearRuntimeLyricsCache
};