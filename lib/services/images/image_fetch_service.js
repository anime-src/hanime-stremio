/**
 * Image Fetch Service
 * Handles CDN image fetching with retry logic and failure tracking
 */

const axios = require('axios');
const mime = require('mime-types');

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
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
        const lastFailure = this.failedRequests.get(imageUrl);
        if (lastFailure && Date.now() - lastFailure < 60000) {
          const waitTime = 2000 + Math.random() * 3000;
          await sleep(waitTime);
        }
        
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
        
        if (status === 403 && attempt < maxRetries) {
          this.failedRequests.set(imageUrl, Date.now());
          
          const backoffDelay = [5000, 15000, 30000][attempt] || 30000;
          const jitter = Math.random() * 2000;
          const delay = backoffDelay + jitter;
          
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

