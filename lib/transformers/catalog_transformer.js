/**
 * Catalog Transformer
 * Transforms Hanime catalog items to Stremio format
 */

const config = require('../config');
const { buildFullUrl } = require('../config');
const constants = require('../constants');
const { capitalizeGenres, proxyURLById, cleanDescription } = require('./formatters');

/**
 * Transform Hanime search result to Stremio catalog item (regular videos)
 * @param {Object} catalog - Hanime catalog item
 * @returns {Object} Stremio catalog item
 */
function toStremioCatalogItem(catalog) {
  if (!catalog) return null;

  const genres = catalog.tags && Array.isArray(catalog.tags)
    ? capitalizeGenres(catalog.tags)
    : [];

  const slug = catalog.slug || '';
  const prefixedId = slug ? `${constants.addonPrefix}:${slug}` : '';

  return {
    id: prefixedId,
    name: catalog.name || '',
    poster: proxyURLById(prefixedId, 'poster'),
    logo: buildFullUrl(config.addon.logo),
    genre: genres,
    description: cleanDescription(catalog.description),
    posterShape: 'poster',
    type: constants.contentTypes.DEFAULT,
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

  const genres = seriesItem.tags && Array.isArray(seriesItem.tags)
    ? capitalizeGenres(seriesItem.tags)
    : [];

  // Series items from SeriesService already have "series:" prefix, add "hanime:" prefix
  const originalId = seriesItem.slug || seriesItem.id || '';
  const prefixedId = originalId ? `${constants.addonPrefix}:${originalId}` : '';

  const item = {
    id: prefixedId,
    name: seriesItem.name || '',
    poster: proxyURLById(prefixedId, 'poster'),
    background: proxyURLById(prefixedId, 'background'),
    description: cleanDescription(seriesItem.description),
    posterShape: 'poster',
    type: constants.contentTypes.SERIES
  };

  // Add genres if available
  if (genres.length > 0) {
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
function toStremioCatalog(hanimeResults) {
  if (!Array.isArray(hanimeResults)) return [];
  
  return hanimeResults
    .map(item => toStremioCatalogItem(item))
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
