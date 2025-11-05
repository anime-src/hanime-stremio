/**
 * Image Proxy Middleware
 * Handles image proxying to Hanime CDN with proper headers
 */

const axios = require('axios');
const logger = require('../logger');

/**
 * Create image proxy middleware for Express
 * @param {Object} config - Configuration object
 * @returns {Function} Express middleware
 */
function createImageProxyMiddleware(config) {
  const cdnUrl = config.api.cdnUrl;

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
      logger.debug('Fetching image from CDN', { url: imageUrl });
      
      const response = await axios.get(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.5',
          'Sec-GPC': '1',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
          'Priority': 'u=4, i',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Referer': 'https://hanime.tv/'
        },
        responseType: 'stream',
        timeout: 10000 // 10 second timeout
      });
      
      // Set cache headers for client-side caching
      if (config.cache.browserCache) {
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      
      // Copy relevant headers from CDN response
      if (response.headers['content-type']) {
        res.set('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }
      
      // Pipe the response
      response.data.pipe(res);
      
      logger.debug('Image proxied successfully', { 
        path: imagePath, 
        contentType: response.headers['content-type'],
        size: response.headers['content-length']
      });
      
      response.data.on('error', (err) => {
        logger.error('Stream error during image proxy', { 
          path: imagePath, 
          error: err.message 
        });
        if (!res.headersSent) {
          res.status(502).send('Failed to proxy image');
        }
      });
    } catch (err) {
      logger.error('Proxy error', { 
        path: imagePath, 
        url: imageUrl,
        error: err.message,
        status: err.response?.status
      });
      
      if (!res.headersSent) {
        res.status(err.response?.status || 502).send('Failed to proxy image');
      }
    }
  };
}

module.exports = createImageProxyMiddleware;

