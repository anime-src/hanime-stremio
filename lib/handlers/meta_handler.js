/**
 * Meta Handler
 * Handles metadata requests for individual items
 */

const constants = require('../constants');
const TransformService = require('../services/transform_service');
const SeriesService = require('../services/series_service');

class MetaHandler {
  constructor(apiClient, cache, logger, config) {
    this.apiClient = apiClient;
    this.cache = cache;
    this.logger = logger;
    this.config = config;
  }

  /**
   * Handle meta request
   */
  async handle(args) {
    try {
      const id = args.id;
      
      this.logger.debug('Meta handler called', { id, type: args.type });

      if (!id) {
        this.logger.warn('Meta handler called without ID');
        return { meta: null };
      }

      // Strip hanime: prefix if present
      const strippedId = id.startsWith(`${constants.addonPrefix}:`) 
        ? id.substring(constants.addonPrefix.length + 1) 
        : id;

      // Check if this is a series request
      const isSeries = strippedId.startsWith('series:');

      // Build cache key
      const cacheKey = `meta:${id}`;
      
      // Check cache if enabled
      if (this.cache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        this.logger.info('Meta served from cache', { id });
        return cached;
      }

      const publicUrl = this.config.server.publicUrl || process.env.PUBLIC_URL;
      let meta;

      if (isSeries) {
        // Handle series meta request (pass stripped ID with series: prefix)
        meta = await this.handleSeriesMeta(strippedId, publicUrl);
      } else {
        // Handle regular video meta request (use stripped ID without prefix)
        const video = await this.apiClient.getVideo(strippedId);

        if (!video) {
          this.logger.warn('Meta handler: no data returned', { id, strippedId });
          return { meta: null };
        }

        meta = TransformService.toStremioMeta(video, publicUrl);
      }

      if (!meta) {
        this.logger.warn('Meta handler: transformation failed', { id });
        return { meta: null };
      }

      this.logger.info('Meta handler success', { id, name: meta.name });

      const response = { meta };
      
      // Cache the response if cache is enabled
      if (this.cache) {
        this.cache.set(cacheKey, response);
      }

      return response;
    } catch (error) {
      this.logger.error('Meta handler error', { 
        id: args.id, 
        error: error.message,
        stack: error.stack 
      });
      return { meta: null };
    }
  }

  /**
   * Handle series meta request by searching and grouping episodes
   * @param {string} seriesId - Series ID (e.g., "series:mujin-eki")
   * @param {string} publicUrl - Public server URL
   * @returns {Object|null} Series meta with videos array
   */
  async handleSeriesMeta(seriesId, publicUrl) {
    try {
      // Extract base slug from series ID
      const baseSlug = seriesId.replace(/^series:/, '');
      
      // Convert slug to search term (e.g., "mujin-eki" -> "mujin eki")
      const searchTerm = baseSlug.replace(/-/g, ' ');
      
      // Search specifically for this series to get all episodes
      const allVideos = await this.apiClient.search({
        query: searchTerm,
        tags: [],
        orderBy: 'created_at_unix',
        ordering: 'desc',
        page: 0
      });

      if (!allVideos || allVideos.length === 0) {
        this.logger.warn('Series meta: no videos found', { seriesId, searchTerm });
        return null;
      }

      this.logger.debug('Series search results', { 
        seriesId, 
        searchTerm, 
        resultsCount: allVideos.length 
      });

      // Get episodes for this series
      const episodes = SeriesService.getSeriesEpisodes(allVideos, baseSlug);

      if (!episodes || episodes.length === 0) {
        this.logger.warn('Series meta: no episodes found', { 
          seriesId, 
          baseSlug, 
          searchTerm,
          searchResultsCount: allVideos.length 
        });
        return null;
      }

      // Get series name from first episode
      const episodeInfo = SeriesService.parseEpisodeInfo(episodes[0].name);
      const seriesName = episodeInfo ? episodeInfo.baseName : episodes[0].name;

      // Transform to Stremio series meta
      const meta = TransformService.toStremioSeriesMeta(
        seriesId,
        seriesName,
        episodes,
        publicUrl
      );

      this.logger.info('Series meta created', { 
        seriesId, 
        seriesName,
        episodeCount: episodes.length 
      });

      return meta;
    } catch (error) {
      this.logger.error('Series meta error', { 
        seriesId, 
        error: error.message 
      });
      return null;
    }
  }
}

module.exports = MetaHandler;

