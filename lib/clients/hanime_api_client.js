/**
 * Hanime API Client
 * Encapsulates all HTTP communication with Hanime.tv APIs
 */

const axios = require('axios');
const { getAppSignature } = require('@nekolab/hanime/dist/modules/crypto');
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
    this.searchUrl = config.api.searchUrl;
    this.relaySecret = config.api.htv?.relaySecret || null;
    this.defaultDurationMs = config.api.defaultDurationMs || 20 * 60 * 1000;
    this.searchPageSize = config.pagination?.itemsPerPage || 48;
    this.searchDatasetCache = {
      data: null,
      fetchedAt: 0
    };
    this.searchDatasetTtlMs = (config.cache?.ttl?.searchDataset || 6 * 60 * 60) * 1000;
    this.searchDatasetPending = null;

    this.searchHeaders = {
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
   * Get video data from the shared search dataset.
   * @param {string} slug - Video slug/ID
   * @returns {Promise<Object|null>} Video data object or null
   */
  async getVideoData(slug) {
    if (!slug) {
      logger.warn('getVideoData called without slug');
      return null;
    }

    const dataset = await this._getSearchDataset();
    const video = dataset.find(item => item && item.slug === slug);
    if (!video) return null;

    return {
      hentai_video: {
        ...video,
        duration_in_ms: this.defaultDurationMs,
        duration_estimated: true,
        hentai_tags: (Array.isArray(video.tags) ? video.tags : [])
          .map(text => ({ text }))
      }
    };
  }

  /**
   * Search for videos with retry logic for 403 errors
   * @param {Object} params - Search parameters
   * @param {number} maxRetries - Maximum number of retries (default: 2)
   * @returns {Promise<Array>} Array of video results
   */
  async search({ query = '', tags = [], brands = [], orderBy = 'created_at_unix', ordering = 'desc', page = 0, paginate = true }, maxRetries = 2) {
    try {
      return await this._retryRequest(
        async () => {
          const dataset = await this._getSearchDataset();
          const filteredResults = this._filterSearchResults(dataset, { query, tags, brands });
          const sortedResults = this._sortSearchResults(filteredResults, orderBy, ordering);
          const results = paginate
            ? this._paginateSearchResults(sortedResults, page)
            : sortedResults;

          logger.debug('Hanime search dataset success', {
            datasetCount: dataset.length,
            filteredCount: filteredResults.length,
            resultsCount: results.length
          });

          return results;
        },
        {
          operation: 'Search API',
          params: { query, tagsCount: tags.length, brandsCount: brands.length, page }
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
   * Get the current Hanime search dataset.
   * Hanime's frontend now fetches the full dataset and filters client-side.
   * @private
   */
  async _getSearchDataset() {
    const now = Date.now();
    const cached = this.searchDatasetCache.data;

    if (cached && now - this.searchDatasetCache.fetchedAt < this.searchDatasetTtlMs) {
      return cached;
    }

    // Single-flight: on a cold start or after TTL expiry, many catalog
    // requests can arrive at once. Without coalescing, each would fetch the
    // full dataset (and each retry the same 403 backoff) independently. Share
    // one in-flight fetch across all concurrent callers.
    if (this.searchDatasetPending) {
      return this.searchDatasetPending;
    }

    this.searchDatasetPending = this._fetchSearchDataset(now)
      .finally(() => { this.searchDatasetPending = null; });

    return this.searchDatasetPending;
  }

  /**
   * Fetch and cache the search dataset. Serves the last good dataset if the
   * upstream fetch fails, so a transient blip doesn't empty every catalog.
   * @private
   */
  async _fetchSearchDataset(now) {
    const lastGood = this.searchDatasetCache.data;
    try {
      const response = await axios.get(this.searchUrl, {
        headers: this._getSearchHeaders(),
        timeout: 20000
      });

      if (response.status !== 200 || !response.data) {
        logger.warn('Hanime search dataset non-200 status', { status: response.status });
        return lastGood || [];
      }

      const dataset = this._normalizeSearchDataset(response.data);

      this.searchDatasetCache = {
        data: dataset,
        fetchedAt: now
      };

      return dataset;
    } catch (error) {
      logger.warn('Hanime search dataset fetch failed', { error: error.message });
      return lastGood || [];
    }
  }

  /**
   * Build the current app2 signature required by Hanime's search dataset.
   * @private
   */
  _getSearchHeaders() {
    const claim = Math.floor(Date.now() / 1000);
    const headers = {
      ...this.searchHeaders,
      'x-claim': String(claim),
      'x-signature-version': 'app2',
      'x-signature': getAppSignature(claim),
      'x-session-token': ''
    };
    if (this.relaySecret) headers.authorization = `Bearer ${this.relaySecret}`;
    return headers;
  }

  /**
   * Normalize current and legacy search payload shapes.
   * @private
   */
  _normalizeSearchDataset(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.data)) {
      return data.data;
    }

    if (data && typeof data.hits === 'string') {
      try {
        const hits = JSON.parse(data.hits);
        return Array.isArray(hits) ? hits : [];
      } catch (error) {
        logger.warn('Failed to parse search hits', { error: error.message });
        return [];
      }
    }

    if (data && Array.isArray(data.hits)) {
      return data.hits;
    }

    return [];
  }

  /**
   * Apply query, tag, and brand filters to the search dataset.
   * @private
   */
  _filterSearchResults(dataset, { query = '', tags = [], brands = [] }) {
    if (!Array.isArray(dataset)) return [];

    const normalizedQuery = this._normalizeString(query);
    const queryTerms = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];
    const normalizedTags = tags.map(tag => this._normalizeString(tag)).filter(Boolean);
    const normalizedBrands = brands.map(brand => this._normalizeString(brand)).filter(Boolean);

    return dataset.filter(item => {
      if (!item || !item.slug) return false;

      if (queryTerms.length > 0) {
        const searchText = this._normalizeString([
          item.name,
          item.search_titles,
          item.description,
          Array.isArray(item.tags) ? item.tags.join(' ') : ''
        ].filter(Boolean).join(' '));

        if (!queryTerms.every(term => searchText.includes(term))) {
          return false;
        }
      }

      if (normalizedTags.length > 0) {
        const itemTags = new Set((Array.isArray(item.tags) ? item.tags : [])
          .map(tag => this._normalizeString(tag)));

        if (!normalizedTags.every(tag => itemTags.has(tag))) {
          return false;
        }
      }

      if (normalizedBrands.length > 0) {
        const itemBrand = this._normalizeString(item.brand);
        if (!normalizedBrands.includes(itemBrand)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort search results by requested field and direction.
   * @private
   */
  _sortSearchResults(results, orderBy = 'created_at_unix', ordering = 'desc') {
    const direction = ordering === 'asc' ? 1 : -1;

    return [...results].sort((a, b) => {
      const aValue = this._getSortableValue(a, orderBy);
      const bValue = this._getSortableValue(b, orderBy);

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }

  /**
   * Return a single page of results.
   * @private
   */
  _paginateSearchResults(results, page = 0) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 0;
    const start = safePage * this.searchPageSize;
    return results.slice(start, start + this.searchPageSize);
  }

  /**
   * Normalize user-facing text for local matching.
   * @private
   */
  _normalizeString(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Return sortable values with timestamp aliases for the current dataset.
   * @private
   */
  _getSortableValue(item, field) {
    if (!item) return '';

    const value = item[field];
    if (value !== undefined && value !== null) {
      return typeof value === 'string' ? value.toLowerCase() : value;
    }

    if (field === 'created_at_unix' && item.created_at) {
      return Date.parse(item.created_at) || 0;
    }

    if (field === 'released_at_unix' && item.released_at) {
      return Date.parse(item.released_at) || 0;
    }

    return '';
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
