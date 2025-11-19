/**
 * Image Deduplication Service
 * Tracks in-flight requests to prevent duplicate CDN fetches
 */

const logger = require('../../logger');

class ImageDeduplicationService {
  constructor() {
    this.inFlight = new Map(); // key -> Promise
  }

  /**
   * Check if request is already in-flight
   */
  has(imageUrl) {
    return this.inFlight.has(imageUrl);
  }

  /**
   * Get in-flight promise
   */
  get(imageUrl) {
    return this.inFlight.get(imageUrl);
  }

  /**
   * Add in-flight request
   */
  set(imageUrl, promise) {
    this.inFlight.set(imageUrl, promise);
    logger.debug('Added to in-flight', { 
      url: imageUrl, 
      inFlight: this.inFlight.size 
    });
  }

  /**
   * Remove from in-flight
   */
  delete(imageUrl) {
    this.inFlight.delete(imageUrl);
    logger.debug('Removed from in-flight', { 
      url: imageUrl, 
      inFlight: this.inFlight.size 
    });
  }

  /**
   * Get size
   */
  getSize() {
    return this.inFlight.size;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      inFlight: this.inFlight.size
    };
  }
}

module.exports = ImageDeduplicationService;

