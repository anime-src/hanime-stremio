/**
 * Stream Handler
 * Handles stream requests for video playback
 */

const constants = require('../constants');
const TransformService = require('../services/transform_service');
const { isHanimeId } = require('../utils/formatters');

class StreamHandler {
  constructor(apiClient, cache, logger, config) {
    this.apiClient = apiClient;
    this.cache = cache;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Handle stream request
   */
  async handle(args) {
    try {
      const id = args.id;
      
      this.logger.debug('Stream handler called', { id, type: args.type });

      if (!id) {
        this.logger.warn('Stream handler called without ID');
        return { streams: [] };
      }

      // Reject non-Hanime IDs (e.g., IMDB IDs like tt37205655:1:3)
      if (!isHanimeId(id)) {
        this.logger.debug('Stream handler: ignoring non-Hanime ID', { id, type: args.type });
        return { streams: [] };
      }

      // Strip hanime: prefix if present
      const strippedId = id.startsWith(`${constants.addonPrefix}:`) 
        ? id.substring(constants.addonPrefix.length + 1) 
        : id;

      // Parse series episode IDs (format: series:imaria:imaria-5)
      let videoId = strippedId;
      if (strippedId.startsWith('series:')) {
        const parts = strippedId.split(':');
        if (parts.length === 3) {
          // Extract actual video slug from series episode ID
          videoId = parts[2]; // e.g., "imaria-5"
          this.logger.debug('Parsed series episode ID', { originalId: id, strippedId, videoId });
        } else if (parts.length === 2) {
          // This is just the parent series ID, no streams
          this.logger.info('Stream requested for parent series ID - returning empty (episodes have streams)', { id, strippedId });
          return { streams: [] };
        }
      }

      // Build cache key
      const cacheKey = `stream:${id}`;
      
      // Check cache if enabled
      if (this.cache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        this.logger.info('Stream served from cache', { id });
        return cached;
      }

      // Fetch from API using the actual video ID
      const streams = await this.apiClient.getVideoStreams(videoId);

      if (!streams || !Array.isArray(streams)) {
        this.logger.warn('Stream handler: no streams returned', { 
          id, 
          resultType: typeof streams,
          isArray: Array.isArray(streams)
        });
        return { streams: [] };
      }

      // Transform to Stremio format
      const cacheConfig = {
        maxAge: this.config.cache.browserCache ? this.config.cache.maxAge : 0,
        staleError: this.config.cache.staleError
      };
      const response = TransformService.toStremioStreams(streams, cacheConfig);

      this.logger.info('Stream handler success', { 
        id,
        videoId: videoId !== id ? videoId : undefined,
        streamsCount: response.streams.length,
        totalAvailable: streams.length,
        browserCacheEnabled: this.config.cache.browserCache
      });

      // Cache the response if cache is enabled
      if (this.cache) {
        this.cache.set(cacheKey, response);
      }

      return response;
    } catch (error) {
      this.logger.error('Stream handler error', { 
        id: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return { streams: [] };
    }
  }
}

module.exports = StreamHandler;

