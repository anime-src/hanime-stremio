/**
 * Catalog Prefetch Service
 * Prefetches all catalog data from API and stores in memory
 */

const logger = require('../logger');
const constants = require('../constants');

class CatalogPrefetchService {
  constructor(apiClient, cache, config) {
    this.apiClient = apiClient;
    this.cache = cache;
    this.config = config;
    this.prefetchedData = new Map(); // catalogId -> { allResults, totalPages, fetchedAt }
    this.isPrefetching = false;
    this.prefetchStats = {
      totalItems: 0,
      totalPages: 0,
      catalogsPrefetched: 0,
      lastPrefetch: null,
      errors: 0
    };
  }

  /**
   * Prefetch all pages for a catalog type with parallel fetching
   */
  async prefetchCatalog(catalogId, queryParams) {
    const allResults = [];
    const pageResults = new Map(); // page -> results (for ordering)
    let page = 0;
    let totalPages = 0;
    let hasMore = true;
    const concurrency = this.config.cache.prefetch?.concurrency || 5;
    const pageDelay = this.config.cache.prefetch?.pageDelay || 50;

    logger.info(`Starting prefetch for catalog: ${catalogId}`, { 
      catalogId,
      concurrency 
    });

    // First, discover total pages by fetching first few pages sequentially
    while (hasMore && page < concurrency) {
      try {
        const params = { ...queryParams, page };
        const results = await this.apiClient.search(params);

        if (!results || !Array.isArray(results) || results.length === 0) {
          hasMore = false;
          break;
        }

        pageResults.set(page, results);
        totalPages++;
        page++;

        // Small delay to avoid hammering API
        await new Promise(resolve => setTimeout(resolve, pageDelay));
      } catch (error) {
        logger.error(`Prefetch error for ${catalogId} at page ${page}`, {
          catalogId,
          page,
          error: error.message
        });
        this.prefetchStats.errors++;
        hasMore = false;
        break;
      }
    }

    // Now fetch remaining pages in parallel batches
    while (hasMore) {
      const batchPromises = [];
      
      // Create batch of parallel requests
      for (let i = 0; i < concurrency && hasMore; i++) {
        const currentPage = page;
        const promise = this.apiClient.search({ ...queryParams, page: currentPage })
          .then(results => {
            if (!results || !Array.isArray(results) || results.length === 0) {
              hasMore = false;
              return null;
            }
            return { page: currentPage, results };
          })
          .catch(error => {
            logger.error(`Prefetch error for ${catalogId} at page ${currentPage}`, {
              catalogId,
              page: currentPage,
              error: error.message
            });
            this.prefetchStats.errors++;
            return null;
          });
        
        batchPromises.push(promise);
        page++;
      }

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      let batchHasResults = false;
      for (const result of batchResults) {
        if (result && result.results) {
          pageResults.set(result.page, result.results);
          totalPages++;
          batchHasResults = true;
        } else {
          hasMore = false;
        }
      }

      if (!batchHasResults) {
        hasMore = false;
      }

      // Log progress every 10 pages
      if (totalPages % 10 === 0) {
        logger.info(`Prefetch progress for ${catalogId}`, {
          catalogId,
          pagesFetched: totalPages,
          estimatedItems: pageResults.size * 50 // Rough estimate
        });
      }

      // Small delay between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, pageDelay));
      }
    }

    // Sort results by page number and combine
    const sortedPages = Array.from(pageResults.keys()).sort((a, b) => a - b);
    for (const pageNum of sortedPages) {
      allResults.push(...pageResults.get(pageNum));
    }

    if (allResults.length > 0) {
      this.prefetchedData.set(catalogId, {
        allResults,
        totalPages,
        fetchedAt: Date.now()
      });

      logger.info(`Prefetch completed for ${catalogId}`, {
        catalogId,
        totalItems: allResults.length,
        totalPages
      });

      this.prefetchStats.totalItems += allResults.length;
      this.prefetchStats.totalPages += totalPages;
      this.prefetchStats.catalogsPrefetched++;
    }

    return { allResults, totalPages };
  }

  /**
   * Prefetch all catalogs
   */
  async prefetchAll() {
    if (this.isPrefetching) {
      logger.warn('Prefetch already in progress');
      return;
    }

    this.isPrefetching = true;
    this.prefetchStats = {
      totalItems: 0,
      totalPages: 0,
      catalogsPrefetched: 0,
      lastPrefetch: Date.now(),
      errors: 0
    };

    logger.info('='.repeat(60));
    logger.info('Starting catalog prefetch - fetching all pages');
    logger.info('='.repeat(60));

    const startTime = Date.now();

    // Define catalog configurations
    // Only prefetch base catalog (no ordering) - all catalogs are same content, just ordered differently
    // Page size: API returns variable pages, we paginate at 48 items per page (config.pagination.itemsPerPage)
    const catalogs = [
      {
        id: constants.catalogCategories.Hanime,
        params: { query: '', tags: [], page: 0 }
      }
    ];

    // Prefetch each catalog
    for (const catalog of catalogs) {
      try {
        await this.prefetchCatalog(catalog.id, catalog.params);
      } catch (error) {
        logger.error(`Failed to prefetch catalog ${catalog.id}`, {
          catalogId: catalog.id,
          error: error.message
        });
        this.prefetchStats.errors++;
      }
    }

    const duration = Date.now() - startTime;
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    logger.info('='.repeat(60));
    logger.info('Catalog prefetch completed');
    logger.info('='.repeat(60));
    logger.info('Prefetch Statistics:', {
      totalItems: this.prefetchStats.totalItems,
      totalPages: this.prefetchStats.totalPages,
      catalogsPrefetched: this.prefetchStats.catalogsPrefetched,
      errors: this.prefetchStats.errors,
      duration: `${durationMinutes} minutes`,
      memoryEstimate: `${(this.prefetchStats.totalItems * 10 / 1024 / 1024).toFixed(2)} MB (estimated)`
    });
    logger.info('='.repeat(60));

    this.isPrefetching = false;
  }

  /**
   * Get prefetched data for a catalog
   */
  getPrefetchedData(catalogId) {
    return this.prefetchedData.get(catalogId);
  }

  /**
   * Check if catalog is prefetched
   */
  isPrefetched(catalogId) {
    return this.prefetchedData.has(catalogId);
  }

  /**
   * Get prefetch statistics
   */
  getStats() {
    return {
      ...this.prefetchStats,
      catalogs: Array.from(this.prefetchedData.keys()).map(id => ({
        id,
        itemCount: this.prefetchedData.get(id).allResults.length,
        pages: this.prefetchedData.get(id).totalPages,
        fetchedAt: new Date(this.prefetchedData.get(id).fetchedAt).toISOString()
      }))
    };
  }

  /**
   * Clear prefetched data
   */
  clear() {
    const size = this.prefetchedData.size;
    this.prefetchedData.clear();
    logger.info('Prefetched data cleared', { clearedCatalogs: size });
  }
}

module.exports = CatalogPrefetchService;

