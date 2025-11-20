/**
 * Response Helpers
 * Standardized empty response patterns for handlers
 */

/**
 * Generate empty response based on handler type
 * @param {string} type - Response type ('catalog', 'meta', 'stream')
 * @returns {Object} Empty response object
 */
function emptyResponse(type) {
  switch (type) {
    case 'catalog':
      return { metas: [] };
    case 'meta':
      return { meta: null };
    case 'stream':
      return { streams: [] };
    default:
      return {};
  }
}

module.exports = {
  emptyResponse
};
