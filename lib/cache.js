const { Keyv } = require('keyv');
const { KeyvCacheableMemory } = require('cacheable');
const { KeyvPostgres } = require('@keyv/postgres');
const config = require('./config');
const logger = require('./logger');

const GLOBAL_KEY_PREFIX = 'hanime-stremio';
const META_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|meta`;
const CATALOG_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|catalog`;
const STREAM_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|stream`;
const BINARY_IMAGES_KEY_PREFIX = `${GLOBAL_KEY_PREFIX}|binary-images`;

// TTL values in milliseconds
const CATALOG_TTL = config.cache.ttl.catalog * 1000;
const META_TTL = config.cache.ttl.meta * 1000;
const STREAM_TTL = config.cache.ttl.stream * 1000;
const BINARY_IMAGES_TTL = config.cache.ttl.image * 1000;

const NO_CACHE = !config.cache.enabled;
const MAX_SIZE = config.cache.maxSize;

// Always use memory-backed Keyv for binary images
const imageCache = NO_CACHE ? null : new Keyv({
  store: new KeyvCacheableMemory({ ttl: BINARY_IMAGES_TTL, lruSize: MAX_SIZE }),
  namespace: 'images'
});

// Use PostgreSQL-backed Keyv if configured, else memory-backed Keyv for metadata/catalog/stream
const remoteCache = NO_CACHE ? null : (config.cache.postgresUrl
  ? (() => {
      logger.info(`Using PostgreSQL cache store: ${config.cache.postgresUrl.replace(/\/\/.*@/, '//***@')}`);
      const adapter = new KeyvPostgres(config.cache.postgresUrl);
      adapter.on('error', handleConnectionError);
      return new Keyv({ store: adapter, namespace: 'meta' });
    })()
  : (() => {
      logger.debug('Using in-memory cache for metadata');
      return new Keyv({
        store: new KeyvCacheableMemory({ ttl: META_TTL, lruSize: MAX_SIZE }),
        namespace: 'meta'
      });
    })()
);

function handleConnectionError(err) {
  try {
    logger.error('Cache store connection error', { message: err && err.message ? err.message : String(err) });
  } catch (_) {
    // swallow
  }
}

async function cacheWrap(cache, key, method, ttl) {
  if (!cache) return method();

  const existing = await cache.get(key);
  if (existing !== undefined) {
    if (logger && logger.debug) logger.debug(`Cache hit key=${key}`);
    return existing;
  }

  const data = await method();
  const ttlValue = ttl instanceof Function ? ttl(data) : ttl;
  try {
    await cache.set(key, data, ttlValue);
    if (logger && logger.debug) logger.debug(`Cached key=${key} ttl=${ttlValue}`);
  } catch (e) {
    logger.warn && logger.warn(`Cache set failed key=${key} err=${e.message}`);
  }
  return data;
}

function cacheWrapCatalog(id, method) {
  return cacheWrap(remoteCache, `${CATALOG_KEY_PREFIX}:${id}`, method, CATALOG_TTL);
}

function cacheWrapMeta(id, method) {
  return cacheWrap(remoteCache, `${META_KEY_PREFIX}:${id}`, method, META_TTL);
}

function cacheWrapStream(id, method) {
  return cacheWrap(remoteCache, `${STREAM_KEY_PREFIX}:${id}`, method, STREAM_TTL);
}

function cacheWrapBinaryImage(imagePath, method) {
  return cacheWrap(imageCache, `${BINARY_IMAGES_KEY_PREFIX}:${imagePath}`, method, BINARY_IMAGES_TTL);
}

module.exports = { cacheWrapCatalog, cacheWrapMeta, cacheWrapStream, cacheWrapBinaryImage };

