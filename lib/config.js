/**
 * Centralized configuration for Hanime Stremio Addon
 * All environment variables and configuration constants are defined here
 */

const packageJson = require('../package.json');

const config = {
  server: {
    port: parseInt(process.env.PORT, 10) || 61327,
    publicUrl: process.env.PUBLIC_URL || null, // Will be set at runtime if not provided
    env: process.env.NODE_ENV || 'development'
  },

  api: {
    authority: 'hanime.tv',
    defaultAuthority: 'hw.hanime.tv',
    manifestAuthority: 'cached.freeanimehentai.net',
    searchUrl: 'https://search.htv-services.com/',
    cdnUrl: 'https://hanime-cdn.com'
  },

  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false', // Enable in-memory cache (default: true)
    maxSize: process.env.CACHE_MAX_SIZE ? (parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000) : 1000, // Maximum number of cache entries
    browserCache: process.env.BROWSER_CACHE !== 'false', // Enable browser caching (default: true)
    upstashUrl: process.env.UPSTASH_REDIS_URL || null, // Upstash Redis URL for persistent cache (optional, highest priority)
    upstashToken: process.env.UPSTASH_REDIS_TOKEN || null, // Upstash Redis token for persistent cache (optional, highest priority)
    redisUrl: process.env.REDIS_URL || null, // Redis connection URL for persistent cache (optional, takes priority over PostgreSQL)
    postgresUrl: process.env.POSTGRESQL_URL || process.env.NETLIFY_DATABASE_URL || null, // PostgreSQL connection URL for persistent cache (optional)
    ttl: {
      catalog: 2 * 60 * 60, // 2 hours in seconds
      meta: 36 * 60 * 60, // 1.5 days in seconds
      stream: 36 * 60 * 60, // 1.5 days in seconds
      image: 30 // 30 seconds
    },
    browserCacheMaxAge: 86400, // 24 hours in seconds for browser cache headers
    imageProxy: {
      queueDelay: parseInt(process.env.IMAGE_PROXY_QUEUE_DELAY, 10) || 100, // Delay between queued requests in ms (default: 100ms)
      enabled: process.env.IMAGE_PROXY_QUEUE !== 'false' // Enable request queue (default: true)
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug', // debug, info, warn, error, silent
    enabled: process.env.LOGGING_ENABLED !== 'false' // Enable logging (default: true)
  },

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false', // Enable rate limiting (default: true)
    useRedisStore: process.env.RATE_LIMIT_USE_REDIS === 'true', // Use Redis store for rate limiting (default: false)
    // General API rate limit (for Stremio addon endpoints)
    // Set higher than slow-down delayAfter to allow legitimate browsing
    // Users browsing catalogs can generate many requests, so we're generous
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200, // 200 requests per window (allows catalog browsing)
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
      legacyHeaders: false // Disable `X-RateLimit-*` headers
    },
    // Stricter limit for image proxy (more resource-intensive)
    // Still higher than slow-down to allow some burst before blocking
    imageProxy: {
      windowMs: parseInt(process.env.RATE_LIMIT_IMAGE_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_IMAGE_MAX, 10) || 60, // 60 requests per window
      message: 'Too many image proxy requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  slowDown: {
    enabled: process.env.SLOW_DOWN_ENABLED !== 'false', // Enable slow-down (default: true)
    useRedisStore: process.env.SLOW_DOWN_USE_REDIS === 'true', // Use Redis store for slow-down (default: false)
    // General API slow-down (for Stremio addon endpoints)
    // Starts early to gradually deter abuse before hitting rate limit
    // Strategy: Start slowing at 40, rate limit at 200 (5x gap for gradual degradation)
    general: {
      windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER, 10) || 40, // Start slowing down after 40 requests (early warning)
      delayMs: parseInt(process.env.SLOW_DOWN_DELAY_MS, 10) || 300, // Add 300ms delay per request after threshold (gentle)
      maxDelayMs: parseInt(process.env.SLOW_DOWN_MAX_DELAY_MS, 10) || 3000 // Maximum delay of 3 seconds (before rate limit kicks in)
    },
    // Stricter slow-down for image proxy (more resource-intensive)
    // Starts even earlier since images are expensive
    // Strategy: Start slowing at 15, rate limit at 60 (4x gap)
    imageProxy: {
      windowMs: parseInt(process.env.SLOW_DOWN_IMAGE_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      delayAfter: parseInt(process.env.SLOW_DOWN_IMAGE_DELAY_AFTER, 10) || 15, // Start slowing down after 15 requests (early warning)
      delayMs: parseInt(process.env.SLOW_DOWN_IMAGE_DELAY_MS, 10) || 500, // Add 500ms delay per request after threshold
      maxDelayMs: parseInt(process.env.SLOW_DOWN_IMAGE_MAX_DELAY_MS, 10) || 5000 // Maximum delay of 5 seconds (before rate limit)
    }
  },

  pagination: {
    itemsPerPage: 48
  },

  addon: {
    id: process.env.ADDON_ID || 'hanime-addon',
    version: process.env.ADDON_VERSION || packageJson.version, // Env variable or package.json
    name: process.env.ADDON_NAME || 'Hanime',
    icon: process.env.ADDON_ICON || '/images/favicon.ico', // Relative path
    logo: process.env.ADDON_LOGO || '/images/logo.jpg', // Relative path
    background: process.env.ADDON_BACKGROUND || '/images/background.jpg', // Relative path
    description: process.env.ADDON_DESCRIPTION || 'Enjoy your unlimited hentai & anime collection. We are the definitive source for the best curated 720p / 1080p HD hentai videos for free.',
    // Stremio Addons Config (optional)
    stremioAddonsConfig: (() => {
      const issuer = process.env.STREMIO_ADDONS_ISSUER;
      const signature = process.env.STREMIO_ADDONS_SIGNATURE;
      return (issuer && signature) ? { issuer, signature } : null;
    })()
  }
};

/**
 * Get the public URL (computed at runtime if not set via env)
 * @returns {string} Public URL
 */
function getPublicUrl() {
  if (config.server.publicUrl) {
    return config.server.publicUrl;
  }
  return `http://127.0.0.1:${config.server.port}`;
}

/**
 * Build full URL from relative path
 * @param {string} relativePath - Relative path (e.g., '/images/logo.jpg')
 * @returns {string} Full URL
 */
function buildFullUrl(relativePath) {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath; // Already full URL
  return `${getPublicUrl()}${relativePath}`;
}

module.exports = config;
module.exports.getPublicUrl = getPublicUrl;
module.exports.buildFullUrl = buildFullUrl;
