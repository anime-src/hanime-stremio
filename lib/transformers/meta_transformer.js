/**
 * Meta Transformer
 * Transforms Hanime video/series metadata to Stremio format
 */

const constants = require('../constants');
const { 
  capitalizeGenres, 
  proxyURLById, 
  cleanDescription, 
  calculateRating,
  formatRuntime,
  extractYear
} = require('./formatters');

/**
 * Build links array for Stremio meta
 * @param {Object} video - Hanime video object
 * @param {Array} genres - Array of genres
 * @returns {Array} Links array
 */
function buildMetaLinks(video, genres) {
  const links = [];

  // Add rating link (using custom rating)
  if (video.likes || video.dislikes) {
    const rating = calculateRating(video.likes || 0, video.dislikes || 0);
    links.push({
      name: `⭐ ${rating}`,
      category: 'Rating',
      url: `https://hanime.tv/videos/hentai/${video.slug}`
    });
  }

  // Add Hanime.tv link
  links.push({
    name: 'Watch on Hanime.tv',
    category: 'Links',
    url: `https://hanime.tv/videos/hentai/${video.slug}`
  });

  // Add genre links (first 3 genres)
  if (Array.isArray(genres) && genres.length > 0) {
    genres.slice(0, 3).forEach(genre => {
      links.push({
        name: genre,
        category: 'Genres',
        url: `stremio:///search?search=${encodeURIComponent(genre)}`
      });
    });
  }

  // Add studio/brand link
  if (video.brand) {
    links.push({
      name: video.brand,
      category: 'Studio',
      url: `stremio:///search?search=${encodeURIComponent(video.brand)}`
    });
  }

  return links;
}

/**
 * Transform Hanime video to Stremio meta object
 * @param {Object} hanimeVideo - Hanime video object
 * @param {Object} imageUrls - Cached image URLs { poster, background }
 * @returns {Object} Stremio meta object
 */
function toStremioMeta(hanimeVideo, imageUrls) {
  if (!hanimeVideo) return null;

  const genres = hanimeVideo.hentai_tags 
    ? hanimeVideo.hentai_tags.map(tag => tag.text)
    : [];

  const capitalizedGenres = capitalizeGenres(genres);
  const runtime = formatRuntime(hanimeVideo.duration_in_ms);
  const year = extractYear(hanimeVideo.released_at_unix || hanimeVideo.released_at);
  const rating = calculateRating(hanimeVideo.likes || 0, hanimeVideo.dislikes || 0);
  const prefixedId = `${constants.addonPrefix}:${hanimeVideo.slug}`;

  return {
    id: prefixedId,
    name: hanimeVideo.name,
    type: constants.contentTypes.DEFAULT,
    poster: proxyURLById(prefixedId, 'poster'),
    posterShape: 'poster',
    background: proxyURLById(prefixedId, 'background'),
    description: cleanDescription(hanimeVideo.description),
    releaseInfo: year,
    runtime: runtime,
    genre: capitalizedGenres,
    genres: capitalizedGenres,
    director: hanimeVideo.brand ? [hanimeVideo.brand] : [],
    cast: [], // Hanime doesn't provide cast info
    imdbRating: rating,
    links: buildMetaLinks(hanimeVideo, capitalizedGenres),
    behaviorHints: {
      defaultVideoId: prefixedId
    },
    // Store CDN URLs for proxy middleware (custom property, not part of Stremio spec)
    _cdnUrls: {
      poster: imageUrls.poster || '',
      background: imageUrls.background || ''
    }
  };
}

/**
 * Transform series episodes to Stremio series meta with videos array
 * @param {string} seriesId - Series ID
 * @param {string} seriesName - Series name
 * @param {Array} episodes - Array of episode objects
 * @param {Object} imageUrls - Cached image URLs { poster, background }
 * @returns {Object} Stremio series meta object
 */
function toStremioSeriesMeta(seriesId, seriesName, episodes, imageUrls) {
  if (!episodes || episodes.length === 0) return null;

  const firstEpisode = episodes[0];
  
  // Use first episode for series-level data
  const genres = firstEpisode.tags && Array.isArray(firstEpisode.tags)
    ? capitalizeGenres(firstEpisode.tags)
    : [];

  // Add hanime: prefix to series ID if not already present
  const prefixedSeriesId = seriesId.startsWith(constants.addonPrefix) 
    ? seriesId 
    : `${constants.addonPrefix}:${seriesId}`;

  // Build videos array with hanime:series:base:episode format
  const videos = episodes.map((ep, index) => ({
    id: `${prefixedSeriesId}:${ep.slug}`, // e.g., "hanime:series:imaria:imaria-5"
    title: ep.name || `Episode ${ep.episodeNumber || index + 1}`,
    released: new Date(ep.released_at_unix * 1000 || Date.now()).toISOString(),
    season: 1,
    episode: ep.episodeNumber || index + 1,
    thumbnail: proxyURLById(`${prefixedSeriesId}:${ep.slug}`, 'poster'),
    overview: cleanDescription(ep.description)
  }));

  return {
    id: prefixedSeriesId,
    name: seriesName,
    type: constants.contentTypes.SERIES,
    poster: proxyURLById(prefixedSeriesId, 'poster'),
    posterShape: 'poster',
    background: proxyURLById(prefixedSeriesId, 'background'),
    description: cleanDescription(firstEpisode.description),
    releaseInfo: extractYear(firstEpisode.released_at_unix || firstEpisode.released_at),
    genre: genres,
    genres: genres,
    videos: videos,
    links: [],
    // Store CDN URLs for proxy middleware (custom property, not part of Stremio spec)
    _cdnUrls: {
      poster: imageUrls.poster || '',
      background: imageUrls.background || ''
    },
    // Store episode CDN URLs for thumbnail proxying
    _episodeCdnUrls: episodes.reduce((acc, ep) => {
      const episodeId = `${prefixedSeriesId}:${ep.slug}`;
      acc[episodeId] = {
        poster: ep.cover_url || ep.poster_url || '',
        background: ep.poster_url || ep.cover_url || ''
      };
      return acc;
    }, {})
  };
}

module.exports = {
  buildMetaLinks,
  toStremioMeta,
  toStremioSeriesMeta
};
