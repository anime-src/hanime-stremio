const { isHanimeId } = require('../utils/formatters');
const StreamService = require('../services/stream_service');
const { emptyResponse } = require('./response_helpers');

class StreamHandler {
  constructor(apiClient, logger, config) {
    this.logger = logger;
    this.config = config;
    this.streamService = new StreamService(apiClient, config);
  }

  async handle(args) {
    try {
      const id = args.id;

      if (!id) {
        this.logger.warn('Stream handler called without ID');
        return emptyResponse('stream');
      }

      if (!isHanimeId(id)) {
        return emptyResponse('stream');
      }

      const streams = await this.streamService.getStreams(id);

      return {
        ...streams,
        cacheMaxAge: this.config.cache.ttl.stream, // 36 hours in seconds
        staleRevalidate: 600 // 10 minutes
      };
    } catch (error) {
      this.logger.error('Stream handler error', {
        id: args.id,
        error: error.message,
        stack: error.stack
      });
      return emptyResponse('stream');
    }
  }
}

module.exports = StreamHandler;
