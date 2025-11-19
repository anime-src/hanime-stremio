/**
 * Image Fetch Service
 * Handles CDN image fetching with retry logic and failure tracking
 */

const axios = require('axios');
const mime = require('mime-types');
const logger = require('../../logger');

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ImageFetchService {
  constructor(cdnUrl) {
    this.cdnUrl = cdnUrl;
    this.failedRequests = new Map(); // key -> timestamp of last 403
  }

  /**
   * Fetch image with retry logic
   */
  async fetch(imageUrl, imagePath, maxRetries = 2) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.5',
      'Origin': 'https://hanime.tv',
      'Referer': 'https://hanime.tv/',
      'Sec-GPC': '1',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Priority': 'u=4, i',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    };
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if this URL recently failed with 403 (within last 60 seconds)
        const lastFailure = this.failedRequests.get(imageUrl);
        if (lastFailure && Date.now() - lastFailure < 60000) {
          // Wait a bit before retrying
          const waitTime = 2000 + Math.random() * 3000; // 2-5 seconds with jitter
          logger.debug('Waiting before retry after recent 403', { 
            path: imagePath, 
            waitTime: `${Math.round(waitTime)}ms` 
          });
          await sleep(waitTime);
        }
        
        logger.debug('Fetching image from CDN', { 
          url: imageUrl, 
          attempt: attempt + 1,
          maxRetries: maxRetries + 1 
        });
        
        const response = await axios.get(imageUrl, {
          headers,
          responseType: 'arraybuffer',
          timeout: 10000 // 10 second timeout
        });
        
        // Success - remove from failed cache if present
        this.failedRequests.delete(imageUrl);
        
        // Determine content type
        const contentType = response.headers['content-type'] || 
                           mime.lookup(imageUrl) || 
                           'image/jpeg';
        
        return {
          buffer: response.data,
          contentType
        };
      } catch (err) {
        const status = err.response?.status;
        
        // If 403, cache the failure and retry with backoff
        if (status === 403 && attempt < maxRetries) {
          this.failedRequests.set(imageUrl, Date.now());
          
          // Exponential backoff: 5s, 15s, 30s
          const backoffDelay = [5000, 15000, 30000][attempt] || 30000;
          const jitter = Math.random() * 2000; // Add 0-2s jitter
          const delay = backoffDelay + jitter;
          
          logger.debug('Proxy 403, retrying with backoff', { 
            path: imagePath, 
            attempt: attempt + 1,
            delay: `${Math.round(delay)}ms`
          });
          
          await sleep(delay);
          continue;
        }
        
        // If not retrying, throw the error
        throw err;
      }
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      failedRequests: this.failedRequests.size
    };
  }
}

module.exports = ImageFetchService;

