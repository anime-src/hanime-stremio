const { isHanimeId } = require('../utils/formatters');
const MetaService = require('../services/meta_service');

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
        return { meta: null };
      }

      if (!isHanimeId(id)) {
        return { meta: null };
      }

      const meta = await this.metaService.getMetaData(id);

      if (!meta) {
        return { meta: null };
      }

      return { meta };
    } catch (error) {
      this.logger.error('Meta handler error', { 
        id: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return { meta: null };
    }
  }
}

module.exports = MetaHandler;

