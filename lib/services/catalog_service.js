/**
 * Catalog Service
 * Handles catalog data fetching, sorting, and pagination
 * Uses prefetched data if available, otherwise fetches from API
 */

const constants = require('../constants');
const logger = require('../logger');

class CatalogService {
  constructor(apiClient, prefetchService, cache, config) {
    this.apiClient = apiClient;
    this.prefetchService = prefetchService;
    this.cache = cache;
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

    // Determine order by based on catalog ID
    switch (catalogId) {
      case constants.catalogCategories.Hanime:
        // Don't set orderBy/ordering - let API decide
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

    // Apply extra filters if provided
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
   * Sort results in memory
   */
  sortResults(results, orderBy, ordering = 'desc') {
    if (!orderBy || !results || results.length === 0) {
      return results;
    }

    const sorted = [...results]; // Copy array before sorting
    sorted.sort((a, b) => {
      const aVal = a[orderBy] || 0;
      const bVal = b[orderBy] || 0;
      return ordering === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }

  /**
   * Filter results by search query
   */
  filterBySearch(results, query) {
    if (!query || !query.trim() || !results || results.length === 0) {
      return results;
    }

    const searchTerm = query.toLowerCase().trim();
    return results.filter(item => {
      const name = (item.name || '').toLowerCase();
      return name.includes(searchTerm);
    });
  }

  /**
   * Filter results by genre/tag
   */
  filterByGenre(results, genre) {
    if (!genre || !results || results.length === 0) {
      return results;
    }

    const genreLower = genre.toLowerCase();
    return results.filter(item => {
      // Check tags array (from catalog API response)
      const tags = item.tags || [];
      // Check hentai_tags array (from video API response)
      const hentaiTags = item.hentai_tags || [];
      
      // Combine and normalize tags
      const allTags = [
        ...tags.map(t => typeof t === 'string' ? t.toLowerCase() : (t.text || '').toLowerCase()),
        ...hentaiTags.map(t => typeof t === 'string' ? t.toLowerCase() : (t.text || '').toLowerCase())
      ];

      return allTags.some(tag => tag === genreLower);
    });
  }

  /**
   * Paginate results
   */
  paginateResults(results, page, itemsPerPage) {
    if (!results || results.length === 0) {
      return [];
    }

    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return results.slice(startIndex, endIndex);
  }

  /**
   * Build cache key for catalog request
   */
  buildCacheKey(catalogId, extra = {}) {
    return `catalog:${catalogId}:${JSON.stringify(extra || {})}`;
  }

  /**
   * Get catalog data - uses prefetched data if available, otherwise fetches from API
   * Only caches when prefetch is disabled (API responses)
   */
  async getCatalogData(catalogId, extra = {}) {
    const params = this.buildQueryParams(catalogId, extra);

    // Try to use prefetched data (can handle filters in memory)
    if (this.prefetchService) {
      // Try to get prefetched data for this catalog, or fall back to Hanime catalog (base data)
      let prefetched = this.prefetchService.getPrefetchedData(catalogId);
      if (!prefetched) {
        // Use Hanime catalog prefetched data (base data without ordering)
        prefetched = this.prefetchService.getPrefetchedData(constants.catalogCategories.Hanime);
      }

      if (prefetched && prefetched.allResults.length > 0) {
        logger.info('Using prefetched data', {
          catalogId,
          totalItems: prefetched.allResults.length,
          hasFilters: !!(extra.search || extra.genre)
        });

        let results = prefetched.allResults;

        // Apply search filter if provided
        if (extra.search) {
          results = this.filterBySearch(results, extra.search);
        }

        // Apply genre filter if provided
        if (extra.genre) {
          results = this.filterByGenre(results, extra.genre);
        }

        // Apply sorting if needed (for non-Hanime catalogs)
        if (catalogId !== constants.catalogCategories.Hanime && params.orderBy) {
          results = this.sortResults(results, params.orderBy, params.ordering);
        }

        // Apply pagination
        const itemsPerPage = this.config.pagination.itemsPerPage;
        results = this.paginateResults(results, params.page, itemsPerPage);

        // Don't cache when using prefetched data (already in memory)
        return results;
      }
    }

    // Fetch from API (prefetch not available) - check cache first
    const cacheKey = this.buildCacheKey(catalogId, extra);
    if (this.cache && this.config.cache.catalogCacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      logger.debug('Catalog served from cache', { catalogId });
      return cached;
    }

    logger.debug('Fetching catalog data from API', { catalogId, params });
    const results = await this.apiClient.search(params);

    if (!results || !Array.isArray(results)) {
      logger.warn('Invalid API response', {
        catalogId,
        resultType: typeof results,
        isArray: Array.isArray(results)
      });
      return [];
    }

    // Cache API response (only when prefetch is disabled, catalog caching is enabled, and results are not empty)
    if (this.cache && this.config.cache.catalogCacheEnabled && results.length > 0) {
      const catalogTtl = this.config.cache.catalogTtl || (2 * 60 * 60 * 1000); // Default 2 hours
      this.cache.set(cacheKey, results, catalogTtl);
    }

    return results;
  }
}

module.exports = CatalogService;

