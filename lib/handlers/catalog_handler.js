/**
 * Catalog Handler
 * Handles catalog requests for browsing content
 */

const constants = require('../constants');
const TransformService = require('../services/transform_service');
const SeriesService = require('../services/series_service');

class CatalogHandler {
  constructor(apiClient, logger, config) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Build query parameters from catalog request
   */
  buildQueryParams(args) {
    const queryParams = {
      query: '',
      tags: [],
      orderBy: 'created_at_unix',
      ordering: 'desc',
      page: 0
    };

    // Determine order by based on catalog ID
    switch (args.id) {
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
    if (args.extra) {
      queryParams.query = args.extra.search || '';
      queryParams.tags = args.extra.genre ? [args.extra.genre] : [];
      queryParams.page = args.extra.skip 
        ? Math.floor(args.extra.skip / this.config.pagination.itemsPerPage) + 1 
        : 0;
    }

    return queryParams;
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

      // Build query parameters
      const params = this.buildQueryParams(args);
      this.logger.debug('Catalog query params', params);

      // Fetch from API
      const results = await this.apiClient.search(params);

      if (!results || !Array.isArray(results)) {
        this.logger.warn('Catalog handler: invalid API response', { 
          catalogId: args.id,
          resultType: typeof results,
          isArray: Array.isArray(results)
        });
        return { metas: [] };
      }

      // Handle series catalog differently
      const publicUrl = this.config.server.publicUrl || process.env.PUBLIC_URL;
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
    } catch (error) {
      this.logger.error('Catalog handler error', { 
        catalogId: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return { metas: [] };
    }
  }
}

module.exports = CatalogHandler;

