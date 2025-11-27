/**
 * Catalog Handler
 * Handles catalog requests for browsing content
 */

const constants = require('../constants');
const { toStremioCatalog, toStremioSeriesCatalog } = require('../transformers/catalog_transformer');
const { getSeriesCatalogItems } = require('../utils/series_utils');
const { cacheWrapCatalog } = require('../cache');
const { emptyResponse } = require('./response_helpers');

class CatalogHandler {
  constructor(apiClient, logger, config) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.config = config;
    this.validCatalogIds = Object.values(constants.catalogCategories);

    // Catalog ordering lookup
    this.catalogOrdering = {
      [constants.catalogCategories.MOST_LIKES]: 'likes',
      [constants.catalogCategories.RECENT]: 'created_at_unix',
      [constants.catalogCategories.NEWEST]: 'released_at_unix',
      [constants.catalogCategories.MOST_VIEWS]: 'views'
    };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Handle catalog request
   */
  async handle(args) {
    try {
      if (!this._isValidCatalogRequest(args)) {
        return emptyResponse('catalog');
      }

      const results = await this._getCatalogData(args.id, args.extra);

      if (!results || results.length === 0) {
        this.logger.warn('Catalog handler: no results', { catalogId: args.id });
        return emptyResponse('catalog');
      }

      // Transform based on catalog type
      let metas;
      if (args.id === constants.catalogCategories.SERIES) {
        const seriesItems = getSeriesCatalogItems(results);
        metas = toStremioSeriesCatalog(seriesItems);
      } else {
        metas = toStremioCatalog(results);
      }

      return { metas, ...this._getCacheSettings() };
    } catch (error) {
      this.logger.error('Catalog handler error', {
        catalogId: args.id,
        error: error.message,
        stack: error.stack
      });
      return emptyResponse('catalog');
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if catalog request is for this addon
   * @private
   */
  _isValidCatalogRequest(args) {
    if (!args.id) return false;
    return this.validCatalogIds.includes(args.id);
  }

  /**
   * Build query parameters from catalog request
   * @private
   */
  _buildQueryParams(catalogId, extra = {}) {
    const queryParams = {
      query: extra.search || '',
      tags: extra.genre ? [extra.genre] : [],
      page: extra.skip ? Math.floor(extra.skip / this.config.pagination.itemsPerPage) : 0
    };

    // Add ordering if catalog has specific sort
    const orderBy = this.catalogOrdering[catalogId];
    if (orderBy) {
      queryParams.orderBy = orderBy;
      queryParams.ordering = 'desc';
    }

    return queryParams;
  }

  /**
   * Get catalog data - fetches from API and caches results
   * @private
   */
  async _getCatalogData(catalogId, extra = {}) {
    const params = this._buildQueryParams(catalogId, extra);
    const cacheKey = `catalog:${catalogId}:${JSON.stringify(extra || {})}`;

    return cacheWrapCatalog(cacheKey, async () => {
      const results = await this.apiClient.search(params);

      if (!results || !Array.isArray(results)) {
        this.logger.warn('Invalid API response', {
          catalogId,
          resultType: typeof results,
          isArray: Array.isArray(results)
        });
        return [];
      }

      return results;
    });
  }

  /**
   * Get cache settings for catalog responses
   * @private
   */
  _getCacheSettings() {
    return {
      cacheMaxAge: this.config.cache.ttl.catalog, // 2 hours in seconds
      staleRevalidate: 600 // 10 minutes
    };
  }
}

module.exports = CatalogHandler;
