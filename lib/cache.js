const cacheManager = require('cache-manager');
const config = require('./config');

const GLOBAL_KEY_PREFIX = 'hanime-stremio';
const META_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|meta`;
const CATALOG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|catalog`;
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const BINARY_IMAGES_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|binary-images`;

// TTL values in seconds (directly from config)
const CATALOG_TTL = config.cache.ttl.catalog;
const META_TTL = config.cache.ttl.meta;
const STREAM_TTL = config.cache.ttl.stream;
const BINARY_IMAGES_TTL = config.cache.ttl.image;

const NO_CACHE = !config.cache.enabled;
const MAX_SIZE = config.cache.maxSize;

const cache = initiateCache();

function initiateCache() {
  if (NO_CACHE) {
    return null;
  }

  return cacheManager.caching({
    store: 'memory',
    max: MAX_SIZE,
    ttl: META_TTL,
    ignoreCacheErrors: true
  });
}

function cacheWrap(key, method, options) {
  if (NO_CACHE || !cache) {
    return method();
  }
  return cache.wrap(key, method, options);
}

function cacheWrapCatalog(id, method) {
  return cacheWrap(`${CATALOG_KEY_PREFIX}:${id}`, method, { ttl: CATALOG_TTL });
}

function cacheWrapMeta(id, method) {
  return cacheWrap(`${META_KEY_PREFIX}:${id}`, method, { ttl: META_TTL });
}

function cacheWrapStream(id, method) {
  return cacheWrap(`${STREAM_KEY_PREFIX}:${id}`, method, { ttl: STREAM_TTL });
}

function cacheWrapBinaryImage(imagePath, method) {
  return cacheWrap(`${BINARY_IMAGES_KEY_PREFIX}:${imagePath}`, method, { ttl: BINARY_IMAGES_TTL });
}

module.exports = { cache, cacheWrapCatalog, cacheWrapMeta, cacheWrapStream, cacheWrapBinaryImage };

