/**
 * Stream Service
 * Handles stream fetching for videos and series episodes
 */

const TransformService = require('./transform_service');
const logger = require('../logger');
const { cacheWrapStream } = require('../cache');
const { stripAddonPrefix } = require('../utils/formatters');

class StreamService {
  constructor(apiClient, config) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * Get streams for a video or series episode
   * @param {string} id - Full ID with prefix (e.g., "hanime:video-slug" or "hanime:series:base:episode-slug")
   * @returns {Promise<Object>} Streams object with streams array
   */
  async getStreams(id) {
    return cacheWrapStream(id, async () => {
      const strippedId = stripAddonPrefix(id);
      const videoId = this.extractVideoId(strippedId);

      if (!videoId) {
        logger.info('Stream requested for parent series ID - returning empty (episodes have streams)', { id, strippedId });
        return { streams: [] };
      }

      const streams = await this.apiClient.getVideoStreams(videoId);

      if (!streams || !Array.isArray(streams)) {
        logger.warn('Stream service: no streams returned', { 
          id, 
          videoId,
          resultType: typeof streams,
          isArray: Array.isArray(streams)
        });
        return { streams: [] };
      }

      const cacheConfig = {
        maxAge: this.config.cache.browserCache ? this.config.cache.maxAge : 0,
        staleError: this.config.cache.staleError
      };

      const response = TransformService.toStremioStreams(streams, cacheConfig);

      if (!response.streams || response.streams.length === 0) {
        return { streams: [] };
      }

      return response;
    });
  }

  /**
   * Extract video ID from stream request ID
   * Handles both regular video IDs and series episode IDs
   * @param {string} strippedId - ID without prefix (e.g., "video-slug" or "series:base:episode-slug")
   * @returns {string|null} Video slug or null if parent series ID
   */
  extractVideoId(strippedId) {
    if (strippedId.startsWith('series:')) {
      const parts = strippedId.split(':');
      if (parts.length === 3) {
        // Series episode format: "series:base:episode-slug"
        logger.debug('Parsed series episode ID', { strippedId, videoId: parts[2] });
        return parts[2]; // e.g., "imaria-5"
      } else if (parts.length === 2) {
        // Parent series ID: "series:base" - no streams for parent
        return null;
      }
    }

    // Regular video ID
    return strippedId;
  }
}

module.exports = StreamService;

