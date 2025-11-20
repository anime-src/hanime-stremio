/**
 * Image Proxy Middleware
 * Handles image proxying to Hanime CDN with caching and retry logic
 * Uses ID-based URLs (like Kitsu) and shared cache from lib/cache.js
 */

const logger = require('../logger');
const { cacheWrapBinaryImage } = require('../cache');
const ImageFetchService = require('../services/images/image_fetch_service');
const MetaService = require('../services/meta_service');
const HanimeApiClient = require('../clients/hanime_api_client');

/**
 * Create image proxy middleware for Express
 * @param {Object} config - Configuration object
 * @returns {Function} Express middleware
 */
function createImageProxyMiddleware(config) {
  const cdnUrl = config.api.cdnUrl;
  const imageFetch = new ImageFetchService(cdnUrl);
  const apiClient = new HanimeApiClient(config);
  const metaService = new MetaService(apiClient, config);
  
  /**
   * Fetch image with caching (using shared cache like Kitsu)
   * Uses video ID + image type as cache key
   */
  async function fetchImage(videoId, imageType, cdnUrl) {
    const cacheKey = `${videoId}:${imageType}`;
    
    return cacheWrapBinaryImage(cacheKey, async () => {
      // Extract pathname from CDN URL
      const urlObj = new URL(cdnUrl);
      const imagePath = urlObj.pathname;
      return await imageFetch.fetch(cdnUrl, imagePath);
    });
  }

  /**
   * Get CDN URL by fetching meta data (uses cached meta if available)
   * @param {string} videoId - Video ID (e.g., "hanime:video-slug" or "hanime:series:base:episode-slug")
   * @param {string} imageType - Image type ("poster" or "background")
   * @returns {Promise<string>} CDN URL or empty string
   */
  async function getCdnUrl(videoId, imageType) {
    try {
      // Check if this is an episode ID (format: hanime:series:base:episode-slug)
      const parts = videoId.split(':');
      const isEpisode = parts.length >= 4 && parts[1] === 'series';
      
      if (isEpisode) {
        // Extract series ID (first 3 parts: hanime:series:base)
        const seriesId = parts.slice(0, 3).join(':');
        const seriesMeta = await metaService.getMetaData(seriesId);
        
        if (seriesMeta && seriesMeta._episodeCdnUrls && seriesMeta._episodeCdnUrls[videoId]) {
          const episodeUrls = seriesMeta._episodeCdnUrls[videoId];
          if (imageType === 'poster' || imageType === 'cover') {
            return episodeUrls.poster || '';
          } else if (imageType === 'background') {
            return episodeUrls.background || '';
          }
        }
        
        return '';
      }

      // Regular video or series meta
      const meta = await metaService.getMetaData(videoId);
      
      if (!meta) return '';

      // Use main meta CDN URLs
      if (meta._cdnUrls) {
        if (imageType === 'poster' || imageType === 'cover') {
          return meta._cdnUrls.poster || '';
        } else if (imageType === 'background') {
          return meta._cdnUrls.background || '';
        }
      }

      return '';
    } catch (error) {
      logger.debug('Failed to get CDN URL from meta service', { videoId, imageType, error: error.message });
      return '';
    }
  }

  return async (req, res) => {
    const { id, type } = req.params;
    
    // Validate params
    if (!id || !type) {
      logger.warn('Invalid proxy request - missing params', { id, type });
      return res.status(400).send('Invalid request');
    }

    // Decode the ID
    const videoId = decodeURIComponent(id);
    let cdnImageUrl = '';
    
    try {
      // Get CDN URL from meta service (uses cache internally)
      cdnImageUrl = await getCdnUrl(videoId, type);
      
      if (!cdnImageUrl) {
        logger.warn('CDN URL not found', { videoId, type });
        return res.status(404).send('Image not found');
      }
      
      const { buffer, contentType } = await fetchImage(videoId, type, cdnImageUrl);
      
      if (config.cache.browserCache) {
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      
      res.set('Content-Type', contentType);
      res.set('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err) {
      // Log 403 errors at debug level to reduce noise (CDN blocking)
      const status = err.response?.status;
      if (status === 403) {
        logger.debug('Proxy 403 after retries (likely CDN blocking)', { 
          videoId, 
          type,
          cdnUrl: cdnImageUrl
        });
      } else {
        logger.error('Proxy error', { 
          videoId, 
          type,
          cdnUrl: cdnImageUrl,
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

