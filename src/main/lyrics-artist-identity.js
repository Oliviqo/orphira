/**
 * COSMIC PLAYER - LYRICS MULTI-ARTIST IDENTITY
 *
 * Изолированная модель artist credits исключительно для lyrics pipeline.
 *
 * Задачи:
 * - разделять явные collaboration credits;
 * - сохранять полный artist credit первым и приоритетным;
 * - генерировать отдельные artist identities для lyrics-поиска;
 * - безопасно подтверждать кандидатов, опубликованных под одним
 *   из артистов исходной композиции;
 * - не изменять metadata / covers query pipeline.
 */

const {
 cleanString,
 calculateSimilarity
} = require('./query-cleaner');

const EXPLICIT_CREDIT_SEPARATOR =
 /\s*(?:,|;|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\s+[x×]\s+)\s*/i;

function normalizeArtistName(value) {
 return cleanString(
 String(value || '')
 )
 .normalize('NFKC')
 .replace(/\s+/g, ' ')
 .trim();
}

function normalizeArtistKey(value) {
 return normalizeArtistName(value)
 .toLocaleLowerCase();
}

function isUnknownArtist(value) {
 const normalized =
 normalizeArtistKey(value);

 return (
 !normalized ||
 normalized === 'unknown artist'
 );
}

function splitArtistCredits(rawArtist) {
 const fullArtist =
 normalizeArtistName(rawArtist);

 if (isUnknownArtist(fullArtist)) {
 return [];
 }

 const rawCredits =
 fullArtist
 .split(EXPLICIT_CREDIT_SEPARATOR)
 .map(item =>
 normalizeArtistName(item)
 )
 .filter(item =>
 !isUnknownArtist(item)
 );

 const seen =
 new Set();

 const credits = [];

 rawCredits.forEach(credit => {
 const key =
 normalizeArtistKey(credit);

 if (
 !key ||
 seen.has(key)
 ) {
 return;
 }

 seen.add(key);
 credits.push(credit);
 });

 if (credits.length === 0) {
 return [fullArtist];
 }

 return credits;
}

function buildLyricsArtistIdentities(
 rawArtist
) {
 const fullArtist =
 normalizeArtistName(rawArtist);

 if (isUnknownArtist(fullArtist)) {
 return [];
 }

 const credits =
 splitArtistCredits(fullArtist);

 const identities = [];
 const seen = new Set();

 const addIdentity = (
 artist,
 type
 ) => {
 const normalizedArtist =
 normalizeArtistName(artist);

 const key =
 normalizeArtistKey(
 normalizedArtist
 );

 if (
 !key ||
 isUnknownArtist(normalizedArtist) ||
 seen.has(key)
 ) {
 return;
 }

 seen.add(key);

 identities.push({
 artist:
 normalizedArtist,
 type
 });
 };

 addIdentity(
 fullArtist,
 'full'
 );

 credits.forEach(credit => {
 addIdentity(
 credit,
 'credit'
 );
 });

 return identities;
}

function calculateArtistCreditSimilarity(
 candidateArtist,
 expectedArtist
) {
 const candidate =
 normalizeArtistName(
 candidateArtist
 );
 const expected =
 normalizeArtistName(
 expectedArtist
 );

 if (
 !candidate ||
 !expected
 ) {
 return 0;
 }

 const directSimilarity =
 calculateSimilarity(
 candidate,
 expected
 );

 const candidateCredits =
 splitArtistCredits(candidate);
 const expectedCredits =
 splitArtistCredits(expected);

 let bestSimilarity =
 directSimilarity;

 for (
 const candidateCredit
 of candidateCredits
 ) {
 for (
 const expectedCredit
 of expectedCredits
 ) {
 const similarity =
 calculateSimilarity(
 candidateCredit,
 expectedCredit
 );

 if (
 similarity >
 bestSimilarity
 ) {
 bestSimilarity =
 similarity;
 }
 }
 }

 return bestSimilarity;
}

function matchLyricsArtistCandidate(
 candidateArtist,
 expectedArtist,
 minimumSimilarity = 0.50
) {
 const candidate =
 normalizeArtistName(
 candidateArtist
 );
 const expected =
 normalizeArtistName(
 expectedArtist
 );

 if (
 !candidate ||
 !expected ||
 isUnknownArtist(expected)
 ) {
 return {
 matched: false,
 similarity: 0,
 matchedCredit: null
 };
 }

 const directSimilarity =
 calculateSimilarity(
 candidate,
 expected
 );

 let bestSimilarity =
 directSimilarity;

 let matchedCredit =
 directSimilarity >=
 minimumSimilarity
 ? expected
 : null;

 const candidateCredits =
 splitArtistCredits(candidate);

 const expectedCredits =
 splitArtistCredits(expected);

 for (
 const candidateCredit
 of candidateCredits
 ) {
 for (
 const expectedCredit
 of expectedCredits
 ) {
 const similarity =
 calculateSimilarity(
 candidateCredit,
 expectedCredit
 );

 if (
 similarity >
 bestSimilarity
 ) {
 bestSimilarity =
 similarity;
 matchedCredit =
 expectedCredit;
 }
 }
 }

 return {
 matched:
 bestSimilarity >=
 minimumSimilarity,
 similarity:
 bestSimilarity,
 matchedCredit:
 bestSimilarity >=
 minimumSimilarity
 ? matchedCredit
 : null
 };
}

module.exports = {
 normalizeArtistName,
 splitArtistCredits,
 buildLyricsArtistIdentities,
 calculateArtistCreditSimilarity,
 matchLyricsArtistCandidate
};