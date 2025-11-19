/**
 * Catalog Handler
 * Handles catalog requests for browsing content
 */

const constants = require('../constants');
const TransformService = require('../services/transform_service');
const SeriesService = require('../services/series_service');
const CatalogService = require('../services/catalog_service');

class CatalogHandler {
  constructor(apiClient, cache, logger, config, prefetchService = null) {
    this.logger = logger;
    this.config = config;
    this.catalogService = new CatalogService(apiClient, prefetchService, cache, config);
    // Valid catalog IDs that belong to this addon
    this.validCatalogIds = Object.values(constants.catalogCategories);
  }

  /**
   * Check if catalog request is for this addon
   */
  isValidCatalogRequest(args) {
    if (!args.id) return false;
    return this.validCatalogIds.includes(args.id);
  }


  /**
   * Handle catalog request
   */
  async handle(args) {
    try {
      this.logger.debug('Catalog handler called', { 
        id: args.id, 
        type: args.type,
        extra: args.extra 
      });

      // Reject requests for catalogs that don't belong to this addon
      if (!this.isValidCatalogRequest(args)) {
        this.logger.debug('Catalog handler: ignoring non-Hanime catalog request', { 
          catalogId: args.id,
          type: args.type 
        });
        return { metas: [] };
      }

      // Get public URL for transformation
      const publicUrl = this.config.server.publicUrl || process.env.PUBLIC_URL;

      // Get catalog data (uses prefetched data if available, otherwise fetches from API)
      // Caching is handled inside CatalogService (only when prefetch is disabled)
      const results = await this.catalogService.getCatalogData(args.id, args.extra);

      if (!results || results.length === 0) {
        this.logger.warn('Catalog handler: no results', { catalogId: args.id });
        return { metas: [] };
      }

      // Transform and return
      return this.transformResults(results, args, publicUrl);
    } catch (error) {
      this.logger.error('Catalog handler error', { 
        catalogId: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return { metas: [] };
    }
  }

  /**
   * Transform results to Stremio format
   */
  transformResults(results, args, publicUrl) {
    // Handle series catalog differently
    let metas;

    if (args.id === constants.catalogCategories.Series) {
      // Detect and group series
      const seriesItems = SeriesService.getSeriesCatalogItems(results);
      metas = TransformService.toStremioSeriesCatalog(seriesItems, publicUrl);
      this.logger.debug('Series detected', { seriesCount: seriesItems.length });
    } else {
      // Regular catalog
      metas = TransformService.toStremioCatalog(results, publicUrl);
    }

    this.logger.info('Catalog handler success', { 
      catalogId: args.id, 
      resultsCount: metas.length 
    });

    return { metas };
  }
}

module.exports = CatalogHandler;

