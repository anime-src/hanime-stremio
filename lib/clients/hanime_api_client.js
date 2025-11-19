/**
 * Hanime API Client
 * Encapsulates all HTTP communication with Hanime.tv APIs
 */

const axios = require('axios');
const logger = require('../logger');

class HanimeApiClient {
  constructor(config) {
    this.authority = config.api.authority;
    this.defaultAuthority = config.api.defaultAuthority;
    this.searchUrl = config.api.searchUrl;
    this.baseUrl = `https://${this.authority}`;
    
    // HTTP headers for search API
    this.searchHeaders = {
      'authority': 'search.htv-services.com',
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      'origin': 'https://hanime.tv',
      'referer': 'https://hanime.tv/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  /**
   * Get headers for video API requests
   */
  getVideoHeaders(authority) {
    return {
      'authority': authority,
      'accept': 'application/json, text/plain, */*',
      'origin': 'https://hanime.tv',
      'if-none-match': 'W/"a5e2787805920a8145ce33ab7c0fd947"'
    };
  }

  /**
   * Search for videos
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Array of video results
   */
  async search({ query = '', tags = [], orderBy = 'created_at_unix', ordering = 'desc', page = 0 }) {
    try {
      const body = {
        search_text: query,
        tags: tags,
        tags_mode: 'AND',
        brands: [],
        blacklist: [],
        order_by: orderBy,
        ordering: ordering,
        page: page
      };

      logger.debug('Hanime search API request', { query, tagsCount: tags.length, page });
      
      const response = await axios.post(this.searchUrl, body, { 
        headers: this.searchHeaders 
      });

      if (response.status === 200 && response.data) {
        
        // Parse the nested JSON structure
        const hits = JSON.parse(response.data.hits || '[]');
        logger.debug('Hanime search API success', { resultsCount: hits.length });
        return Array.isArray(hits) ? hits : [];
      }

      logger.warn('Hanime search API non-200 status', { status: response.status });
      return [];
    } catch (error) {
      // 403 errors are often due to API blocking - log at debug level to reduce noise
      const status = error.response?.status;
      if (status === 403) {
        logger.debug('Search API 403 (likely blocked or invalid request)', { 
          query, 
          tagsCount: tags.length,
          page 
        });
      } else {
        logger.error('Search API error', { 
          query, 
          error: error.message,
          status 
        });
      }
      return [];
    }
  }

  /**
   * Get video metadata by slug
   * @param {string} slug - Video slug/ID
   * @returns {Promise<Object|null>} Video metadata or null
   */
  async getVideo(slug) {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const url = `${this.baseUrl}/api/v8/video?id=${slug}&`;
      logger.debug('Hanime video API request', { slug });

      const response = await axios.get(url, { 
        headers: this.getVideoHeaders(this.authority) 
      });

      if (response.status === 200 && response.data?.hentai_video) {
        logger.debug('Hanime video API success', { 
          slug, 
          name: response.data.hentai_video.name 
        });
        return response.data.hentai_video;
      }

      logger.warn('Hanime video API: no video data', { slug, status: response.status });
      return null;
    } catch (error) {
      logger.error('getVideo error', { 
        slug, 
        error: error.message,
        status: error.response?.status 
      });
      return null;
    }
  }

  /**
   * Get video streams by slug
   * @param {string} slug - Video slug/ID
   * @returns {Promise<Array>} Array of stream objects
   */
  async getVideoStreams(slug) {
    try {
      if (!slug) {
        throw new Error('Slug is required');
      }

      const url = `${this.baseUrl}/api/v8/video?id=${slug}&`;
      logger.debug('Fetching video streams', { slug });

      const response = await axios.get(url, { 
        headers: this.getVideoHeaders(this.authority) 
      });

      if (response.status !== 200 || !response.data) {
        logger.warn('Failed to fetch video data', { slug, status: response.status });
        return [];
      }

      const manifest = response.data.videos_manifest;
      if (!manifest || !manifest.servers || !manifest.servers[0]) {
        logger.error('Invalid video manifest structure', { 
          slug,
          hasManifest: !!manifest,
          hasServers: !!manifest?.servers,
          serversCount: manifest?.servers?.length || 0
        });
        return [];
      }

      const streams = manifest.servers[0].streams || [];
      
      if (logger.isEnabled('info')) {
        logger.info('Video streams retrieved', { slug, streamsCount: streams.length });
        
        // Log stream details
        const validStreams = streams.filter(s => s.url && s.url.trim() !== '');
        logger.info('Stream summary', {
          total: streams.length,
          valid: validStreams.length,
          resolutions: streams.map(s => `${s.height || '?'}p`).join(', ')
        });
      }

      return streams;
    } catch (error) {
      logger.error('getVideoStreams error', { 
        slug, 
        error: error.message,
        status: error.response?.status 
      });
      return [];
    }
  }
}

module.exports = HanimeApiClient;

