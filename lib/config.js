/**
 * Centralized configuration for Hanime Stremio Addon
 * All environment variables and configuration constants are defined here
 */

const packageJson = require('../package.json');

const config = {
  server: {
    port: parseInt(process.env.PORT, 10) || 61327,
    get publicUrl() {
      const port = parseInt(process.env.PORT, 10) || 61327;
      return process.env.PUBLIC_URL || `http://127.0.0.1:${port}`;
    },
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
    maxAge: 1.5 * 24 * 60 * 60, // 1.5 days in seconds
    staleError: 6 * 30 * 24 * 60 * 60, // 6 months in seconds
    maxSize: 100, // Maximum number of cache entries
    ttl: 1.5 * 24 * 60 * 60 * 1000, // 1.5 days in milliseconds
    browserCache: process.env.BROWSER_CACHE !== 'false' // Enable browser caching (default: true)
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
    get icon() {
      return process.env.ADDON_ICON || `${config.server.publicUrl || ''}/images/favicon.ico`;
    },
    get logo() {
      return process.env.ADDON_LOGO || `${config.server.publicUrl || ''}/images/logo.jpg`;
    },
    get background() {
      return process.env.ADDON_BACKGROUND || `${config.server.publicUrl || ''}/images/background.jpg`;
    },
    description: process.env.ADDON_DESCRIPTION || 'Enjoy your unlimited hentai & anime collection. We are the definitive source for the best curated 720p / 1080p HD hentai videos for free.',
    // Stremio Addons Config (optional)
    get stremioAddonsConfig() {
      const issuer = process.env.STREMIO_ADDONS_ISSUER;
      const signature = process.env.STREMIO_ADDONS_SIGNATURE;
      
      if (issuer && signature) {
        return {
          issuer,
          signature
        };
      }
      return null;
    }
  }
};

module.exports = config;

