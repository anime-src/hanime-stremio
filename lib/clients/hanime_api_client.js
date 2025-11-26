/**
 * Hanime API Client
 * Encapsulates all HTTP communication with Hanime.tv APIs
 */

const axios = require('axios');
const logger = require('../logger');
const HanimeUserApi = require('./hanime_user_api_client');

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class HanimeApiClient {
  constructor(config) {
    this.authority = config.api.authority;
    this.defaultAuthority = config.api.defaultAuthority;
    this.manifestAuthority = config.api.manifestAuthority;
    this.searchUrl = config.api.searchUrl;
    this.baseUrl = `https://${this.authority}`;

    this.searchHeaders = {
      'authority': 'search.htv-services.com',
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      'origin': 'https://hanime.tv',
      'referer': 'https://hanime.tv/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Initialize user API client for authenticated requests
    this.userApi = null;
    this.userApiInitialized = false;
    this.userApiInitPromise = null;

    // Initialize user API if credentials are provided
    if (config.api.user && config.api.user.email && config.api.user.password) {
      this.userApiInitPromise = this.initializeUserApi(config.api.user.email, config.api.user.password);
    } else {
      logger.warn('Hanime user credentials not provided - authenticated video streams may not work');
    }
  }

  /**
   * Initialize the user API client with login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<void>}
   */
  async initializeUserApi(email, password) {
    // If already initialized, return immediately
    if (this.userApiInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.userApiInitPromise) {
      try {
        await this.userApiInitPromise;
        return;
      } catch (error) {
        // If previous initialization failed, continue to try again
        this.userApiInitPromise = null;
      }
    }

    // Start new initialization and store the promise
    const initPromise = (async () => {
      try {
        // Pass credentials to constructor so auto-refresh can work
        this.userApi = new HanimeUserApi(null, email, password);
        const loginResult = await this.userApi.login(email, password);
        this.userApiInitialized = true;
        logger.info('Hanime user API initialized successfully', {
          email: email.substring(0, 3) + '***', // Log partial email for privacy
          isPremium: loginResult.user.isPremium,
          expiresAt: new Date(loginResult.sessionTokenExpireTimeUnix * 1000).toISOString()
        });
      } catch (error) {
        logger.error('Failed to initialize Hanime user API', {
          error: error.message
        });
        this.userApi = null;
        throw error;
      } finally {
        // Clear promise after completion (success or failure)
        this.userApiInitPromise = null;
      }
    })();

    // Store the promise so concurrent calls can wait for it
    this.userApiInitPromise = initPromise;

    // Wait for the initialization to complete
    await initPromise;
  }

  /**
   * Ensure user API is initialized before use
   * @returns {Promise<boolean>} True if user API is available
   */
  async ensureUserApi() {
    if (this.userApiInitialized && this.userApi) {
      return true;
    }

    if (this.userApiInitPromise) {
      try {
        await this.userApiInitPromise;
        return this.userApi !== null;
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   * Get headers for video API requests
   */
  getVideoHeaders(authority) {
    return {
      'authority': authority,
      'accept': 'application/json, text/plain, */*',
      'origin': 'https://hanime.tv',
      'if-none-match': 'W/"a5e2787805920a8145ce33ab7c0fd947"'
    };
  }

  /**
   * Get headers for manifest API requests
   */
  getManifestHeaders(authority) {
    const xTime = Math.floor(Date.now() / 1000); // Current Unix timestamp

    return {
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
      'x-signature': '3fbdf23a0da374c3421fb6594190adbf76265d06948545e17728c0ee3c9705a7',
      'x-signature-version': 'web2',
      'x-time': xTime.toString(),
      'origin': `https://${authority}`,
      'referer': `https://${authority}/`
    };
  }

  /**
   * Sleep utility for retry delays
   */
  async sleep(ms) {
    return sleep(ms);
  }

  /**
   * Generic retry wrapper with exponential backoff for 403 errors
   * @param {Function} requestFn - Async function to execute
   * @param {Object} context - Context for logging (operation name, params)
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise} Result of the request function
   */
  async retryRequest(requestFn, context = {}, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`${context.operation} request`, {
          ...context.params,
          attempt: attempt + 1
        });

        return await requestFn();
      } catch (error) {
        const status = error.response?.status;

        if (status === 403 && attempt < maxRetries) {
          const backoffDelay = [2000, 5000, 10000][attempt] || 10000; // 2s, 5s, 10s
          const jitter = Math.random() * 1000; // Add 0-1s jitter
          const delay = backoffDelay + jitter;

          logger.debug(`${context.operation} 403, retrying with backoff`, {
            ...context.params,
            attempt: attempt + 1,
            delay: `${Math.round(delay)}ms`
          });

          await this.sleep(delay);
          continue;
        }

        if (status === 403) {
          logger.debug(`${context.operation} 403 (likely blocked)`, {
            ...context.params,
            attempt: attempt + 1
          });
        } else {
          logger.error(`${context.operation} error`, {
            ...context.params,
            error: error.message,
            status,
            attempt: attempt + 1
          });
        }

        throw error;
      }
    }
  }

  /**
   * Get video data from API (shared method for getVideo and getVideoStreams)
   * @param {string} slug - Video slug/ID
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Object|null>} Video data object or null
   */
  async getVideoData(slug, maxRetries = 2) {
    if (!slug) {
      logger.warn('getVideoData called without slug');
      return null;
    }

    const url = `${this.baseUrl}/api/v8/video?id=${slug}&`;

    try {
      return await this.retryRequest(
        async () => {
          const response = await axios.get(url, {
            headers: this.getVideoHeaders(this.authority)
          });

          logger.info('Video API request details', JSON.stringify( {
            url,
            headers: this.getVideoHeaders(this.authority)
          }));

          if (response.status === 200 && response.data) {
            return response.data;
          }

          logger.warn('Hanime video API: no data', { slug, status: response.status });
          return null;
        },
        {
          operation: 'Video API',
          params: { slug }
        },
        maxRetries
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Search for videos with retry logic for 403 errors
   * @param {Object} params - Search parameters
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Array>} Array of video results
   */
  async search({ query = '', tags = [], orderBy = 'created_at_unix', ordering = 'desc', page = 0 }, maxRetries = 2) {
    const body = {
      search_text: query,
      tags: tags,
      tags_mode: 'AND',
      brands: [],
      blacklist: [],
      order_by: orderBy,
      ordering: ordering,
      page: page
    };

    try {
      return await this.retryRequest(
        async () => {
          const response = await axios.post(this.searchUrl, body, {
            headers: this.searchHeaders
          });

          if (response.status === 200 && response.data) {
            const hits = JSON.parse(response.data.hits || '[]');
            logger.debug('Hanime search API success', { resultsCount: hits.length });
            return Array.isArray(hits) ? hits : [];
          }

          logger.warn('Hanime search API non-200 status', { status: response.status });
          return [];
        },
        {
          operation: 'Search API',
          params: { query, tagsCount: tags.length, page }
        },
        maxRetries
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get video metadata by slug with retry logic for 403 errors
   * @param {string} slug - Video slug/ID
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Object|null>} Video metadata or null
   */
  async getVideo(slug, maxRetries = 2) {
    const data = await this.getVideoData(slug, maxRetries);

    if (data?.hentai_video) {
      logger.debug('Hanime video API success', {
        slug,
        name: data.hentai_video.name
      });
      return data.hentai_video;
    }

    return null;
  }

  /**
   * Get video streams by slug with retry logic for 403 errors
   * Uses authenticated user API to get video streams
   * @param {string} slug - Video slug/ID
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Array>} Array of stream objects
   */
  async getVideoStreams(slug, maxRetries = 2) {
    // Ensure user API is initialized
    const userApiAvailable = await this.ensureUserApi();
    if (!userApiAvailable) {
      logger.warn('User API not available, falling back to unauthenticated method', { slug });
      return this.getVideoStreamsFallback(slug, maxRetries);
    }

    // Get video data to extract video ID
    const data = await this.getVideoData(slug, maxRetries);

    if (!data) {
      logger.warn('Failed to fetch video data', { slug });
      return [];
    }

    // Extract video ID from hentai_video
    const videoId = data.hentai_video?.id;
    if (!videoId) {
      logger.error('Video ID not found in video data', {
        slug,
        hasHentaiVideo: !!data.hentai_video
      });
      return [];
    }

    try {
      // Use authenticated user API to get video details with streams
      const videoDetails = await this.userApi.getVideoDetails(videoId);

      if (!videoDetails || !videoDetails.streams || !Array.isArray(videoDetails.streams)) {
        logger.warn('No streams returned from user API', {
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

      if (logger.isEnabled('info')) {
        logger.info('Video streams retrieved via user API', {
          slug,
          videoId,
          streamsCount: streams.length
        });

        // Log stream details
        const validStreams = streams.filter(s => s.url && s.url.trim() !== '');
        logger.info('Stream summary', {
          total: streams.length,
          valid: validStreams.length,
          resolutions: streams.map(s => `${s.height || '?'}p`).join(', ')
        });
      }

      return streams;
    } catch (error) {
      logger.error('Failed to fetch video streams via user API', {
        slug,
        videoId,
        error: error.message
      });
      // Fallback to unauthenticated method
      return this.getVideoStreamsFallback(slug, maxRetries);
    }
  }

  /**
   * Fallback method to get video streams using unauthenticated manifest API
   * @param {string} slug - Video slug/ID
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Array>} Array of stream objects
   */
  async getVideoStreamsFallback(slug, maxRetries = 2) {
    const data = await this.getVideoData(slug, maxRetries);

    if (!data) {
      logger.warn('Failed to fetch video data (fallback)', { slug });
      return [];
    }

    // Extract video ID from hentai_video
    const videoId = data.hentai_video?.id;
    if (!videoId) {
      logger.error('Video ID not found in video data (fallback)', {
        slug,
        hasHentaiVideo: !!data.hentai_video
      });
      return [];
    }

    // Fetch manifest from new API endpoint
    const manifestUrl = `https://${this.manifestAuthority}/api/v8/guest/videos/${videoId}/manifest`;

    try {
      const manifest = await this.retryRequest(
        async () => {
          const headers = this.getManifestHeaders(this.authority);
          const response = await axios.get(manifestUrl, {
            headers: headers
          });

          logger.debug('Manifest API request details (fallback)', {
            url: manifestUrl,
            headers: headers
          });
          logger.debug('Manifest API response (fallback)', JSON.stringify(response.data));

          if (response.status === 200 && response.data) {
            return response.data;
          }

          logger.warn('Manifest API: no data (fallback)', { videoId, status: response.status });
          return null;
        },
        {
          operation: 'Manifest API (fallback)',
          params: { slug, videoId }
        },
        maxRetries
      );

      const videosManifest = manifest?.videos_manifest;
      if (!videosManifest || !videosManifest.servers || !videosManifest.servers[0]) {
        logger.error('Invalid video manifest structure (fallback)', {
          slug,
          videoId,
          hasManifest: !!manifest,
          hasVideosManifest: !!videosManifest,
          hasServers: !!videosManifest?.servers,
          serversCount: videosManifest?.servers?.length || 0
        });
        return [];
      }

      const streams = videosManifest.servers[0].streams || [];

      if (logger.isEnabled('info')) {
        logger.info('Video streams retrieved (fallback)', { slug, videoId, streamsCount: streams.length });

        // Log stream details
        const validStreams = streams.filter(s => s.url && s.url.trim() !== '');
        logger.info('Stream summary (fallback)', {
          total: streams.length,
          valid: validStreams.length,
          resolutions: streams.map(s => `${s.height || '?'}p`).join(', ')
        });
      }

      return streams;
    } catch (error) {
      logger.error('Failed to fetch video manifest (fallback)', {
        slug,
        videoId,
        error: error.message,
        status: error.response?.status
      });
      return [];
    }
  }
}

module.exports = HanimeApiClient;
