/**
 * Hanime Stremio Addon
 * Main addon entry point with clean dependency injection
 */

const { addonBuilder } = require('stremio-addon-sdk');
const config = require('./lib/config');
const { buildFullUrl } = require('./lib/config');
const logger = require('./lib/logger');
const constants = require('./lib/constants');

const HanimeApiClient = require('./lib/clients/hanime_api_client');
const { CatalogHandler, MetaHandler, StreamHandler } = require('./lib/handlers');

const apiClient = new HanimeApiClient(config);

const catalogHandler = new CatalogHandler(apiClient, logger, config);
const metaHandler = new MetaHandler(apiClient, logger, config);
const streamHandler = new StreamHandler(apiClient, logger, config);

const manifest = {
  id: config.addon.id,
  version: config.addon.version,
  behaviorHints: {
    adult: true
  },
  catalogs: [
    // Anime catalogs
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime',
      id: constants.catalogCategories.HANIME,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Recent',
      id: constants.catalogCategories.RECENT,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Most Likes',
      id: constants.catalogCategories.MOST_LIKES,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Most Views',
      id: constants.catalogCategories.MOST_VIEWS,
      extra: constants.catalogExtras
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Newest',
      id: constants.catalogCategories.NEWEST,
      extra: constants.catalogExtras
    },
    // Series catalogs
    {
      type: constants.contentTypes.SERIES,
      name: 'Hanime Series',
      id: constants.catalogCategories.SERIES,
      extra: constants.catalogExtras
    }
  ],
  resources: ['catalog', 'stream', 'meta'],
  types: [constants.contentTypes.ANIME, constants.contentTypes.SERIES],
  idPrefixes: [constants.addonPrefix],
  name: config.addon.name,
  icon: buildFullUrl(config.addon.icon),
  logo: buildFullUrl(config.addon.logo),
  background: buildFullUrl(config.addon.background),
  description: config.addon.description
};

if (config.addon.stremioAddonsConfig) {
  manifest.stremioAddonsConfig = config.addon.stremioAddonsConfig;
}

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler((args) => catalogHandler.handle(args));
builder.defineMetaHandler((args) => metaHandler.handle(args));
builder.defineStreamHandler((args) => streamHandler.handle(args));

logger.info('Addon initialized', {
  addon: {
    id: config.addon.id,
    name: config.addon.name,
    version: manifest.version
  },
  server: {
    port: config.server.port,
    environment: config.server.env,
    publicUrl: config.server.publicUrl || 'not set (will be auto-detected)'
  },
  cache: {
    enabled: config.cache.enabled,
    maxSize: config.cache.enabled ? config.cache.maxSize : 'N/A',
    catalogTtl: `${config.cache.ttl.catalog / 60} minutes`,
    metaTtl: `${config.cache.ttl.meta / 60 / 60} hours`,
    streamTtl: `${config.cache.ttl.stream / 60 / 60} hours`,
    imageTtl: `${config.cache.ttl.image} seconds`,
    browserCache: config.cache.browserCache,
    browserCacheMaxAge: `${config.cache.browserCacheMaxAge / 60 / 60} hours`
  },
  imageProxy: {
    enabled: config.cache.imageProxy.enabled,
    queueDelay: `${config.cache.imageProxy.queueDelay}ms`
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
