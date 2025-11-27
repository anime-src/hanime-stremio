/**
 * Cache Module
 * Handles caching for metadata, catalog, streams, and binary images
 * Uses cache-manager with createCache and createKeyv for multi-level caching
 */

const { createCache } = require('cache-manager');
const { createKeyv } = require('cacheable');
const { createKeyv: createKeyvRedis } = require('@keyv/redis');
const { KeyvUpstash } = require('keyv-upstash');
const { KeyvPostgres } = require('@keyv/postgres');
const { Keyv } = require('keyv');
const { KeyvCacheableMemory } = require('cacheable');
const config = require('./config');
const logger = require('./logger');

const GLOBAL_KEY_PREFIX = 'hanime-stremio';
const META_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|meta`;
const CATALOG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|catalog`;
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const BINARY_IMAGES_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|binary-images`;

// TTL values in milliseconds
const CATALOG_TTL = config.cache.ttl.catalog * 1000;
const META_TTL = config.cache.ttl.meta * 1000;
const STREAM_TTL = config.cache.ttl.stream * 1000;
const BINARY_IMAGES_TTL = config.cache.ttl.image * 1000;

const NO_CACHE = !config.cache.enabled;
const MAX_SIZE = config.cache.maxSize;

// ============================================================================
// Private Functions
// ============================================================================

/**
 * Handle cache store connection errors
 * @private
 * @param {Error} err - Connection error
 */
function _handleConnectionError(err) {
  try {
    // Log as warning instead of error to prevent crashes
    // Redis connection errors are non-fatal - we fall back to in-memory cache
    logger.warn('Cache store connection error (non-fatal, using in-memory cache)', { 
      message: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : undefined,
      name: err && err.name ? err.name : undefined
    });
  } catch (_) {
    // swallow any errors in error handling
  }
}

/**
 * Create multi-level cache using cache-manager with createCache
 * Always includes in-memory store (L1), optionally adds Upstash/Redis/PostgreSQL (L2)
 * Priority: Upstash > Redis > PostgreSQL > In-memory
 * @private
 * @returns {Object|null} Cache instance or null if caching is disabled
 */
function _createMultiCache() {
  if (NO_CACHE) {
    return null;
  }

  const stores = [];

  // Always add in-memory store as L1 (fast access)
  const memoryStore = createKeyv({ ttl: META_TTL, lruSize: MAX_SIZE });
  stores.push(memoryStore);

  // Add remote store as L2 (persistent) if configured
  // Priority: Upstash > Redis > PostgreSQL
  if (config.cache.upstashUrl && config.cache.upstashToken) {
    logger.info(`Using Upstash Redis cache store: ${config.cache.upstashUrl.replace(/\/\/.*@/, '//***@')}`);
    const upstashStore = new Keyv({
      store: new KeyvUpstash({
        url: config.cache.upstashUrl,
        token: config.cache.upstashToken
      })
    });
    upstashStore.on('error', _handleConnectionError);
    stores.push(upstashStore);
    logger.info('Two-level cache enabled: In-memory (L1) + Upstash Redis (L2)');
  } else if (config.cache.redisUrl) {
    try {
      logger.info(`Using Redis cache store: ${config.cache.redisUrl.replace(/\/\/.*@/, '//***@')}`);
      const redisStore = createKeyvRedis(config.cache.redisUrl);
      
      // Attach error handler immediately to prevent unhandled errors
      redisStore.on('error', _handleConnectionError);
      
      // Also try to handle errors on the underlying Redis client if accessible
      if (redisStore.store && redisStore.store.client) {
        redisStore.store.client.on('error', _handleConnectionError);
      }
      
      stores.push(redisStore);
      logger.info('Two-level cache enabled: In-memory (L1) + Redis (L2)');
    } catch (err) {
      logger.warn('Failed to initialize Redis cache store, falling back to in-memory only', {
        error: err.message
      });
      logger.debug('Single-level cache enabled: In-memory only (Redis initialization failed)');
    }
  } else if (config.cache.postgresUrl) {
    logger.info(`Using PostgreSQL cache store: ${config.cache.postgresUrl.replace(/\/\/.*@/, '//***@')}`);
    // Note: @keyv/postgres doesn't have createKeyv, so we use KeyvPostgres directly
    const postgresStore = new KeyvPostgres(config.cache.postgresUrl);
    postgresStore.on('error', _handleConnectionError);
    stores.push(postgresStore);
    logger.info('Two-level cache enabled: In-memory (L1) + PostgreSQL (L2)');
  } else {
    logger.debug('Single-level cache enabled: In-memory only');
  }

  // Create cache with stores array - cache-manager handles multi-level automatically
  return createCache({
    stores: stores
  });
}

/**
 * Check if data should be cached
 * Prevents caching null, undefined, or "not found" responses
 * @private
 * @param {*} data - Data to check
 * @returns {boolean} True if data should be cached
 */
function _shouldCache(data) {
  // Don't cache null or undefined
  if (data === null || data === undefined) {
    return false;
  }

  // Don't cache objects with null meta (represents "not found")
  if (data && typeof data === 'object' && data.meta === null) {
    return false;
  }

  // Don't cache empty objects
  if (data && typeof data === 'object' && Object.keys(data).length === 0) {
    return false;
  }

  return true;
}

/**
 * Generic cache wrapper function
 * @private
 * @param {Object|null} cache - Cache instance from cache-manager
 * @param {string} key - Cache key
 * @param {Function} method - Async function to cache
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise} Cached result
 */
async function _cacheWrap(cache, key, method, ttl) {
  if (!cache) return method();

  try {
    const existing = await cache.get(key);
    if (existing !== undefined) {
      if (logger && logger.debug) logger.debug(`Cache hit key=${key}`);
      return existing;
    }
  } catch (e) {
    logger.warn && logger.warn(`Cache get failed key=${key} err=${e.message}`);
  }

  const data = await method();
  // cache-manager v5+ uses milliseconds for TTL (we already have TTL in milliseconds)

  // Only cache if data is valid (not null, undefined, or "not found" responses)
  if (_shouldCache(data)) {
    try {
      await cache.set(key, data, ttl);
      if (logger && logger.debug) logger.debug(`Cached key=${key} ttl=${ttl}ms`);
    } catch (e) {
      logger.warn && logger.warn(`Cache set failed key=${key} err=${e.message}`);
    }
  } else {
    if (logger && logger.debug) logger.debug(`Skipped caching null/empty data for key=${key}`);
  }
  
  return data;
}

// ============================================================================
// Cache Initialization
// ============================================================================

// Always use memory-backed Keyv for binary images (single-level only)
const imageCache = NO_CACHE ? null : new Keyv({
  store: new KeyvCacheableMemory({ ttl: BINARY_IMAGES_TTL, lruSize: MAX_SIZE }),
  namespace: 'images'
});

// Create multi-level cache (in-memory + remote) using cache-manager
const remoteCache = _createMultiCache();

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Wrap a catalog method with caching
 * @param {string} id - Cache key identifier
 * @param {Function} method - Async function to cache
 * @returns {Promise} Cached result
 */
function cacheWrapCatalog(id, method) {
  return _cacheWrap(remoteCache, `${CATALOG_KEY_PREFIX}:${id}`, method, CATALOG_TTL);
}

/**
 * Wrap a meta method with caching
 * @param {string} id - Cache key identifier
 * @param {Function} method - Async function to cache
 * @returns {Promise} Cached result
 */
function cacheWrapMeta(id, method) {
  return _cacheWrap(remoteCache, `${META_KEY_PREFIX}:${id}`, method, META_TTL);
}

/**
 * Wrap a stream method with caching
 * @param {string} id - Cache key identifier
 * @param {Function} method - Async function to cache
 * @returns {Promise} Cached result
 */
function cacheWrapStream(id, method) {
  return _cacheWrap(remoteCache, `${STREAM_KEY_PREFIX}:${id}`, method, STREAM_TTL);
}

/**
 * Wrap a binary image method with caching
 * @param {string} imagePath - Cache key identifier
 * @param {Function} method - Async function to cache
 * @returns {Promise} Cached result
 */
function cacheWrapBinaryImage(imagePath, method) {
  return _cacheWrap(imageCache, `${BINARY_IMAGES_KEY_PREFIX}:${imagePath}`, method, BINARY_IMAGES_TTL);
}

module.exports = { cacheWrapCatalog, cacheWrapMeta, cacheWrapStream, cacheWrapBinaryImage };
