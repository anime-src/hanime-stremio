/**
 * CDN URL Resolver
 * Resolves CDN URLs from meta service cache
 */

class CdnUrlResolver {
  constructor(metaService) {
    this.metaService = metaService;
  }

  /**
   * Get CDN URL by fetching meta data (uses cached meta if available)
   * @param {string} videoId - Video ID (e.g., "hanime:video-slug" or "hanime:series:base:episode-slug")
   * @param {string} imageType - Image type ("poster" or "background")
   * @returns {Promise<string>} CDN URL or empty string
   */
  async resolve(videoId, imageType) {
    try {
      // Check if this is an episode ID (format: hanime:series:base:episode-slug)
      const parts = videoId.split(':');
      const isEpisode = parts.length >= 4 && parts[1] === 'series';
      
      if (isEpisode) {
        return await this.resolveEpisodeUrl(videoId, parts, imageType);
      }

      // Regular video or series meta
      return await this.resolveVideoUrl(videoId, imageType);
    } catch (error) {
      return '';
    }
  }

  /**
   * Resolve CDN URL for an episode thumbnail
   */
  async resolveEpisodeUrl(videoId, parts, imageType) {
    // Extract series ID (first 3 parts: hanime:series:base)
    const seriesId = parts.slice(0, 3).join(':');
    const seriesMeta = await this.metaService.getMetaData(seriesId);
    
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

  /**
   * Resolve CDN URL for a video or series
   */
  async resolveVideoUrl(videoId, imageType) {
    const meta = await this.metaService.getMetaData(videoId);
    
    if (!meta || !meta._cdnUrls) {
      return '';
    }

    if (imageType === 'poster' || imageType === 'cover') {
      return meta._cdnUrls.poster || '';
    } else if (imageType === 'background') {
      return meta._cdnUrls.background || '';
    }

    return '';
  }
}

module.exports = CdnUrlResolver;
