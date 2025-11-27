/**
 * User API Instance Manager
 * Manages and caches HanimeUserApi instances per email/password combination
 * Ensures efficient reuse of authenticated sessions
 */

const crypto = require('crypto');
const logger = require('../logger');
const HanimeUserApi = require('./hanime_user_api_client');

class UserApiManager {
  constructor() {
    // Cache for user API instances per credential hash
    this.userApiCache = new Map();

    // Track initialization promises to prevent concurrent initialization of same credentials
    this.initPromises = new Map();
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

    // Check cache first
    if (this.userApiCache.has(credentialsHash)) {
      const cached = this.userApiCache.get(credentialsHash);
      logger.debug('Using cached user API instance', {
        emailPrefix: email.substring(0, 3) + '***'
      });
      return cached;
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

        // Cache the instance
        this.userApiCache.set(credentialsHash, userApi);

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
    this.userApiCache.delete(credentialsHash);
    logger.debug('Cleared cached user API instance', {
      emailPrefix: email.substring(0, 3) + '***'
    });
  }

  /**
   * Clear all cached user API instances
   */
  clearAllCache() {
    const count = this.userApiCache.size;
    this.userApiCache.clear();
    this.initPromises.clear();
    logger.info('Cleared all cached user API instances', { count });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cachedInstances: this.userApiCache.size,
      pendingInitializations: this.initPromises.size
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

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
