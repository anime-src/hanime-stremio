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

      return await this.streamService.getStreams(id);
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

