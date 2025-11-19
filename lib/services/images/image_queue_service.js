/**
 * Image Queue Service
 * Handles request queuing and rate limiting for image proxy
 */

const logger = require('../../logger');

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ImageQueueService {
  constructor(delay = 100, enabled = true, imageCache, inFlightService, fetchImage) {
    this.items = []; // Array of { resolve, reject, imageUrl, imagePath }
    this.isProcessing = false;
    this.delay = delay;
    this.enabled = enabled;
    this.imageCache = imageCache;
    this.inFlight = inFlightService;
    this.fetchImage = fetchImage;
  }

  /**
   * Add request to queue
   */
  queue(imageUrl, imagePath) {
    if (!this.enabled) {
      return null; // Return null to indicate no queuing
    }

    return new Promise((resolve, reject) => {
      this.items.push({ resolve, reject, imageUrl, imagePath });
      logger.debug('Request queued', { 
        path: imagePath, 
        queueSize: this.items.length 
      });
      
      // Start processing if not already running
      this.processQueue().catch(err => {
        logger.error('Queue processing error', { error: err.message });
      });
    });
  }

  /**
   * Process queue worker - handles queued requests sequentially with delays
   */
  async processQueue() {
    if (this.isProcessing || this.items.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    logger.debug('Starting queue processing', { queueSize: this.items.length });
    
    while (this.items.length > 0) {
      const item = this.items.shift();
      
      try {
        // Check cache again (might have been cached while waiting)
        const cached = this.imageCache.get(item.imageUrl);
        if (cached) {
          logger.debug('Image found in cache while queued', { path: item.imagePath });
          item.resolve(cached);
          continue;
        }
        
        // Check if already in-flight (deduplication)
        if (this.inFlight.has(item.imageUrl)) {
          logger.debug('Image already in-flight while queued', { path: item.imagePath });
          const inFlightPromise = this.inFlight.get(item.imageUrl);
          item.resolve(await inFlightPromise);
          continue;
        }
        
        // Fetch with retry logic
        logger.debug('Processing queued request', { 
          path: item.imagePath, 
          queueSize: this.items.length 
        });
        
        const promise = this.fetchImage(item.imageUrl, item.imagePath)
          .finally(() => {
            this.inFlight.delete(item.imageUrl);
          });
        
        this.inFlight.set(item.imageUrl, promise);
        const result = await promise;
        item.resolve(result);
        
        // Delay before next request (rate limiting)
        if (this.items.length > 0) {
          await sleep(this.delay);
        }
      } catch (error) {
        item.reject(error);
        // Still delay even on error to avoid hammering CDN
        if (this.items.length > 0) {
          await sleep(this.delay);
        }
      }
    }
    
    this.isProcessing = false;
    logger.debug('Queue processing completed', { queueSize: this.items.length });
  }

  /**
   * Get queue size
   */
  getSize() {
    return this.items.length;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      queueSize: this.items.length,
      isProcessing: this.isProcessing,
      delay: this.delay,
      enabled: this.enabled
    };
  }
}

module.exports = ImageQueueService;

