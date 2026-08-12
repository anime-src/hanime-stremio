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
    // Universal CDN serves public video metadata. The app2-signed search
    // dataset goes through the locked Worker for local filtering.
    authority: 'www.universal-cdn.com',
    defaultAuthority: 'hw.hanime.tv',
    manifestAuthority: 'cached.freeanimehentai.net',
    searchUrl: 'https://hanime-handshake.skynetsource.com/api/v11/search_hvs',
    defaultDurationMs: 20 * 60 * 1000,
    cdnUrl: 'https://hanime-cdn.com',
    // Playable streams come from hanime's /api/v11/handshake flow through a
    // locked Cloudflare Worker. Hanime blocks the production datacenter IP,
    // while the returned /hls URLs are fetched by the viewer's own device.
    // See workers/handshake-relay and lib/services/htv_stream_resolver.js.
    htv: {
      handshakeUrl: process.env.HTV_HANDSHAKE_URL ||
        'https://hanime-handshake.skynetsource.com/api/v11/handshake',
      relaySecret: process.env.HTV_RELAY_SECRET || null,
      hlsHost: 'https://hanime.tv',
      hlsProxyUrl: process.env.HTV_HLS_PROXY_URL ||
        'https://hanime-handshake.skynetsource.com/hls',
      hlsProxyTtlSeconds: 8 * 60 * 60,
      timeoutMs: 15000
    }
  },

  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false', // Enable in-memory cache (default: true)
    maxSize: process.env.CACHE_MAX_SIZE ? (parseInt(process.env.CACHE_MAX_SIZE, 10) || 5000) : 5000, // Maximum number of cache entries (default: 5000)
    browserCache: (process.env.CACHE_BROWSER_CACHE !== undefined ? process.env.CACHE_BROWSER_CACHE !== 'false' : process.env.BROWSER_CACHE !== 'false'), // Enable browser caching (default: true, supports CACHE_BROWSER_CACHE and BROWSER_CACHE for backward compatibility)
    redisUrl: process.env.CACHE_REDIS_URL || process.env.REDIS_URL || null, // Redis connection URL for persistent cache (optional)
    ttl: {
      catalog: 2 * 60 * 60, // 2 hours in seconds
      meta: 36 * 60 * 60, // 1.5 days in seconds
      searchDataset: 6 * 60 * 60, // 6 hours in seconds
      // Streams are handshake-minted hanime.tv/hls URLs whose signed tokens may
      // rotate; six hours reduces handshake traffic while staying below their
      // observed lifetime.
      stream: 6 * 60 * 60, // 6 hours in seconds
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
    // Less restrictive: starts closer to rate limit to allow more normal usage
    // Strategy: Start slowing at 150, rate limit at 200 (smaller gap, less aggressive)
    general: {
      windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER, 10) || 150, // Start slowing down after 150 requests (closer to rate limit)
      delayMs: parseInt(process.env.SLOW_DOWN_DELAY_MS, 10) || 200, // Add 200ms delay per request after threshold (gentle)
      maxDelayMs: parseInt(process.env.SLOW_DOWN_MAX_DELAY_MS, 10) || 2000 // Maximum delay of 2 seconds (before rate limit kicks in)
    },
    // Less restrictive slow-down for image proxy (more resource-intensive)
    // Starts closer to rate limit to allow more normal usage
    // Strategy: Start slowing at 45, rate limit at 60 (smaller gap)
    imageProxy: {
      windowMs: parseInt(process.env.SLOW_DOWN_IMAGE_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
      delayAfter: parseInt(process.env.SLOW_DOWN_IMAGE_DELAY_AFTER, 10) || 45, // Start slowing down after 45 requests (closer to rate limit)
      delayMs: parseInt(process.env.SLOW_DOWN_IMAGE_DELAY_MS, 10) || 300, // Add 300ms delay per request after threshold
      maxDelayMs: parseInt(process.env.SLOW_DOWN_IMAGE_MAX_DELAY_MS, 10) || 3000 // Maximum delay of 3 seconds (before rate limit)
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
    logo: process.env.ADDON_LOGO || '/images/logo.png', // Relative path
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
