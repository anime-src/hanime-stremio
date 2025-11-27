/**
 * Hanime API Client
 * Encapsulates all HTTP communication with Hanime.tv APIs
 */

const axios = require('axios');
const logger = require('../logger');

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

    // Note: This client is for public/unauthenticated API calls only
    // Authenticated requests (streams) are handled by StreamService using UserApiManager
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get video data from API
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
      return await this._retryRequest(
        async () => {
          const response = await axios.get(url, {
            headers: this._getVideoHeaders(this.authority)
          });

          logger.info('Video API request details', JSON.stringify( {
            url,
            headers: this._getVideoHeaders(this.authority)
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
      return await this._retryRequest(
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

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get headers for video API requests
   * @private
   */
  _getVideoHeaders(authority) {
    return {
      'authority': authority,
      'accept': 'application/json, text/plain, */*',
      'origin': 'https://hanime.tv',
      'if-none-match': 'W/"a5e2787805920a8145ce33ab7c0fd947"'
    };
  }

  /**
   * Sleep utility for retry delays
   * @private
   */
  async _sleep(ms) {
    return sleep(ms);
  }

  /**
   * Generic retry wrapper with exponential backoff for 403 errors
   * @private
   * @param {Function} requestFn - Async function to execute
   * @param {Object} context - Context for logging (operation name, params)
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise} Result of the request function
   */
  async _retryRequest(requestFn, context = {}, maxRetries = 2) {
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

          await this._sleep(delay);
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
}

module.exports = HanimeApiClient;
