/**
 * Cache Service
 * LRU (Least Recently Used) in-memory cache with TTL support
 */

const logger = require('../logger');

class CacheService {
  constructor(maxSize = 100, ttl = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl; // Time to live in milliseconds
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Generate cache entry with expiration
   */
  _createEntry(value) {
    return {
      value: value,
      timestamp: Date.now(),
      expires: Date.now() + this.ttl
    };
  }

  /**
   * Check if cache entry is expired
   */
  _isExpired(entry) {
    return Date.now() > entry.expires;
  }

  /**
   * Evict oldest entry when cache is full (LRU)
   */
  _evictOldest() {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug('Cache eviction', { evictedKey: firstKey, size: this.cache.size });
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      logger.debug('Cache miss', { key });
      return undefined;
    }

    if (this._isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      logger.debug('Cache expired', { key });
      return undefined;
    }

    // Move to end (mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    logger.debug('Cache hit', { key });
    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else {
      // Evict oldest if at capacity
      this._evictOldest();
    }

    // Add new entry at end
    this.cache.set(key, this._createEntry(value));
    logger.debug('Cache set', { key, size: this.cache.size });
  }

  /**
   * Check if key exists in cache (and is not expired)
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (this._isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
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
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup', { cleaned, remaining: this.cache.size });
    }

    return cleaned;
  }
}

module.exports = CacheService;

