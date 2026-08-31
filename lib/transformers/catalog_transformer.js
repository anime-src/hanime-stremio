/**
 * Catalog Transformer
 * Transforms Hanime catalog items to Stremio format
 */

const config = require('../config');
const { buildFullUrl } = require('../config');
const constants = require('../constants');
const { buildGenreCategories, proxyURLById, cleanDescription } = require('./formatters');

/**
 * Transform Hanime search result to Stremio catalog item (regular videos)
 * @param {Object} catalog - Hanime catalog item
 * @returns {Object} Stremio catalog item
 */
function toStremioCatalogItem(catalog, contentType = constants.contentTypes.DEFAULT) {
  if (!catalog) return null;

  const genres = buildGenreCategories(catalog.tags, catalog.brand);

  const slug = catalog.slug || '';
  const prefixedId = slug ? `${constants.addonPrefix}:${slug}` : '';

  return {
    id: prefixedId,
    name: catalog.name || '',
    // Use the CDN URLs the search dataset already carries so browsing costs no
    // per-poster meta lookups (and doesn't hit the image-proxy rate limit).
    // NOTE: hanime's fields are inverted vs their names — cover_url is the
    // portrait poster art, poster_url is the thumbnail. Mirror the meta
    // service's mapping (poster = cover_url) so images match the old proxy.
    // Fall back to the addon proxy only if the dataset item lacks them.
    poster: catalog.cover_url || catalog.poster_url || proxyURLById(prefixedId, 'poster'),
    background: catalog.poster_url || catalog.cover_url || undefined,
    logo: buildFullUrl(config.addon.logo),
    genre: genres,
    genres,
    description: cleanDescription(catalog.description),
    posterShape: 'poster',
    type: contentType,
    behaviorHints: { defaultVideoId: prefixedId }
  };
}

/**
 * Transform series item to Stremio catalog item
 * @param {Object} seriesItem - Series catalog item
 * @returns {Object} Stremio series catalog item
 */
function toStremioSeriesCatalogItem(seriesItem) {
  if (!seriesItem) return null;

  const genres = buildGenreCategories(seriesItem.tags, seriesItem.brand);

  // Series items from SeriesService already have "series:" prefix, add "hanime:" prefix
  const originalId = seriesItem.slug || seriesItem.id || '';
  const prefixedId = originalId ? `${constants.addonPrefix}:${originalId}` : '';

  const item = {
    id: prefixedId,
    name: seriesItem.name || '',
    // Direct CDN URLs from the first episode (carried on the series item),
    // proxy only as a fallback — see toStremioCatalogItem (cover_url = poster).
    poster: seriesItem.cover_url || seriesItem.poster_url || proxyURLById(prefixedId, 'poster'),
    background: seriesItem.poster_url || seriesItem.cover_url || proxyURLById(prefixedId, 'background'),
    description: cleanDescription(seriesItem.description),
    posterShape: 'poster',
    type: constants.contentTypes.SERIES
  };

  // Add genres if available
  if (genres.length > 0) {
    item.genre = genres;
    item.genres = genres;
  }

  // Add episode count
  if (seriesItem.episodeCount) {
    item.description = `${seriesItem.episodeCount} Episodes\n\n${item.description}`;
  }

  return item;
}

/**
 * Transform array of Hanime results to Stremio catalog (regular videos)
 * @param {Array} hanimeResults - Array of Hanime search results
 * @returns {Array} Array of Stremio catalog items
 */
function toStremioCatalog(hanimeResults, contentType = constants.contentTypes.DEFAULT) {
  if (!Array.isArray(hanimeResults)) return [];
  
  return hanimeResults
    .map(item => toStremioCatalogItem(item, contentType))
    .filter(item => item !== null);
}

/**
 * Transform array of series items to Stremio catalog
 * @param {Array} seriesItems - Array of series catalog items
 * @returns {Array} Array of Stremio series catalog items
 */
function toStremioSeriesCatalog(seriesItems) {
  if (!Array.isArray(seriesItems)) return [];
  
  return seriesItems
    .map(item => toStremioSeriesCatalogItem(item))
    .filter(item => item !== null);
}

module.exports = {
  toStremioCatalogItem,
  toStremioSeriesCatalogItem,
  toStremioCatalog,
  toStremioSeriesCatalog
};
