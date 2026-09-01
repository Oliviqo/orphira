const {
  app,
  ipcMain
} = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * ORPHIRA - LOCAL LIBRARY & SHUFFLE ANALYTICS
 *
 * Полностью локальная агрегированная статистика.
 * Никакие данные не отправляются в сеть.
 * Полные Shuffle-колоды на диск не сохраняются.
 *
 * Storage: userData/library-analytics.json
 */

const ANALYTICS_VERSION = 2;

function getAnalyticsPath() {
  return path.join(
    app.getPath('userData'),
    'library-analytics.json'
  );
}

function createDefaultAnalytics() {
  return {
    version: ANALYTICS_VERSION,
    library: {
      updatedAt: null,
      tracks: 0,
      artists: 0,
      albums: 0,
      durationSeconds: 0,
      sizeBytes: 0,
      losslessTracks: 0,
      lossyTracks: 0,
      unknownQualityTracks: 0,
      topArtist: null,
      topArtistTracks: 0,
      topArtistShare: 0,
      topFiveArtistShare: 0,
      diversityScore: 0
    },
    shuffle: {
      updatedAt: null,
      decksGenerated: 0,
      decksWithEnoughData: 0,
      tracksAnalyzed: 0,
      artistReturnsAnalyzed: 0,
      averageSameArtistDistance: 0,
      shortestSameArtistDistance: 0,
      longestSameArtistStreak: 0,
      lastDeckSize: 0
    }
  };
}

function safeReadAnalytics() {
  const defaults = createDefaultAnalytics();
  const filePath = getAnalyticsPath();

  if (!fs.existsSync(filePath)) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(filePath, 'utf8')
    );

    return {
      ...defaults,
      ...parsed,
      version: ANALYTICS_VERSION,
      library: {
        ...defaults.library,
        ...(parsed?.library || {})
      },
      shuffle: {
        ...defaults.shuffle,
        ...(parsed?.shuffle || {})
      }
    };
  } catch (error) {
    console.error('[Library Analytics] Read failed:', error);
    return defaults;
  }
}

function safeWriteAnalytics(analytics) {
  try {
    fs.writeFileSync(
      getAnalyticsPath(),
      JSON.stringify(analytics, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    console.error('[Library Analytics] Save failed:', error);
    return false;
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLocaleLowerCase();
}

function normalizeArtistCredits(track) {
  const rawCredits = Array.isArray(track?.analyticsArtistCredits)
    ? track.analyticsArtistCredits
    : [];

  const result = [];
  const seen = new Set();

  rawCredits.forEach(value => {
    const name = normalizeText(value);
    const key = normalizeKey(name);

    if (
      !name ||
      !key ||
      key === 'unknown artist' ||
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);
    result.push(name);
  });

  if (result.length > 0) {
    return result;
  }

  const fallback = normalizeText(track?.artist);

  if (
    fallback &&
    normalizeKey(fallback) !== 'unknown artist'
  ) {
    return [fallback];
  }

  return ['Unknown Artist'];
}

function getPrimaryArtistCredit(track) {
  return normalizeArtistCredits(track)[0] || 'Unknown Artist';
}

function incrementMap(map, key, displayName) {
  const existing = map.get(key);

  if (existing) {
    existing.count++;
    return;
  }

  map.set(key, {
    count: 1,
    name: displayName
  });
}

function calculateDiversityScore(artistCounts, totalTracks) {
  if (totalTracks <= 1 || artistCounts.size <= 1) {
    return 0;
  }

  let concentration = 0;

  artistCounts.forEach(entry => {
    const probability = entry.count / totalTracks;
    concentration += probability * probability;
  });

  if (concentration <= 0) {
    return 0;
  }

  const effectiveArtists = 1 / concentration;
  const maximum = Math.min(totalTracks, artistCounts.size);

  if (maximum <= 1) {
    return 0;
  }

  const normalized = (effectiveArtists - 1) / (maximum - 1);

  return Math.round(
    Math.max(0, Math.min(1, normalized)) * 100
  );
}

function analyzeLibrary(tracks) {
  const library = Array.isArray(tracks)
    ? tracks.filter(
        track => track && !track.isSectionHeader
      )
    : [];

  const artistCounts = new Map();
  const albumKeys = new Set();

  let durationSeconds = 0;
  let sizeBytes = 0;
  let losslessTracks = 0;
  let lossyTracks = 0;
  let unknownQualityTracks = 0;

  library.forEach(track => {
    const credits = normalizeArtistCredits(track);

    credits.forEach(artist => {
      const key = normalizeKey(artist);

      if (key && key !== 'unknown artist') {
        incrementMap(artistCounts, key, artist);
      }
    });

    const album = normalizeText(track?.album);

    if (album && normalizeKey(album) !== 'unknown album') {
      const albumArtist =
        normalizeText(track?.albumArtist) ||
        credits[0] ||
        'Unknown Artist';

      albumKeys.add(
        `${normalizeKey(albumArtist)}|||${normalizeKey(album)}`
      );
    }

    const duration = Number(track?.duration);
    if (Number.isFinite(duration) && duration > 0) {
      durationSeconds += duration;
    }

    const size = Number(track?.size);
    if (Number.isFinite(size) && size > 0) {
      sizeBytes += size;
    }

    if (track?.lossless === true) {
      losslessTracks++;
    } else if (track?.lossless === false) {
      lossyTracks++;
    } else {
      unknownQualityTracks++;
    }
  });

  const sortedArtists = [...artistCounts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );

  const topArtist = sortedArtists[0] || null;

  const topFiveCount = sortedArtists
    .slice(0, 5)
    .reduce((sum, entry) => sum + entry.count, 0);

  return {
    updatedAt: new Date().toISOString(),
    tracks: library.length,
    artists: artistCounts.size,
    albums: albumKeys.size,
    durationSeconds: Math.round(durationSeconds),
    sizeBytes: Math.round(sizeBytes),
    losslessTracks,
    lossyTracks,
    unknownQualityTracks,
    topArtist: topArtist?.name || null,
    topArtistTracks: topArtist?.count || 0,
    topArtistShare:
      library.length > 0
        ? Number(((topArtist?.count || 0) / library.length * 100).toFixed(1))
        : 0,
    topFiveArtistShare:
      library.length > 0
        ? Number((topFiveCount / library.length * 100).toFixed(1))
        : 0,
    diversityScore: calculateDiversityScore(
      artistCounts,
      library.length
    )
  };
}

function analyzeShuffleDeck(tracks) {
  const deck = Array.isArray(tracks)
    ? tracks.filter(
        track => track && !track.isSectionHeader
      )
    : [];

  const lastArtistPosition = new Map();
  const distances = [];

  let previousArtist = null;
  let currentStreak = 0;
  let longestStreak = 0;

  deck.forEach((track, index) => {
    const artist = getPrimaryArtistCredit(track);
    const artistKey = normalizeKey(artist);

    if (!artistKey || artistKey === 'unknown artist') {
      return;
    }

    if (artistKey === previousArtist) {
      currentStreak++;
    } else {
      previousArtist = artistKey;
      currentStreak = 1;
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    if (lastArtistPosition.has(artistKey)) {
      distances.push(index - lastArtistPosition.get(artistKey));
    }

    lastArtistPosition.set(artistKey, index);
  });

  const distanceSum = distances.reduce(
    (sum, distance) => sum + distance,
    0
  );

  return {
    size: deck.length,
    returns: distances.length,
    distanceSum,
    shortestDistance:
      distances.length > 0 ? Math.min(...distances) : 0,
    longestStreak: deck.length > 0 ? longestStreak : 0
  };
}

function mergeShuffleAnalytics(current, deck) {
  const previousReturns = Number(current.artistReturnsAnalyzed) || 0;
  const previousAverage = Number(current.averageSameArtistDistance) || 0;
  const previousDistanceSum = previousAverage * previousReturns;

  const totalReturns = previousReturns + deck.returns;

  const averageDistance =
    totalReturns > 0
      ? (previousDistanceSum + deck.distanceSum) / totalReturns
      : 0;

  const previousShortest = Number(current.shortestSameArtistDistance) || 0;

  let shortestDistance = deck.shortestDistance;

  if (previousShortest > 0 && deck.shortestDistance > 0) {
    shortestDistance = Math.min(
      previousShortest,
      deck.shortestDistance
    );
  } else if (previousShortest > 0) {
    shortestDistance = previousShortest;
  }

  return {
    updatedAt: new Date().toISOString(),
    decksGenerated: (Number(current.decksGenerated) || 0) + 1,
    decksWithEnoughData:
      (Number(current.decksWithEnoughData) || 0) +
      (deck.returns > 0 ? 1 : 0),
    tracksAnalyzed: (Number(current.tracksAnalyzed) || 0) + deck.size,
    artistReturnsAnalyzed: totalReturns,
    averageSameArtistDistance: Number(averageDistance.toFixed(2)),
    shortestSameArtistDistance: shortestDistance || 0,
    longestSameArtistStreak: Math.max(
      Number(current.longestSameArtistStreak) || 0,
      deck.longestStreak
    ),
    lastDeckSize: deck.size
  };
}

function initShuffleDiagnostics() {
  ipcMain.handle(
    'shuffle-diagnostics:library',
    (event, tracks) => {
      const analytics = safeReadAnalytics();

      analytics.library = analyzeLibrary(tracks);
      safeWriteAnalytics(analytics);

      return analytics.library;
    }
  );

  ipcMain.handle(
    'shuffle-diagnostics:deck',
    (event, tracks) => {
      const analytics = safeReadAnalytics();
      const deck = analyzeShuffleDeck(tracks);

      analytics.shuffle = mergeShuffleAnalytics(
        analytics.shuffle,
        deck
      );

      safeWriteAnalytics(analytics);

      return analytics.shuffle;
    }
  );

  ipcMain.handle(
    'shuffle-diagnostics:get',
    () => {
      return safeReadAnalytics();
    }
  );
}

module.exports = {
  initShuffleDiagnostics
};