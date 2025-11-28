/**
 * User API Instance Manager
 * Manages and caches HanimeUserApi instances per email/password combination
 * Ensures efficient reuse of authenticated sessions
 * Uses cache-manager with multi-store (memory + Redis) for persistence
 */

const crypto = require('crypto');
const { createCache } = require('cache-manager');
const { createKeyv } = require('cacheable');
const { createKeyv: createKeyvRedis } = require('@keyv/redis');
const { KeyvUpstash } = require('keyv-upstash');
const { Keyv } = require('keyv');
const logger = require('../logger');
const config = require('../config');
const HanimeUserApi = require('./hanime_user_api_client');

// Cache key prefix for user sessions
const USER_SESSION_KEY_PREFIX = 'user-session:';

class UserApiManager {
  constructor() {
    // Track initialization promises to prevent concurrent initialization of same credentials
    this.initPromises = new Map();

    // Create dedicated cache instance for user sessions
    // Uses cache-manager with multi-store: memory (L1) + Redis (L2) if configured
    this.sessionCache = this._createSessionCache();
  }

  /**
   * Create cache instance for user sessions
   * Uses same pattern as lib/cache.js: memory store (L1) + Redis/Upstash (L2)
   * @private
   * @returns {Object|null} Cache instance or null if caching is disabled
   */
  _createSessionCache() {
    if (!config.cache.enabled) {
      logger.debug('User session cache disabled');
      return null;
    }

    const stores = [];

    // Always add in-memory store as L1 (fast access)
    const memoryStore = createKeyv({ 
      ttl: 12 * 60 * 60 * 1000, // 12 hours default TTL
      lruSize: config.cache.maxSize || 1000 
    });
    stores.push(memoryStore);

    // Add remote store as L2 (persistent) if configured
    // Priority: Upstash > Redis
    if (config.cache.upstashUrl && config.cache.upstashToken) {
      try {
        logger.debug('User session cache using Upstash Redis store');
        const upstashStore = new Keyv({
          store: new KeyvUpstash({
            url: config.cache.upstashUrl,
            token: config.cache.upstashToken
          }),
          namespace: 'user-session'
        });
        upstashStore.on('error', (err) => {
          logger.warn('User session cache store connection error (non-fatal)', {
            message: err && err.message ? err.message : String(err)
          });
        });
        stores.push(upstashStore);
      } catch (err) {
        logger.warn('Failed to initialize Upstash store for user sessions, using memory only', {
          error: err.message
        });
      }
    } else if (config.cache.redisUrl) {
      try {
        logger.debug('User session cache using Redis store');
        const redisStore = createKeyvRedis(config.cache.redisUrl);
        redisStore.on('error', (err) => {
          logger.warn('User session cache store connection error (non-fatal)', {
            message: err && err.message ? err.message : String(err)
          });
        });
        stores.push(redisStore);
      } catch (err) {
        logger.warn('Failed to initialize Redis store for user sessions, using memory only', {
          error: err.message
        });
      }
    }

    // Create cache with stores array - cache-manager handles multi-level automatically
    const cache = createCache({
      stores: stores
    });

    logger.debug('User session cache initialized', {
      stores: stores.length,
      hasRedis: stores.length > 1
    });

    return cache;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get or create a user API instance for the given credentials
   * Caches instances per email/password combination
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<HanimeUserApi>} User API instance
   */
  async getUserApi(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const credentialsHash = this._getCredentialsHash(email, password);

    // Check cache first (if enabled)
    if (this.sessionCache) {
      const cachedUserApi = await this._getCachedUserApi(credentialsHash, email, password);
      if (cachedUserApi) {
        return cachedUserApi;
      }
    }

    // Check if initialization is already in progress for these credentials
    if (this.initPromises.has(credentialsHash)) {
      logger.debug('Waiting for existing initialization', {
        emailPrefix: email.substring(0, 3) + '***'
      });
      try {
        return await this.initPromises.get(credentialsHash);
      } catch (error) {
        // If initialization failed, remove the promise and continue to retry
        this.initPromises.delete(credentialsHash);
        throw error;
      }
    }

    // Start new initialization
    const initPromise = (async () => {
      try {
        const userApi = await this._initializeUserApi(email, password);

        return userApi;
      } finally {
        // Remove promise after completion (success or failure)
        this.initPromises.delete(credentialsHash);
      }
    })();

    // Store the promise so concurrent calls can wait for it
    this.initPromises.set(credentialsHash, initPromise);

    // Wait for initialization to complete
    return await initPromise;
  }

  /**
   * Clear cached user API instance for specific credentials
   * @param {string} email - User email
   * @param {string} password - User password
   */
  clearCache(email, password) {
    if (!email || !password) {
      return;
    }

    const credentialsHash = this._getCredentialsHash(email, password);
    const cacheKey = this._getCacheKey(credentialsHash);
    
    if (this.sessionCache) {
      this.sessionCache.del(cacheKey).catch((err) => {
        logger.warn('Error clearing user session cache', {
          error: err.message
        });
      });
    }
    
    logger.debug('Cleared cached user API instance', {
      emailPrefix: email.substring(0, 3) + '***'
    });
  }


  /**
   * Clear all cached user API instances
   * Note: With cache-manager, we can't easily count all entries
   * This method clears the in-memory cache and pending initializations
   */
  clearAllCache() {
    // Note: cache-manager doesn't provide a simple way to clear all entries
    // We can only clear pending initializations
    const pendingCount = this.initPromises.size;
    this.initPromises.clear();
    logger.info('Cleared pending user API initializations', { 
      pendingCount,
      note: 'Session cache entries will expire automatically via TTL'
    });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheEnabled: this.sessionCache !== null,
      pendingInitializations: this.initPromises.size,
      note: 'Session cache uses TTL-based expiration, exact counts not available'
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    this.initPromises.clear();
    // Note: cache-manager stores handle their own cleanup
    logger.debug('UserApiManager destroyed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get cache key with prefix
   * @private
   * @param {string} credentialsHash - Hash of credentials
   * @returns {string} Prefixed cache key
   */
  _getCacheKey(credentialsHash) {
    return `${USER_SESSION_KEY_PREFIX}${credentialsHash}`;
  }

  /**
   * Get cached user API instance from cache
   * @private
   * @param {string} credentialsHash - Hash of credentials
   * @param {string} email - User email (for logging)
   * @param {string} password - User password (required for client recreation)
   * @returns {Promise<HanimeUserApi|null>} Cached user API instance or null if not found/expired
   */
  async _getCachedUserApi(credentialsHash, email, password) {
    try {
      const cacheKey = this._getCacheKey(credentialsHash);
      const cached = await this.sessionCache.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      // Check if session is expired (extra safety check)
      if (cached.expiresAt && Date.now() > cached.expiresAt) {
        logger.debug('Cached user session expired, removing from cache', {
          emailPrefix: email.substring(0, 3) + '***'
        });
        await this.sessionCache.del(cacheKey);
        return null;
      }

      // Recreate HanimeUserApi from cached session data
      logger.debug('Using cached user session, recreating client', {
        emailPrefix: email.substring(0, 3) + '***'
      });
      
      const userApi = new HanimeUserApi(
        cached.sessionToken,
        cached.email,
        password, // Still required for auto-refresh
        cached.expiresAt / 1000 // Convert to Unix seconds
      );
      
      return userApi;
    } catch (error) {
      // Cache error - log but don't fail, continue to initialize
      logger.warn('Error retrieving user session from cache, will reinitialize', {
        error: error.message,
        emailPrefix: email.substring(0, 3) + '***'
      });
      return null;
    }
  }

  /**
   * Generate hash for credentials to use as cache key
   * @private
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {string} Hash string
   */
  _getCredentialsHash(email, password) {
    const hash = crypto.createHash('sha256');
    hash.update(`${email}:${password}`);
    return hash.digest('hex');
  }

  /**
   * Initialize a user API instance with login
   * @private
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<HanimeUserApi>} Initialized user API instance
   */
  async _initializeUserApi(email, password) {
    try {
      // Pass credentials to constructor so auto-refresh can work
      const userApi = new HanimeUserApi(null, email, password);
      const loginResult = await userApi.login(email, password);

      logger.info('Hanime user API initialized successfully', {
        email: email.substring(0, 3) + '***', // Log partial email for privacy
        isPremium: loginResult.user.isPremium,
        expiresAt: new Date(loginResult.sessionTokenExpireTimeUnix * 1000).toISOString()
      });

      // Store serializable session data in cache (if enabled)
      if (this.sessionCache) {
        try {
          const credentialsHash = this._getCredentialsHash(email, password);
          const cacheKey = this._getCacheKey(credentialsHash);
          
          // Extract serializable session data
          const sessionData = {
            sessionToken: loginResult.sessionToken,
            expiresAt: loginResult.sessionTokenExpireTimeUnix * 1000, // Convert to milliseconds
            email: email,
            isPremium: loginResult.user.isPremium
          };

          // Calculate TTL: session expiration time minus 5 minutes buffer
          const ttl = (loginResult.sessionTokenExpireTimeUnix * 1000) - Date.now() - (5 * 60 * 1000);
          
          // Only cache if TTL is positive (session not already expired)
          if (ttl > 0) {
            await this.sessionCache.set(cacheKey, sessionData, ttl);
            logger.debug('Stored user session in cache', {
              emailPrefix: email.substring(0, 3) + '***',
              ttl: `${Math.round(ttl / 1000 / 60)} minutes`
            });
          } else {
            logger.warn('Session TTL is negative, not caching', {
              emailPrefix: email.substring(0, 3) + '***',
              ttl
            });
          }
        } catch (cacheError) {
          // Cache error - log but don't fail authentication
          logger.warn('Failed to store user session in cache (non-fatal)', {
            error: cacheError.message,
            emailPrefix: email.substring(0, 3) + '***'
          });
        }
      }

      return userApi;
    } catch (error) {
      logger.error('Failed to initialize Hanime user API', {
        error: error.message,
        emailPrefix: email.substring(0, 3) + '***'
      });
      throw error;
    }
  }
}

// Export class for dependency injection
module.exports = UserApiManager;
