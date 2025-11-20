const cacheManager = require('cache-manager');
const config = require('./config');

const GLOBAL_KEY_PREFIX = 'hanime-stremio';
const META_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|meta`;
const CATALOG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|catalog`;
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const BINARY_IMAGES_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|binary-images`;

// Convert milliseconds to seconds for cache-manager (v3 uses seconds)
const META_TTL = Math.floor((config.cache.metaTtl || config.cache.ttl) / 1000);
const CATALOG_TTL = Math.floor((config.cache.catalogTtl || (2 * 60 * 60 * 1000)) / 1000);
const STREAM_TTL = Math.floor((config.cache.streamTtl || config.cache.ttl) / 1000);
const BINARY_IMAGES_TTL = 30; // 30 seconds for binary image data

const NO_CACHE = !config.cache.enabled;
const MAX_SIZE = config.cache.maxSize || 1000;

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
  if (!config.cache.catalogCacheEnabled) {
    return method();
  }
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

