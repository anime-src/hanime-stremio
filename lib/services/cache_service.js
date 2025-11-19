/**
 * Cache Service
 * LRU (Least Recently Used) in-memory cache with TTL support
 * Uses lru-cache library for optimized LRU implementation
 */

const { LRUCache } = require('lru-cache');
const logger = require('../logger');

class CacheService {
  constructor(maxSize = 100, ttl = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl; // Time to live in milliseconds
    this.hits = 0;
    this.misses = 0;
    
    // Initialize LRU cache
    // lru-cache uses milliseconds for TTL
    this.cache = new LRUCache({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true, // Update TTL on access (refresh on get)
      updateAgeOnHas: false, // Don't update TTL on has() check
      dispose: (value, key) => {
        logger.debug('Cache eviction', { evictedKey: key, size: this.cache.size });
      }
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const value = this.cache.get(key);
    
    if (value === undefined) {
      this.misses++;
      logger.debug('Cache miss', { key });
      return undefined;
    }
    
    this.hits++;
    logger.debug('Cache hit', { key });
    return value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Optional TTL in milliseconds (overrides default)
   */
  set(key, value, ttl = null) {
    const options = ttl !== null ? { ttl } : {};
    this.cache.set(key, value, options);
    logger.debug('Cache set', { key, size: this.cache.size, ttl: ttl || this.ttl });
  }

  /**
   * Check if key exists in cache (and is not expired)
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info('Cache cleared', { clearedEntries: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Stats object
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      ttl: this.ttl
    };
  }

  /**
   * Clean up expired entries
   * Note: lru-cache handles expiration automatically, but this method
   * can be used to manually purge expired entries if needed
   */
  cleanup() {
    // lru-cache automatically handles expiration, but we can purge stale entries
    // by calling purgeStale() if available, or just return 0 since it's automatic
    const beforeSize = this.cache.size;
    
    // lru-cache v7+ has purgeStale() method
    if (typeof this.cache.purgeStale === 'function') {
      this.cache.purgeStale();
    }
    
    const cleaned = beforeSize - this.cache.size;
    
    if (cleaned > 0) {
      logger.info('Cache cleanup', { cleaned, remaining: this.cache.size });
    }

    return cleaned;
  }
}

module.exports = CacheService;

