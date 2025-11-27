const { isHanimeId, stripAddonPrefix } = require('../utils/formatters');
const { toStremioStreams } = require('../transformers/stream_transformer');
const { cacheWrapStream } = require('../cache');
const { emptyResponse } = require('./response_helpers');

class StreamHandler {
  constructor(apiClient, logger, config, userApiManager) {
    this.logger = logger;
    this.config = config;
    this.userApiManager = userApiManager;
    this.apiClient = apiClient;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  async handle(args) {
    try {
      const id = args.id;

      if (!id) {
        this.logger.warn('Stream handler called without ID');
        return emptyResponse('stream');
      }

      if (!isHanimeId(id)) {
        return emptyResponse('stream');
      }

      // Extract and validate user credentials from addon configuration
      const userConfig = args.config || {};
      const email = userConfig.email;
      const password = userConfig.password;

      if (!email || !password) {
        this.logger.error('Stream handler: email and password are required', {
          hasEmail: !!email,
          hasPassword: !!password
        });
        throw new Error('Email and password are required. Please configure the addon with your Hanime credentials.');
      }

      // Get authenticated user API instance from manager
      let userApi;
      try {
        userApi = await this.userApiManager.getUserApi(email, password);
      } catch (error) {
        this.logger.error('Stream handler: failed to get user API', {
          error: error.message,
          emailPrefix: email.substring(0, 3) + '***'
        });
        throw new Error('Failed to authenticate with provided credentials. Please check your email and password.');
      }

      // Get streams using authenticated user API
      const streams = await this._getStreams(id, userApi);

      return {
        ...streams,
        cacheMaxAge: this.config.cache.ttl.stream, // 36 hours in seconds
        staleRevalidate: 600 // 10 minutes
      };
    } catch (error) {
      this.logger.error('Stream handler error', {
        id: args.id,
        error: error.message,
        stack: error.stack
      });
      return emptyResponse('stream');
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get video streams using authenticated user API
   * @private
   * @param {string} slug - Video slug/ID
   * @param {Object} userApi - Authenticated user API instance
   * @returns {Promise<Array>} Array of stream objects
   */
  async _getVideoStreams(slug, userApi) {
    // Get video data to extract video ID (using public API)
    const data = await this.apiClient.getVideoData(slug);

    if (!data) {
      this.logger.warn('Failed to fetch video data', { slug });
      return [];
    }

    // Extract video ID from hentai_video
    const videoId = data.hentai_video?.id;
    if (!videoId) {
      this.logger.error('Video ID not found in video data', {
        slug,
        hasHentaiVideo: !!data.hentai_video
      });
      return [];
    }

    try {
      // Use authenticated user API to get video details with streams
      const videoDetails = await userApi.getVideoDetails(videoId);

      if (!videoDetails || !videoDetails.streams || !Array.isArray(videoDetails.streams)) {
        this.logger.warn('No streams returned from user API', {
          slug,
          videoId,
          hasVideoDetails: !!videoDetails,
          streamsCount: videoDetails?.streams?.length || 0
        });
        return [];
      }

      // Transform streams from user API format to expected format
      const streams = videoDetails.streams.map(stream => ({
        url: stream.url,
        height: stream.height,
        width: stream.width,
        duration_in_ms: stream.duration,
        filesize_mbs: stream.fileSize,
        mime_type: stream.mimeType,
        extension: stream.extension,
        video_stream_group_id: `${stream.serverName}-${stream.serverId}`,
        is_guest_allowed: stream.isGuestAllowed,
        is_member_allowed: stream.isMemberAllowed,
        is_premium_allowed: stream.isPremiumAllowed,
        is_downloadable: stream.isDownloadable
      })).filter(stream => stream.url && stream.url.trim() !== '');

      if (this.logger.isEnabled('info')) {
        this.logger.info('Video streams retrieved via user API', {
          slug,
          videoId,
          streamsCount: streams.length
        });

        // Log stream details
        const validStreams = streams.filter(s => s.url && s.url.trim() !== '');
        this.logger.info('Stream summary', {
          total: streams.length,
          valid: validStreams.length,
          resolutions: streams.map(s => `${s.height || '?'}p`).join(', ')
        });
      }

      return streams;
    } catch (error) {
      this.logger.error('Failed to fetch video streams via user API', {
        slug,
        videoId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract video ID from stream request ID
   * Handles both regular video IDs and series episode IDs
   * @private
   * @param {string} strippedId - ID without prefix (e.g., "video-slug" or "series:base:episode-slug")
   * @returns {string|null} Video slug or null if parent series ID
   */
  _extractVideoId(strippedId) {
    if (strippedId.startsWith('series:')) {
      const parts = strippedId.split(':');
      if (parts.length === 3) {
        // Series episode format: "series:base:episode-slug"
        this.logger.debug('Parsed series episode ID', { strippedId, videoId: parts[2] });
        return parts[2]; // e.g., "imaria-5"
      } else if (parts.length === 2) {
        // Parent series ID: "series:base" - no streams for parent
        return null;
      }
    }

    // Regular video ID
    return strippedId;
  }

  /**
   * Get streams for a video or series episode
   * @private
   * @param {string} id - Full ID with prefix (e.g., "hanime:video-slug" or "hanime:series:base:episode-slug")
   * @param {Object} userApi - Required authenticated user API instance
   * @returns {Promise<Object>} Streams object with streams array
   */
  async _getStreams(id, userApi) {
    if (!userApi) {
      throw new Error('User API is required for stream requests');
    }

    return cacheWrapStream(id, async () => {
      const strippedId = stripAddonPrefix(id);
      const videoId = this._extractVideoId(strippedId);

      if (!videoId) {
        this.logger.info('Stream requested for parent series ID - returning empty (episodes have streams)', { id, strippedId });
        return emptyResponse('stream');
      }

      // Use authenticated API
      const streams = await this._getVideoStreams(videoId, userApi);

      if (!streams || !Array.isArray(streams)) {
        this.logger.warn('Stream handler: no streams returned', {
          id,
          videoId,
          resultType: typeof streams,
          isArray: Array.isArray(streams)
        });
        return emptyResponse('stream');
      }

      const cacheConfig = {
        maxAge: this.config.cache.browserCacheMaxAge,
        staleError: 6 * 30 * 24 * 60 * 60 // 6 months in seconds
      };

      const response = toStremioStreams(streams, cacheConfig);

      if (!response.streams || response.streams.length === 0) {
        return emptyResponse('stream');
      }

      return response;
    });
  }
}

module.exports = StreamHandler;
