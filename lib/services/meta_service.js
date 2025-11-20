/**
 * Meta Service
 * Handles metadata fetching for videos and series
 */

const { toStremioMeta, toStremioSeriesMeta } = require('../transformers/meta_transformer');
const { getSeriesEpisodes, parseEpisodeInfo } = require('../utils/series_utils');
const logger = require('../logger');
const constants = require('../constants');
const { cacheWrapMeta } = require('../cache');
const { stripAddonPrefix } = require('../utils/formatters');

class MetaService {
  constructor(apiClient, config) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * Extract image URLs from a video object
   * @param {Object} hanimeVideo - Hanime video object from API
   * @returns {Object} Image URLs object { poster, background }
   */
  extractImageUrls(hanimeVideo) {
    if (!hanimeVideo) {
      return { poster: '', background: '' };
    }

    const poster = hanimeVideo.cover_url || hanimeVideo.poster_url || '';
    const background = hanimeVideo.poster_url || hanimeVideo.cover_url || '';

    return { poster, background };
  }

  /**
   * Get metadata for a video or series
   * @param {string} id - Full ID with prefix (e.g., "hanime:video-slug" or "hanime:series:series-slug")
   * @returns {Promise<Object|null>} Meta object or null
   */
  async getMetaData(id) {
    return cacheWrapMeta(id, async () => {
      const strippedId = stripAddonPrefix(id);
      const isSeries = strippedId.startsWith('series:');

      if (isSeries) {
        return await this.getSeriesMeta(strippedId);
      } else {
        return await this.getVideoMeta(strippedId);
      }
    });
  }

  /**
   * Get video metadata
   * @param {string} strippedId - Video slug without prefix
   * @returns {Promise<Object|null>} Video meta or null
   */
  async getVideoMeta(strippedId) {
    const video = await this.apiClient.getVideo(strippedId);

    if (!video) {
      logger.warn('Meta service: no video data returned', { strippedId });
      return null;
    }

    // Extract image URLs from video (will be stored in meta._cdnUrls)
    const imageUrls = this.extractImageUrls(video);

    const meta = toStremioMeta(video, imageUrls);

    if (!meta) {
      logger.warn('Meta service: video transformation failed', { strippedId });
      return null;
    }

    return meta;
  }

  /**
   * Get series metadata by searching and grouping episodes
   * @param {string} seriesId - Series ID (e.g., "series:mujin-eki")
   * @returns {Promise<Object|null>} Series meta or null
   */
  async getSeriesMeta(seriesId) {
    try {
      const baseSlug = seriesId.replace(/^series:/, '');
      const searchTerm = baseSlug.replace(/-/g, ' '); // e.g., "mujin-eki" -> "mujin eki"
      
      const allVideos = await this.apiClient.search({
        query: searchTerm,
        tags: [],
        orderBy: 'created_at_unix',
        ordering: 'desc',
        page: 0
      });

      if (!allVideos || allVideos.length === 0) {
        logger.warn('Series meta: no videos found', { seriesId, searchTerm });
        return null;
      }

      const episodes = getSeriesEpisodes(allVideos, baseSlug);

      if (!episodes || episodes.length === 0) {
        logger.warn('Series meta: no episodes found', { 
          seriesId, 
          baseSlug, 
          searchTerm,
          searchResultsCount: allVideos.length 
        });
        return null;
      }

      const episodeInfo = parseEpisodeInfo(episodes[0].name);
      const seriesName = episodeInfo ? episodeInfo.baseName : episodes[0].name;
      
      // Extract image URLs from first episode (will be stored in meta._cdnUrls)
      const imageUrls = this.extractImageUrls(episodes[0]);

      const meta = toStremioSeriesMeta(
        seriesId,
        seriesName,
        episodes,
        imageUrls
      );

      logger.info('Series meta created', { 
        seriesId, 
        seriesName,
        episodeCount: episodes.length 
      });

      return meta;
    } catch (error) {
      logger.error('Series meta error', { 
        seriesId, 
        error: error.message 
      });
      return null;
    }
  }
}

module.exports = MetaService;

