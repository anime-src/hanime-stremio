/**
 * Hanime Stremio Addon
 * Main addon entry point with clean dependency injection
 */

const { addonBuilder } = require('stremio-addon-sdk');
const config = require('./lib/config');
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
  logging: {
    level: config.logging.level,
    enabled: config.logging.enabled
  },
  pagination: {
    itemsPerPage: config.pagination.itemsPerPage
  }
});

module.exports = builder.getInterface();
