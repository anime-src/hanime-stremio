/**
 * Transformation Service
 * Pure functions for transforming Hanime API data to Stremio format
 */

const config = require('../config');
const constants = require('../constants');

class TransformService {
  /**
   * Capitalize genre tags
   * @param {Array<string>} tags - Array of tag strings
   * @returns {Array<string>} Capitalized tags
   */
  static capitalizeGenres(tags) {
    if (!Array.isArray(tags)) return [];
    
    return tags
      .filter(tag => tag && typeof tag === 'string')
      .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase());
  }

  /**
   * Capitalize and format a title string
   * @param {string} string - String to titleize
   * @param {string} separator - Separator character
   * @returns {string} Titleized string
   */
  static titleize(string, separator = ' ') {
    if (!string) return '';
    
    return string
      .split(separator)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(separator);
  }

  /**
   * Generate proxy URL for images
   * @param {string} url - Original CDN URL
   * @param {string} publicUrl - Public server URL
   * @returns {string} Proxied URL
   */
  /**
   * Generate ID-based proxy URL (like Kitsu)
   * @param {string} videoId - Video ID (e.g., "hanime:video-slug")
   * @param {string} imageType - Image type ("poster" or "background")
   * @param {string} publicUrl - Public server URL
   * @returns {string} Proxy URL (e.g., "/proxy/image/hanime:video-slug/poster")
   */
  static proxyURLById(videoId, imageType, publicUrl) {
    if (!videoId || !imageType) return '';
    
    const baseUrl = publicUrl || process.env.PUBLIC_URL || '';
    // Encode the ID to handle special characters
    const encodedId = encodeURIComponent(videoId);
    return `${baseUrl}/proxy/image/${encodedId}/${imageType}`;
  }

  /**
   * Legacy proxyURL for backward compatibility (catalog items that don't have IDs yet)
   * @param {string} url - Full CDN URL
   * @param {string} publicUrl - Public server URL
   * @returns {string} Proxy URL
   */
  static proxyURL(url, publicUrl) {
    try {
      if (!url) return '';
      
      const u = new URL(url);
      const baseUrl = publicUrl || process.env.PUBLIC_URL || '';
      return `${baseUrl}/proxy${u.pathname}`;
    } catch (error) {
      return url || '';
    }
  }

  /**
   * Clean HTML tags from description
   * @param {string} description - Raw description with HTML
   * @returns {string} Clean description
   */
  static cleanDescription(description) {
    if (!description) return '';
    return description.replace(/([</p>\n])/g, '').trim();
  }

  /**
   * Calculate rating from likes/dislikes
   * @param {number} likes - Number of likes
   * @param {number} dislikes - Number of dislikes
   * @returns {string} Rating out of 10
   */
  static calculateRating(likes, dislikes) {
    const total = likes + dislikes;
    if (total === 0) return '0';
    const rating = (likes / total) * 10;
    return rating.toFixed(1);
  }

  /**
   * Convert duration to runtime string
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Runtime like "25 min"
   */
  static formatRuntime(durationMs) {
    if (!durationMs || durationMs === 0) return '';
    const minutes = Math.round(durationMs / 60000);
    return `${minutes} min`;
  }

  /**
   * Extract year from unix timestamp or date string
   * @param {number|string} releasedAt - Released at timestamp or date
   * @returns {string} Year
   */
  static extractYear(releasedAt) {
    if (!releasedAt) return '';
    
    if (typeof releasedAt === 'number') {
      // Unix timestamp
      return new Date(releasedAt * 1000).getFullYear().toString();
    }
    
    // ISO date string
    return new Date(releasedAt).getFullYear().toString();
  }

  /**
   * Build links array for Stremio meta
   * @param {Object} video - Hanime video object
   * @param {Array} genres - Array of genres
   * @returns {Array} Links array
   */
  static buildMetaLinks(video, genres) {
    const links = [];

    // Add rating link (using custom rating)
    if (video.likes || video.dislikes) {
      const rating = this.calculateRating(video.likes || 0, video.dislikes || 0);
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
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Object} Stremio meta object
   */
  static toStremioMeta(hanimeVideo, imageUrls, publicUrl) {
    if (!hanimeVideo) return null;

    const genres = hanimeVideo.hentai_tags 
      ? hanimeVideo.hentai_tags.map(tag => tag.text)
      : [];

    const capitalizedGenres = this.capitalizeGenres(genres);
    const runtime = this.formatRuntime(hanimeVideo.duration_in_ms);
    const year = this.extractYear(hanimeVideo.released_at_unix || hanimeVideo.released_at);
    const rating = this.calculateRating(hanimeVideo.likes || 0, hanimeVideo.dislikes || 0);
    const prefixedId = `${constants.addonPrefix}:${hanimeVideo.slug}`;

    return {
      id: prefixedId,
      name: hanimeVideo.name,
      type: constants.contentTypes.DEFAULT,
      poster: this.proxyURLById(prefixedId, 'poster', publicUrl),
      posterShape: 'poster',
      background: this.proxyURLById(prefixedId, 'background', publicUrl),
      description: this.cleanDescription(hanimeVideo.description),
      releaseInfo: year,
      runtime: runtime,
      genre: capitalizedGenres,
      genres: capitalizedGenres,
      director: hanimeVideo.brand ? [hanimeVideo.brand] : [],
      cast: [], // Hanime doesn't provide cast info
      imdbRating: rating,
      links: this.buildMetaLinks(hanimeVideo, capitalizedGenres),
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
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Object} Stremio series meta object
   */
  static toStremioSeriesMeta(seriesId, seriesName, episodes, imageUrls, publicUrl) {
    if (!episodes || episodes.length === 0) return null;

    const firstEpisode = episodes[0];
    
    // Use first episode for series-level data
    const genres = firstEpisode.tags && Array.isArray(firstEpisode.tags)
      ? this.capitalizeGenres(firstEpisode.tags)
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
      thumbnail: this.proxyURLById(`${prefixedSeriesId}:${ep.slug}`, 'poster', publicUrl),
      overview: this.cleanDescription(ep.description)
    }));

    return {
      id: prefixedSeriesId,
      name: seriesName,
      type: constants.contentTypes.Series,
      poster: this.proxyURLById(prefixedSeriesId, 'poster', publicUrl),
      posterShape: 'poster',
      background: this.proxyURLById(prefixedSeriesId, 'background', publicUrl),
      description: this.cleanDescription(firstEpisode.description),
      releaseInfo: this.extractYear(firstEpisode.released_at_unix || firstEpisode.released_at),
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

  /**
   * Transform Hanime search result to Stremio catalog item (regular videos)
   * @param {Object} catalog - Hanime catalog item
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Object} Stremio catalog item
   */
  static toStremioCatalogItem(catalog, publicUrl) {
    if (!catalog) return null;

    const genres = catalog.tags && Array.isArray(catalog.tags)
      ? this.capitalizeGenres(catalog.tags)
      : [];

    const slug = catalog.slug || '';
    const prefixedId = slug ? `${constants.addonPrefix}:${slug}` : '';

    return {
      id: prefixedId,
      name: catalog.name || '',
      poster: this.proxyURLById(prefixedId, 'poster', publicUrl),
      logo: config.addon.logo,
      genre: genres,
      description: this.cleanDescription(catalog.description),
      posterShape: 'poster',
      type: constants.contentTypes.DEFAULT,
      behaviorHints: { defaultVideoId: prefixedId }
    };
  }

  /**
   * Transform series item to Stremio catalog item
   * @param {Object} seriesItem - Series catalog item
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Object} Stremio series catalog item
   */
  static toStremioSeriesCatalogItem(seriesItem, publicUrl) {
    if (!seriesItem) return null;

    const genres = seriesItem.tags && Array.isArray(seriesItem.tags)
      ? this.capitalizeGenres(seriesItem.tags)
      : [];

    // Series items from SeriesService already have "series:" prefix, add "hanime:" prefix
    const originalId = seriesItem.slug || seriesItem.id || '';
    const prefixedId = originalId ? `${constants.addonPrefix}:${originalId}` : '';

    const item = {
      id: prefixedId,
      name: seriesItem.name || '',
      poster: this.proxyURLById(prefixedId, 'poster', publicUrl),
      background: this.proxyURLById(prefixedId, 'background', publicUrl),
      description: this.cleanDescription(seriesItem.description),
      posterShape: 'poster',
      type: constants.contentTypes.Series
    };

    // Add genres if available
    if (genres.length > 0) {
      item.genres = genres;
    }

    // Add episode count
    if (seriesItem.episodeCount) {
      item.description = `${seriesItem.episodeCount} Episodes\n\n${item.description}`;
    }

    return item;
  }

  /**
   * Transform array of Hanime results to Stremio catalog (regular videos)
   * @param {Array} hanimeResults - Array of Hanime search results
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Array} Array of Stremio catalog items
   */
  static toStremioCatalog(hanimeResults, publicUrl) {
    if (!Array.isArray(hanimeResults)) return [];
    
    return hanimeResults
      .map(item => this.toStremioCatalogItem(item, publicUrl))
      .filter(item => item !== null);
  }

  /**
   * Transform array of series items to Stremio catalog
   * @param {Array} seriesItems - Array of series catalog items
   * @param {string} publicUrl - Public server URL for proxying
   * @returns {Array} Array of Stremio series catalog items
   */
  static toStremioSeriesCatalog(seriesItems, publicUrl) {
    if (!Array.isArray(seriesItems)) return [];
    
    return seriesItems
      .map(item => this.toStremioSeriesCatalogItem(item, publicUrl))
      .filter(item => item !== null);
  }

  /**
   * Transform Hanime stream to Stremio stream object
   * @param {Object} stream - Hanime stream object
   * @returns {Object} Stremio stream object
   */
  static toStremioStream(stream) {
    if (!stream || !stream.url) return null;

    const groupName = stream.video_stream_group_id || '';
    const name = this.titleize(groupName.replace(/-/g, ' '));
    const durationMin = stream.duration_in_ms 
      ? (stream.duration_in_ms / 60000).toFixed(0)
      : '0';

    return {
      name: `Hanime.TV\n${stream.height || 0}p`,
      title: `${name.slice(0, -3)}\n 💾 ${stream.filesize_mbs || 0} MB ⌚ ${durationMin} min`,
      url: stream.url
    };
  }

  /**
   * Transform array of Hanime streams to Stremio streams
   * @param {Array} hanimeStreams - Array of Hanime stream objects
   * @param {Object} cacheConfig - Cache configuration
   * @returns {Object} Stremio streams response
   */
  static toStremioStreams(hanimeStreams, cacheConfig) {
    if (!Array.isArray(hanimeStreams)) {
      return { streams: [] };
    }

    const streams = hanimeStreams
      .map(stream => this.toStremioStream(stream))
      .filter(stream => stream !== null && stream.url && stream.url.trim() !== '');

    return {
      streams: streams,
      cacheMaxAge: cacheConfig.maxAge,
      staleError: cacheConfig.staleError
    };
  }
}

module.exports = TransformService;

