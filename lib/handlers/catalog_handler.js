/**
 * Catalog Handler
 * Handles catalog requests for browsing content
 */

const constants = require('../constants');
const TransformService = require('../services/transform_service');
const SeriesService = require('../services/series_service');
const CatalogService = require('../services/catalog_service');

class CatalogHandler {
  constructor(apiClient, logger, config) {
    this.logger = logger;
    this.config = config;
    this.catalogService = new CatalogService(apiClient, config);
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
      if (!this.isValidCatalogRequest(args)) {
        return { metas: [] };
      }

      const publicUrl = this.config.server.publicUrl || process.env.PUBLIC_URL;

      const results = await this.catalogService.getCatalogData(args.id, args.extra);

      if (!results || results.length === 0) {
        this.logger.warn('Catalog handler: no results', { catalogId: args.id });
        return { metas: [] };
      }

      return await this.transformResults(results, args, publicUrl);
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
  async transformResults(results, args, publicUrl) {
    let metas;

    if (args.id === constants.catalogCategories.Series) {
      const seriesItems = SeriesService.getSeriesCatalogItems(results);
      metas = TransformService.toStremioSeriesCatalog(seriesItems, publicUrl);
    } else {
      metas = TransformService.toStremioCatalog(results, publicUrl);
    }

    return { metas };
  }
}

module.exports = CatalogHandler;

