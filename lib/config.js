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
    searchUrl: 'https://search.htv-services.com/',
    cdnUrl: 'https://hanime-cdn.com'
  },
  
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false', // Enable in-memory cache (default: true)
    maxSize: process.env.CACHE_MAX_SIZE ? (parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000) : 1000, // Maximum number of cache entries
    browserCache: process.env.BROWSER_CACHE !== 'false', // Enable browser caching (default: true)
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
    level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error, silent
    enabled: process.env.LOGGING_ENABLED !== 'false' // Enable logging (default: true)
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

