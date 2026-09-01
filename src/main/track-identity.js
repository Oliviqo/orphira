const crypto = require('crypto');
const path = require('path');

/**
 * COSMIC PLAYER - PHYSICAL TRACK IDENTITY
 * Единая нормализация путей и генерация стабильных Track ID
 * для Worker, Watcher и Storage.
 */

function normalizeTrackPath(filePath) {
 if (!filePath || typeof filePath !== 'string') {
  return '';
 }

 let normalized = path.normalize(filePath)
  .replace(/\\/g, '/')
  .replace(/\/+/g, '/')
  .trim();

 if (process.platform === 'win32') {
  normalized = normalized.toLowerCase();
 }

 return normalized;
}

function areTrackPathsEqual(pathA, pathB) {
 if (!pathA || !pathB) return false;

 return normalizeTrackPath(pathA) === normalizeTrackPath(pathB);
}

function createTrackId(filePath) {
 const normalized = normalizeTrackPath(filePath);

 if (!normalized) {
  return null;
 }

 return crypto
  .createHash('md5')
  .update(normalized)
  .digest('hex');
}

module.exports = {
 normalizeTrackPath,
 areTrackPathsEqual,
 createTrackId
};