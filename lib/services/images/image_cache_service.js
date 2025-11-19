/**
 * Image Cache Service
 * Handles in-memory caching of images with TTL
 */

const logger = require('../../logger');

class ImageCacheService {
  constructor(ttl = 30 * 1000) {
    this.cache = new Map(); // key -> { buffer, contentType, expires }
    this.ttl = ttl;
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Set cache entry
   */
  set(key, buffer, contentType) {
    this.cache.set(key, {
      buffer,
      contentType,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Get cache entry if valid
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      logger.debug('Image cache miss', { url: key, cacheSize: this.cache.size });
      return null;
    }
    
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      logger.debug('Image cache expired', { url: key, cacheSize: this.cache.size });
      return null;
    }
    
    logger.debug('Image cache hit', { url: key, cacheSize: this.cache.size });
    return entry;
  }

  /**
   * Get cache size
   */
  getSize() {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0 || logger.isEnabled('debug')) {
        logger.debug('Image cache cleanup', { 
          cleaned, 
          remaining: this.cache.size 
        });
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl: this.ttl
    };
  }
}

module.exports = ImageCacheService;

