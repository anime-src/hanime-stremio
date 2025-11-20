/**
 * Formatting Utilities
 * Shared formatting functions for transformers
 */

const { getPublicUrl } = require('../config');

/**
 * Capitalize genre tags
 * @param {Array<string>} tags - Array of tag strings
 * @returns {Array<string>} Capitalized tags
 */
function capitalizeGenres(tags) {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .filter(tag => tag && typeof tag === 'string')
    .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase());
}

/**
 * Capitalize and format a title string
 * @param {string} string - String to titleize
 * @param {string} separator - Separator character
 * @returns {string} Titleized string
 */
function titleize(string, separator = ' ') {
  if (!string) return '';
  
  return string
    .split(separator)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(separator);
}

/**
 * Generate ID-based proxy URL (like Kitsu)
 * @param {string} videoId - Video ID (e.g., "hanime:video-slug")
 * @param {string} imageType - Image type ("poster" or "background")
 * @returns {string} Proxy URL (e.g., "/proxy/image/hanime:video-slug/poster")
 */
function proxyURLById(videoId, imageType) {
  if (!videoId || !imageType) return '';
  
  const baseUrl = getPublicUrl();
  // Encode the ID to handle special characters
  const encodedId = encodeURIComponent(videoId);
  return `${baseUrl}/proxy/image/${encodedId}/${imageType}`;
}

/**
 * Clean HTML tags from description
 * @param {string} description - Raw description with HTML
 * @returns {string} Clean description
 */
function cleanDescription(description) {
  if (!description) return '';
  return description.replace(/([</p>\n])/g, '').trim();
}

/**
 * Calculate rating from likes/dislikes
 * @param {number} likes - Number of likes
 * @param {number} dislikes - Number of dislikes
 * @returns {string} Rating out of 10
 */
function calculateRating(likes, dislikes) {
  const total = likes + dislikes;
  if (total === 0) return '0';
  const rating = (likes / total) * 10;
  return rating.toFixed(1);
}

/**
 * Convert duration to runtime string
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Runtime like "25 min"
 */
function formatRuntime(durationMs) {
  if (!durationMs || durationMs === 0) return '';
  const minutes = Math.round(durationMs / 60000);
  return `${minutes} min`;
}

/**
 * Extract year from unix timestamp or date string
 * @param {number|string} releasedAt - Released at timestamp or date
 * @returns {string} Year
 */
function extractYear(releasedAt) {
  if (!releasedAt) return '';
  
  if (typeof releasedAt === 'number') {
    // Unix timestamp
    return new Date(releasedAt * 1000).getFullYear().toString();
  }
  
  // ISO date string
  return new Date(releasedAt).getFullYear().toString();
}

module.exports = {
  capitalizeGenres,
  titleize,
  proxyURLById,
  cleanDescription,
  calculateRating,
  formatRuntime,
  extractYear
};
