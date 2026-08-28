/**
 * Hanime Stremio Addon
 * Main addon entry point with clean dependency injection
 */

const { addonBuilder } = require('stremio-addon-sdk');
const { CatalogHandler, MetaHandler, StreamHandler } = require('./lib/handlers');
const { buildFullUrl } = require('./lib/config');

const config = require('./lib/config');
const logger = require('./lib/logger');
const constants = require('./lib/constants');
const HanimeApiClient = require('./lib/clients/hanime_api_client');
const UserApiManager = require('./lib/clients/user_api_manager');
const apiClient = new HanimeApiClient(config);
const userApiManager = new UserApiManager();
const catalogHandler = new CatalogHandler(apiClient, logger, config);
const metaHandler = new MetaHandler(apiClient, logger, config);
const streamHandler = new StreamHandler(logger, config, userApiManager);

// Pre-warm the stream signature module (boots a WASM sandbox, ~2-3s) so the
// first stream request doesn't pay the cost. Non-blocking; failures are logged
// by the service and simply mean the first request warms it lazily instead.
require('./lib/services/htv_signature_service').init().catch(() => {});

const manifest = {
  id: config.addon.id,
  version: config.addon.version,
  behaviorHints: {
    adult: true,
    configurable: true,
    configurationRequired: true
  },
  config: [
    {
      key: 'email',
      title: 'Email',
      type: 'text',
      required: true
    },
    {
      key: 'password',
      title: 'Password',
      type: 'password',
      required: true
    }
  ],
  catalogs: [
    // Anime catalogs.
    //
    // The brand list (~1,900 bytes) is only attached to catalogs where
    // discovery filtering matters most — main Hanime and Uncensored.
    // The four sort-only catalogs (Recent / Most Likes / Most Views /
    // Newest) drop the genre dropdown entirely to keep the manifest
    // under Stremio's 8 KB ceiling.
    //
    // `search` is intentionally only declared on the main Hanime catalog
    // and the Series catalog. Stremio only routes search queries to
    // catalogs that advertise `search` in their extras, so a single query
    // produces one anime row + one series row instead of five duplicate
    // rows of identical hits across the sort and uncensored catalogs.
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime',
      id: constants.catalogCategories.HANIME,
      extra: constants.catalogExtrasWithBrands
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Recent',
      id: constants.catalogCategories.RECENT,
      extra: constants.catalogExtrasSortOnly
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Most Likes',
      id: constants.catalogCategories.MOST_LIKES,
      extra: constants.catalogExtrasSortOnly
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Most Views',
      id: constants.catalogCategories.MOST_VIEWS,
      extra: constants.catalogExtrasSortOnly
    },
    {
      type: constants.contentTypes.ANIME,
      name: 'Hanime Newest',
      id: constants.catalogCategories.NEWEST,
      extra: constants.catalogExtrasSortOnly
    },
    {
      type: constants.contentTypes.SERIES,
      name: 'Hanime Uncensored',
      id: constants.catalogCategories.UNCENSORED,
      extra: constants.catalogExtrasUncensored
    },
    // Series catalogs — minimal extras to keep manifest under 8 KB.
    {
      type: constants.contentTypes.SERIES,
      name: 'Hanime Series',
      id: constants.catalogCategories.SERIES,
      extra: constants.catalogExtrasMinimal
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
    browserCacheMaxAge: `${config.cache.browserCacheMaxAge / 60 / 60} hours`,
    upstashUrl: config.cache.upstashUrl ? config.cache.upstashUrl.replace(/\/\/.*@/, '//***@') : null,
    upstashToken: config.cache.upstashToken,
    redisUrl: config.cache.redisUrl ? config.cache.redisUrl.replace(/\/\/.*@/, '//***@') : null,
    postgresUrl: config.cache.postgresUrl ? config.cache.postgresUrl.replace(/\/\/.*@/, '//***@') : null
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
module.exports.apiClient = apiClient; // Export apiClient for use in middleware
module.exports.userApiManager = userApiManager; // Export userApiManager for use in middleware
