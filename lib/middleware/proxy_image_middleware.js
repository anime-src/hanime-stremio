/**
 * Image Proxy Middleware
 * Handles image proxying to Hanime CDN with caching and retry logic
 * Uses ID-based URLs (like Kitsu) and shared cache from lib/cache.js
 */

const logger = require('../logger');
const { cacheWrapBinaryImage } = require('../cache');
const ImageFetchService = require('../services/images/image_fetch_service');
const CdnUrlResolver = require('../services/images/cdn_url_resolver');
const MetaService = require('../services/meta_service');
const HanimeApiClient = require('../clients/hanime_api_client');

/**
 * Send image response with appropriate headers
 * @param {Object} res - Express response object
 * @param {Object} imageData - Image data { buffer, contentType }
 * @param {boolean} enableBrowserCache - Whether to enable browser caching
 */
function sendImageResponse(res, imageData, enableBrowserCache) {
  const { buffer, contentType } = imageData;

  if (enableBrowserCache) {
    // Use Netlify-specific header with durable cache for serverless functions
    res.set('Netlify-CDN-Cache-Control', 'public, durable, max-age=86400, stale-while-revalidate=3600');
    // Fallback for non-Netlify environments
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
  } else {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  res.set('Content-Type', contentType);
  res.set('Content-Length', buffer.length);
  res.send(buffer);
}

/**
 * Fetch image with caching (using shared cache like Kitsu)
 * Uses video ID + image type as cache key
 */
async function fetchImageWithCache(videoId, imageType, cdnUrl, imageFetchService) {
  const cacheKey = `${videoId}:${imageType}`;

  return cacheWrapBinaryImage(cacheKey, async () => {
    // Extract pathname from CDN URL
    const urlObj = new URL(cdnUrl);
    const imagePath = urlObj.pathname;
    return await imageFetchService.fetch(cdnUrl, imagePath);
  });
}

/**
 * Create image proxy middleware for Express
 * @param {Object} config - Configuration object
 * @param {HanimeApiClient} apiClient - Optional existing API client (to avoid duplicate initialization)
 * @returns {Function} Express middleware
 */
function createImageProxyMiddleware(config, apiClient = null) {
  const cdnUrl = config.api.cdnUrl;
  const imageFetchService = new ImageFetchService(cdnUrl);
  // Use provided apiClient or create a new one if not provided
  const client = apiClient || new HanimeApiClient(config);
  const metaService = new MetaService(client, config);
  const cdnUrlResolver = new CdnUrlResolver(metaService);

  return async (req, res) => {
    const { id, type } = req.params;

    // Validate params
    if (!id || !type) {
      logger.warn('Invalid proxy request - missing params', { id, type });
      return res.status(400).send('Invalid request');
    }

    // Decode the ID
    const videoId = decodeURIComponent(id);

    try {
      // Get CDN URL from meta service (uses cache internally)
      const cdnImageUrl = await cdnUrlResolver.resolve(videoId, type);

      if (!cdnImageUrl) {
        logger.warn('CDN URL not found', { videoId, type });
        return res.status(404).send('Image not found');
      }

      // Fetch image with caching
      const imageData = await fetchImageWithCache(videoId, type, cdnImageUrl, imageFetchService);

      // Send response
      sendImageResponse(res, imageData, config.cache.browserCache);
    } catch (err) {
      // Log 403 errors at debug level to reduce noise (CDN blocking)
      const status = err.response?.status;
      if (status === 403) {
        logger.debug('Proxy 403 after retries (likely CDN blocking)', {
          videoId,
          type
        });
      } else {
        logger.error('Proxy error', {
          videoId,
          type,
          error: err.message,
          status
        });
      }

      if (!res.headersSent) {
        res.status(err.response?.status || 502).send('Failed to proxy image');
      }
    }
  };
}

module.exports = createImageProxyMiddleware;
