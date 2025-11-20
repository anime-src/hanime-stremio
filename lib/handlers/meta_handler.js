const { isHanimeId } = require('../utils/formatters');
const MetaService = require('../services/meta_service');
const { emptyResponse } = require('./response_helpers');

class MetaHandler {
  constructor(apiClient, logger, config) {
    this.logger = logger;
    this.config = config;
    this.metaService = new MetaService(apiClient, config);
  }

  async handle(args) {
    try {
      const id = args.id;

      if (!id) {
        this.logger.warn('Meta handler called without ID');
        return emptyResponse('meta');
      }

      if (!isHanimeId(id)) {
        return emptyResponse('meta');
      }

      const meta = await this.metaService.getMetaData(id);

      if (!meta) {
        return emptyResponse('meta');
      }

      return { 
        meta,
        cacheMaxAge: this.config.cache.ttl.meta, // 36 hours in seconds
        staleRevalidate: 600 // 10 minutes
      };
    } catch (error) {
      this.logger.error('Meta handler error', { 
        id: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return emptyResponse('meta');
    }
  }
}

module.exports = MetaHandler;

