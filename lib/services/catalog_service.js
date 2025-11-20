/**
 * Catalog Service
 * Handles catalog data fetching, sorting, and pagination
 */

const constants = require('../constants');
const logger = require('../logger');
const { cacheWrapCatalog } = require('../cache');

class CatalogService {
  constructor(apiClient, config) {
    this.apiClient = apiClient;
    this.config = config;
  }

  /**
   * Build query parameters from catalog request
   */
  buildQueryParams(catalogId, extra = {}) {
    const queryParams = {
      query: '',
      tags: [],
      orderBy: 'created_at_unix',
      ordering: 'desc',
      page: 0
    };

    switch (catalogId) {
      case constants.catalogCategories.Hanime:
        // Let API decide ordering
        delete queryParams.orderBy;
        delete queryParams.ordering;
        break;
      case constants.catalogCategories.Mostlikes:
        queryParams.orderBy = 'likes';
        break;
      case constants.catalogCategories.Recent:
        queryParams.orderBy = 'created_at_unix';
        break;
      case constants.catalogCategories.Newset:
        queryParams.orderBy = 'released_at_unix';
        break;
      case constants.catalogCategories.MostViews:
        queryParams.orderBy = 'views';
        break;
    }

    if (extra) {
      queryParams.query = extra.search || '';
      queryParams.tags = extra.genre ? [extra.genre] : [];
      queryParams.page = extra.skip 
        ? Math.floor(extra.skip / this.config.pagination.itemsPerPage) 
        : 0;
    }

    return queryParams;
  }

  /**
   * Build cache key for catalog request
   */
  buildCacheKey(catalogId, extra = {}) {
    return `catalog:${catalogId}:${JSON.stringify(extra || {})}`;
  }

  /**
   * Get catalog data - fetches from API and caches results
   */
  async getCatalogData(catalogId, extra = {}) {
    const params = this.buildQueryParams(catalogId, extra);
    const cacheKey = this.buildCacheKey(catalogId, extra);
    
    return cacheWrapCatalog(cacheKey, async () => {
      const results = await this.apiClient.search(params);

      if (!results || !Array.isArray(results)) {
        logger.warn('Invalid API response', {
          catalogId,
          resultType: typeof results,
          isArray: Array.isArray(results)
        });
        return [];
      }

      if (results.length === 0) {
        return [];
      }

      return results;
    });
  }
}

module.exports = CatalogService;

