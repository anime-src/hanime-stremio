/**
 * Series Utilities
 * Pure functions for detecting and grouping multi-episode content into series
 * No dependencies - all stateless transformations
 */

/**
 * Extract episode number and base title from video name
 * Supports patterns like:
 * - "Title 1", "Title 2"
 * - "Title Episode 1", "Title Episode 2"
 * - "Title - Episode 1", "Title - Episode 2"
 * - "Title ep 1", "Title ep 2"
 * 
 * @param {string} name - Video name
 * @returns {Object|null} { baseName, episodeNumber } or null if not detected
 */
function parseEpisodeInfo(name) {
  if (!name) return null;

  // Pattern 1: "Title 1", "Title 2" (number at end)
  const pattern1 = /^(.+?)\s+(\d+)$/;
  let match = name.match(pattern1);
  if (match) {
    return {
      baseName: match[1].trim(),
      episodeNumber: parseInt(match[2], 10)
    };
  }

  // Pattern 2: "Title Episode 1", "Title ep 1", "Title Ep. 1"
  const pattern2 = /^(.+?)\s+(?:episode|ep\.?|e)\s*(\d+)$/i;
  match = name.match(pattern2);
  if (match) {
    return {
      baseName: match[1].trim(),
      episodeNumber: parseInt(match[2], 10)
    };
  }

  // Pattern 3: "Title - 1", "Title - Episode 1"
  const pattern3 = /^(.+?)\s*[-–—]\s*(?:episode\s*)?(\d+)$/i;
  match = name.match(pattern3);
  if (match) {
    return {
      baseName: match[1].trim(),
      episodeNumber: parseInt(match[2], 10)
    };
  }

  return null;
}

/**
 * Generate a series slug from base name
 * @param {string} baseName - Base series name
 * @returns {string} Series slug
 */
function generateSeriesSlug(baseName) {
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Group videos into series based on title patterns
 * @param {Array} videos - Array of video objects with name and slug
 * @returns {Array} Array of series objects with episodes
 */
function detectSeries(videos) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return [];
  }

  const seriesMap = new Map();

  // First pass: parse and group by base name
  videos.forEach(video => {
    const episodeInfo = parseEpisodeInfo(video.name);
    
    if (episodeInfo) {
      const { baseName, episodeNumber } = episodeInfo;
      
      if (!seriesMap.has(baseName)) {
        seriesMap.set(baseName, {
          baseName,
          episodes: []
        });
      }

      seriesMap.get(baseName).episodes.push({
        ...video,
        episodeNumber
      });
    }
  });

  // Second pass: filter out single-episode "series" and sort episodes
  const series = [];
  
  seriesMap.forEach((seriesData, baseName) => {
    // Only include if it has 2+ episodes
    if (seriesData.episodes.length >= 2) {
      // Sort episodes by episode number
      seriesData.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
      
      series.push({
        id: `series:${generateSeriesSlug(baseName)}`,
        baseName: baseName,
        episodes: seriesData.episodes
      });
    }
  });

  return series;
}

/**
 * Get unique series from video list (for catalog display)
 * Returns one entry per series with representative data from first episode
 * @param {Array} videos - Array of video objects
 * @returns {Array} Array of series catalog items
 */
function getSeriesCatalogItems(videos) {
  const series = detectSeries(videos);
  
  return series.map(s => {
    const firstEpisode = s.episodes[0];
    
    return {
      id: s.id,
      name: s.baseName,
      slug: s.id,
      // Use first episode's data for cover, description, tags
      cover_url: firstEpisode.cover_url,
      poster_url: firstEpisode.poster_url,
      description: firstEpisode.description,
      tags: firstEpisode.tags,
      // Series-specific data
      episodeCount: s.episodes.length,
      isSeries: true
    };
  });
}

/**
 * Get episodes for a specific series slug
 * @param {Array} videos - Array of all video objects
 * @param {string} seriesSlug - Series slug (e.g., "series:mujin-eki")
 * @returns {Array} Array of episode objects sorted by episode number
 */
function getSeriesEpisodes(videos, seriesSlug) {
  // Remove "series:" prefix if present
  const cleanSlug = seriesSlug.replace(/^series:/, '');
  
  const series = detectSeries(videos);
  const foundSeries = series.find(s => s.id === `series:${cleanSlug}` || s.id === seriesSlug);
  
  if (!foundSeries) {
    return [];
  }

  return foundSeries.episodes;
}

module.exports = {
  parseEpisodeInfo,
  generateSeriesSlug,
  detectSeries,
  getSeriesCatalogItems,
  getSeriesEpisodes
};

