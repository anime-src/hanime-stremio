/**
 * Hanime Stremio Addon
 * Main addon entry point with clean dependency injection
 */

const { addonBuilder } = require('stremio-addon-sdk');
const config = require('./lib/config');
const logger = require('./lib/logger');
const constants = require('./lib/constants');

// Services
const HanimeApiClient = require('./lib/clients/hanime_api_client');
const CacheService = require('./lib/services/cache_service');
const CatalogPrefetchService = require('./lib/services/catalog_prefetch_service');

// Handlers
const { CatalogHandler, MetaHandler, StreamHandler } = require('./lib/handlers');

// Initialize services
const apiClient = new HanimeApiClient(config);
const cache = config.cache.enabled 
  ? new CacheService(config.cache.maxSize, config.cache.ttl)
  : null;

// Initialize prefetch service if enabled
let prefetchService = null;
if (config.cache.prefetch?.enabled) {
  prefetchService = new CatalogPrefetchService(apiClient, cache, config);
  
  // Start initial prefetch (non-blocking)
  prefetchService.prefetchAll().catch(err => {
    logger.error('Initial prefetch failed', { error: err.message });
  });
  
  // Setup periodic refresh
  const refreshInterval = config.cache.prefetch.refreshInterval;
  setInterval(() => {
    logger.info('Starting scheduled catalog prefetch refresh');
    prefetchService.prefetchAll().catch(err => {
      logger.error('Scheduled prefetch refresh failed', { error: err.message });
    });
  }, refreshInterval);
  
  logger.info('Catalog prefetch enabled', {
    refreshInterval: `${refreshInterval / 1000 / 60} minutes`
  });
}

// Initialize handlers with dependency injection
const catalogHandler = new CatalogHandler(apiClient, cache, logger, config, prefetchService);
const metaHandler = new MetaHandler(apiClient, cache, logger, config);
const streamHandler = new StreamHandler(apiClient, cache, logger, config);

// Setup periodic cache cleanup (every 30 minutes) if cache is enabled
if (cache) {
  setInterval(() => {
    const cleaned = cache.cleanup();
    if (cleaned > 0 || logger.isEnabled('debug')) {
      logger.info('Periodic cache cleanup', cache.getStats());
    }
  }, 30 * 60 * 1000);
}

// Build manifest
const manifest = {
  id: config.addon.id,
  version: config.addon.version,
  behaviorHints: {
    adult: true
  },
  catalogs: [
    {
      type: constants.contentTypes.DEFAULT,
      name: 'Hanime',
      id: constants.catalogCategories.Hanime,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.Series,
      name: 'Hanime Series',
      id: constants.catalogCategories.Series,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.DEFAULT,
      name: 'Hanime Recent',
      id: constants.catalogCategories.Recent,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.DEFAULT,
      name: 'Hanime Most Likes',
      id: constants.catalogCategories.Mostlikes,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.DEFAULT,
      name: 'Hanime Most Views',
      id: constants.catalogCategories.MostViews,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.DEFAULT,
      name: 'Hanime Newest',
      id: constants.catalogCategories.Newset,
      extra: constants.catalogExtras
    }
  ],
  resources: ['catalog', 'stream', 'meta'],
  types: [constants.contentTypes.Anime, constants.contentTypes.Movie, constants.contentTypes.Series],
  idPrefixes: [constants.addonPrefix],
  name: config.addon.name,
  icon: config.addon.icon,
  logo: config.addon.logo,
  background: config.addon.background,
  description: config.addon.description,
  stremioAddonsConfig: config.addon.stremioAddonsConfig
};

// Build addon
const builder = new addonBuilder(manifest);

// Register handlers
builder.defineCatalogHandler((args) => catalogHandler.handle(args));
builder.defineMetaHandler((args) => metaHandler.handle(args));
builder.defineStreamHandler((args) => streamHandler.handle(args));

// Log initialization
logger.info('Addon initialized', {
  addon: {
    id: config.addon.id,
    name: config.addon.name,
    version: manifest.version
  },
  server: {
    port: config.server.port,
    environment: config.server.env,
    publicUrl: config.server.publicUrl
  },
  cache: {
    enabled: config.cache.enabled,
    maxSize: config.cache.enabled ? config.cache.maxSize : 'N/A',
    catalogCacheEnabled: config.cache.catalogCacheEnabled,
    catalogTtl: `${config.cache.catalogTtl / 1000 / 60} minutes`,
    metaTtl: `${config.cache.metaTtl / 1000 / 60 / 60} hours`,
    streamTtl: `${config.cache.streamTtl / 1000 / 60 / 60} hours`,
    browserCache: config.cache.browserCache
  },
  imageProxy: {
    enabled: config.cache.imageProxy.enabled,
    queueDelay: `${config.cache.imageProxy.queueDelay}ms`
  },
  prefetch: {
    enabled: config.cache.prefetch?.enabled || false,
    refreshInterval: config.cache.prefetch?.enabled ? `${config.cache.prefetch.refreshInterval / 1000 / 60} minutes` : 'N/A',
    concurrency: config.cache.prefetch?.enabled ? config.cache.prefetch.concurrency : 'N/A',
    pageDelay: config.cache.prefetch?.enabled ? `${config.cache.prefetch.pageDelay}ms` : 'N/A'
  },
  logging: {
    level: config.logging.level,
    enabled: config.logging.enabled
  },
  pagination: {
    itemsPerPage: config.pagination.itemsPerPage
  }
});

module.exports = builder.getInterface();
