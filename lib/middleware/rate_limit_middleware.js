/**
 * Rate Limiting and Slow-Down Middleware
 * Uses express-rate-limit and express-slow-down with optional Redis store
 * 
 * Rate limiting: Blocks requests after limit is exceeded (429 status)
 * Slow-down: Gradually delays responses instead of blocking (deters abuse)
 * 
 * Note: For Redis store support (distributed rate limiting), install rate-limit-redis:
 *   npm install rate-limit-redis
 * 
 * Without rate-limit-redis, rate limiting will use in-memory store
 * (works fine for single-instance deployments)
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const config = require('../config');
const logger = require('../logger');

// Try to use Redis store if available (optional dependency)
let RedisStore = null;
let redisStoreWarningLogged = false; // Track if we've already logged the warning

try {
  // Try to load rate-limit-redis if available
  const rateLimitRedis = require('rate-limit-redis');
  RedisStore = rateLimitRedis.RedisStore || rateLimitRedis;
} catch (e) {
  // rate-limit-redis not installed, will use memory store
  // Only log if Redis store is actually requested (and only once)
  if (config.rateLimit.useRedisStore && !redisStoreWarningLogged) {
    logger.warn('rate-limit-redis not installed but RATE_LIMIT_USE_REDIS=true, install it with: npm install rate-limit-redis');
    redisStoreWarningLogged = true;
  }
}

// Cache the Redis client to reuse connection, but create separate store instances
let cachedRedisClient = null;
let storeType = 'memory'; // Track actual store type being used
let redisClientInitialized = false;

/**
 * Get or create Redis client (shared across all stores)
 * @private
 * @returns {Object|null} Redis client instance or null
 */
function _getRedisClient() {
  // Return cached client if already created
  if (cachedRedisClient !== null) {
    return cachedRedisClient;
  }
  
  // If client creation failed before, return null immediately
  if (cachedRedisClient === false) {
    return null;
  }

  // Check if Redis store is enabled in config
  if (!config.rateLimit.useRedisStore && !config.slowDown.useRedisStore) {
    cachedRedisClient = null;
    storeType = 'memory';
    return null;
  }

  if (!RedisStore) {
    if (!redisStoreWarningLogged) {
      logger.warn('rate-limit-redis not installed but Redis store requested, using memory store');
      redisStoreWarningLogged = true;
    }
    cachedRedisClient = false;
    storeType = 'memory';
    return null;
  }

  if (!config.cache.redisUrl) {
    if (!redisStoreWarningLogged) {
      logger.warn('Redis URL not configured but Redis store requested, using memory store');
      redisStoreWarningLogged = true;
    }
    cachedRedisClient = false;
    storeType = 'memory';
    return null;
  }

  try {
    const { createClient } = require('redis');
    const client = createClient({ url: config.cache.redisUrl });
    
    // Handle connection errors
    client.on('error', (err) => {
      logger.warn('Redis client error for rate limiting', {
        error: err.message
      });
    });
    
    // Connect the client (async, but we'll handle connection in sendCommand)
    // Start connection but don't block - it will connect on first use
    client.connect().catch(() => {
      // Connection will be retried in sendCommand
    });
    
    cachedRedisClient = client;
    storeType = 'redis';
    if (!redisClientInitialized) {
      logger.info('Rate limiting using Redis store (distributed)');
      redisClientInitialized = true;
    }
    return client;
  } catch (err) {
    if (!redisStoreWarningLogged) {
      logger.warn('Failed to create Redis client for rate limiting, using memory store', {
        error: err.message
      });
      redisStoreWarningLogged = true;
    }
    cachedRedisClient = false; // Mark as failed to avoid retrying
    storeType = 'memory';
    return null;
  }
}

/**
 * Create Redis store for rate limiting with unique prefix
 * Each limiter needs its own store instance with unique prefix
 * @private
 * @param {string} prefix - Unique prefix for this store instance
 * @returns {Object|null} Redis store instance or null
 */
function _createRateLimitRedisStore(prefix) {
  const client = _getRedisClient();
  
  if (!client) {
    return null;
  }

  try {
    // rate-limit-redis v4+ requires sendCommand instead of client option
    // Each store instance must have a unique prefix
    const store = new RedisStore({
      sendCommand: async (...args) => {
        try {
          // Ensure client is connected before sending command
          if (!client.isOpen) {
            await client.connect();
          }
          return await client.sendCommand(args);
        } catch (err) {
          // If connection fails, throw error so rate-limit-redis can handle it
          throw err;
        }
      },
      prefix: prefix // Unique prefix for each limiter
    });
    
    return store;
  } catch (err) {
    if (!redisStoreWarningLogged) {
      logger.warn('Failed to create Redis store for rate limiting, using memory store', {
        error: err.message
      });
      redisStoreWarningLogged = true;
    }
    return null;
  }
}

/**
 * Create rate limiter with optional Redis store
 * @param {Object} options - Rate limit options
 * @param {string} storePrefix - Unique prefix for Redis store (required if using Redis)
 * @returns {Object} Express rate limit middleware
 */
function createRateLimiter(options, storePrefix) {
  const store = storePrefix ? _createRateLimitRedisStore(storePrefix) : null;

  return rateLimit({
    ...options,
    store: store || undefined, // Use memory store if Redis unavailable
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip || req.connection.remoteAddress,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    },
    // Skip rate limiting for successful requests (optional optimization)
    skipSuccessfulRequests: false,
    // Skip rate limiting for failed requests (optional optimization)
    skipFailedRequests: false
  });
}

/**
 * Create general API rate limiter (for Stremio addon endpoints)
 * @returns {Object} Express rate limit middleware
 */
function createGeneralRateLimiter() {
  return createRateLimiter(config.rateLimit.general, 'rl:hanime:general:');
}

/**
 * Create image proxy rate limiter (stricter limits)
 * @returns {Object} Express rate limit middleware
 */
function createImageProxyRateLimiter() {
  return createRateLimiter(config.rateLimit.imageProxy, 'rl:hanime:image:');
}

/**
 * Create slow-down middleware with optional Redis store
 * @param {Object} options - Slow-down options
 * @param {string} storePrefix - Unique prefix for Redis store (required if using Redis)
 * @returns {Object} Express slow-down middleware
 */
function createSlowDownLimiter(options, storePrefix) {
  const store = storePrefix ? _createRateLimitRedisStore(storePrefix) : null;

  // Convert delayMs to function format for express-slow-down v2
  // Old behavior: cumulative delay (used - delayAfter) * delayMs
  // This means: request 51 gets 500ms delay, request 52 gets 1000ms, request 53 gets 1500ms, etc.
  const delayMsValue = options.delayMs;
  const delayAfterValue = options.delayAfter;
  const maxDelayMsValue = options.maxDelayMs;

  // Convert numeric delayMs to function for v2 compatibility
  // This provides the old behavior: cumulative delay per request
  const delayMsFunction = typeof delayMsValue === 'function' 
    ? delayMsValue 
    : (used, req) => {
        // Get delayAfter from request (set by express-slow-down) or use configured value
        const delayAfter = req.slowDown?.limit || delayAfterValue;
        // Calculate cumulative delay: (requests over threshold) * delayMs
        const calculatedDelay = Math.max(0, (used - delayAfter)) * delayMsValue;
        // Apply max delay limit
        return Math.min(calculatedDelay, maxDelayMsValue);
      };

  return slowDown({
    windowMs: options.windowMs,
    delayAfter: options.delayAfter,
    delayMs: delayMsFunction,
    maxDelayMs: options.maxDelayMs,
    store: store || undefined, // Use memory store if Redis unavailable
    // Note: onLimitReached was removed in express-rate-limit v7
    // Use skipSuccessfulRequests/skipFailedRequests or custom handler if needed
    validate: {
      delayMs: false // Disable validation warning since we're using function format
    }
  });
}

/**
 * Create general API slow-down limiter (for Stremio addon endpoints)
 * @returns {Object} Express slow-down middleware
 */
function createGeneralSlowDown() {
  return createSlowDownLimiter(config.slowDown.general, 'rl:hanime:slowdown:general:');
}

/**
 * Create image proxy slow-down limiter (stricter limits)
 * @returns {Object} Express slow-down middleware
 */
function createImageProxySlowDown() {
  return createSlowDownLimiter(config.slowDown.imageProxy, 'rl:hanime:slowdown:image:');
}

/**
 * Get the actual store type being used
 * @returns {string} 'redis' or 'memory'
 */
function getStoreType() {
  // Trigger client creation to determine type
  _getRedisClient();
  return storeType;
}

module.exports = {
  createRateLimiter,
  createGeneralRateLimiter,
  createImageProxyRateLimiter,
  createSlowDownLimiter,
  createGeneralSlowDown,
  createImageProxySlowDown,
  getStoreType
};

