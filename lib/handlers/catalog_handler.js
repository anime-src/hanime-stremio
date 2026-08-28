/**
 * Catalog Handler
 * Handles catalog requests for browsing content
 */

const constants = require('../constants');
const {
  toStremioCatalog,
  toStremioCatalogItem,
  toStremioSeriesCatalog,
  toStremioSeriesCatalogItem
} = require('../transformers/catalog_transformer');
const { getSeriesCatalogItems, getSeriesAwareCatalogItems } = require('../utils/series_utils');
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

    // Tags forced by the catalog id (merged with user-selected genre)
    this.catalogForcedTags = {
      [constants.catalogCategories.UNCENSORED]: ['uncensored']
    };

    // Lookup set for brand routing in the genre dropdown
    this.brandSet = new Set(constants.brands);
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
      } else if (args.id === constants.catalogCategories.UNCENSORED) {
        const start = Number.isFinite(Number(args.extra?.skip))
          ? Math.max(0, Number(args.extra.skip))
          : 0;
        metas = results
          .slice(start, start + this.config.pagination.itemsPerPage)
          .map(({ isSeries, item }) => isSeries
            ? toStremioSeriesCatalogItem(item)
            : toStremioCatalogItem(item, constants.contentTypes.SERIES));
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
    // The genre dropdown holds genres + a separator + brands. Route the
    // selection to the correct API field (separator = no filter).
    const selection = extra.genre;
    const isSeparator = selection === constants.genreBrandSeparator;
    const isBrand = !!selection && !isSeparator && this.brandSet.has(selection);
    const userTags = (selection && !isSeparator && !isBrand) ? [selection] : [];
    const brands = isBrand ? [selection] : [];

    const forcedTags = this.catalogForcedTags[catalogId] || [];
    const tags = Array.from(new Set([...forcedTags, ...userTags]));

    const queryParams = {
      query: extra.search || '',
      tags,
      brands,
      page: catalogId === constants.catalogCategories.UNCENSORED
        ? 0
        : (extra.skip ? Math.floor(extra.skip / this.config.pagination.itemsPerPage) : 0),
      paginate: catalogId !== constants.catalogCategories.UNCENSORED
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
    const cacheExtra = { ...extra };
    if (catalogId === constants.catalogCategories.UNCENSORED) {
      delete cacheExtra.skip;
    }

    const extraParams = Object.keys(cacheExtra).length > 0
      ? Object.keys(cacheExtra).sort().map(key => `${key}=${cacheExtra[key]}`).join('&')
      : '';
    const cacheKey = extraParams ? `${catalogId}:${extraParams}` : catalogId;

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

      return catalogId === constants.catalogCategories.UNCENSORED
        ? getSeriesAwareCatalogItems(results)
        : results;
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
