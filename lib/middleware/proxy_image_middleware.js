/**
 * Image Proxy Middleware
 * Handles image proxying to Hanime CDN with deduplication, caching, and retry logic
 */

const logger = require('../logger');
const ImageCacheService = require('../services/images/image_cache_service');
const ImageQueueService = require('../services/images/image_queue_service');
const ImageFetchService = require('../services/images/image_fetch_service');
const ImageDeduplicationService = require('../services/images/image_deduplication_service');

/**
 * Create image proxy middleware for Express
 * @param {Object} config - Configuration object
 * @returns {Function} Express middleware
 */
function createImageProxyMiddleware(config) {
  const cdnUrl = config.api.cdnUrl;
  
  // Initialize services
  const imageCache = new ImageCacheService(30 * 1000); // 30 seconds TTL
  const imageFetch = new ImageFetchService(cdnUrl);
  const inFlight = new ImageDeduplicationService();
  
  // Initialize queue service
  const queueDelay = config.cache.imageProxy?.queueDelay || 100;
  const queueEnabled = config.cache.imageProxy?.enabled !== false;
  
  // Set up fetch function with caching
  const fetchImageWithCache = async (imageUrl, imagePath) => {
    const result = await imageFetch.fetch(imageUrl, imagePath);
    imageCache.set(imageUrl, result.buffer, result.contentType);
    return result;
  };
  
  // Initialize queue service with dependencies
  const imageQueue = new ImageQueueService(queueDelay, queueEnabled, imageCache, inFlight, fetchImageWithCache);
  
  // Periodic stats logging
  setInterval(() => {
    logger.debug('Image proxy stats', { 
      cacheSize: imageCache.getSize(), 
      inFlight: inFlight.getSize(),
      queueSize: imageQueue.getSize(),
      failedRequests: imageFetch.getStats().failedRequests
    });
  }, 60000); // Every minute
  
  /**
   * Fetch image with caching, deduplication, and queuing
   */
  async function fetchImage(imageUrl, imagePath) {
    // 1) Return from cache if available
    const cached = imageCache.get(imageUrl);
    if (cached) {
      logger.debug('Image served from cache', { 
        path: imagePath, 
        cacheSize: imageCache.getSize() 
      });
      return cached;
    }
    
    // 2) Dedupe: return pending Promise if exists
    if (inFlight.has(imageUrl)) {
      logger.debug('Deduplicating in-flight request', { 
        path: imagePath, 
        inFlight: inFlight.getSize() 
      });
      return inFlight.get(imageUrl);
    }
    
    // 3) Queue request if queue is enabled, otherwise fetch immediately
    const queuedPromise = imageQueue.queue(imageUrl, imagePath);
    if (queuedPromise) {
      logger.debug('Queuing request', { 
        path: imagePath, 
        queueSize: imageQueue.getSize() 
      });
      return queuedPromise;
    }
    
    // 4) Start new CDN fetch immediately (no queue)
    logger.debug('Starting new CDN fetch (no queue)', { 
      path: imagePath, 
      cacheSize: imageCache.getSize(),
      inFlight: inFlight.getSize() 
    });
    
    const promise = fetchImageWithCache(imageUrl, imagePath)
      .finally(() => {
        // Remove from in-flight map
        inFlight.delete(imageUrl);
      });
    
    inFlight.set(imageUrl, promise);
    return promise;
  }

  return async (req, res) => {
    const { type, image } = req.params;
    const imagePath = `/images/${type}/${image}`;
    
    logger.debug('Proxy request', { type, image, path: imagePath });
    
    // Validate path to prevent path traversal attacks
    if (type.includes('..') || image.includes('..')) {
      logger.warn('Invalid proxy path detected', { type, image });
      return res.status(400).send('Invalid path');
    }
    
    const imageUrl = `${cdnUrl}${imagePath}`;
    
    try {
      const { buffer, contentType } = await fetchImage(imageUrl, imagePath);
      
      // Set cache headers for client-side caching
      if (config.cache.browserCache) {
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      
      // Set content type and length
      res.set('Content-Type', contentType);
      res.set('Content-Length', buffer.length);
      
      // Send the buffer
      res.send(buffer);
      
      logger.debug('Image proxied successfully', { 
        path: imagePath, 
        contentType,
        size: buffer.length
      });
    } catch (err) {
      // Log 403 errors at debug level to reduce noise (CDN blocking)
      const status = err.response?.status;
      if (status === 403) {
        logger.debug('Proxy 403 after retries (likely CDN blocking)', { 
          path: imagePath, 
          url: imageUrl
        });
      } else {
        logger.error('Proxy error', { 
          path: imagePath, 
          url: imageUrl,
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

