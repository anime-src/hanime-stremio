/**
 * Centralized configuration for Hanime Stremio Addon
 * All environment variables and configuration constants are defined here
 */

const packageJson = require('../package.json');

const config = {
  server: {
    port: parseInt(process.env.PORT, 10) || 61327,
    publicUrl: process.env.PUBLIC_URL,
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
    level: process.env.LOG_LEVEL || 'info' // debug, info, warn, error
  },
  
  pagination: {
    itemsPerPage: 48
  },
  
  addon: {
    id: 'hanime-addon',
    version: process.env.ADDON_VERSION || packageJson.version, // Env variable or package.json
    name: 'Hanime',
    icon: 'https://bit.ly/3ca6ETu',
    logo: 'https://i.imgur.com/sZ7Fmbl.png',
    description: 'Enjoy your unlimited hentai & anime collection. We are the definitive source for the best curated 720p / 1080p HD hentai videos for free.'
  }
};

module.exports = config;

