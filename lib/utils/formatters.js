/**
 * Utility Formatters
 * Pure utility functions for string formatting
 * (Most formatting moved to TransformService)
 */

const constants = require('../constants');

/**
 * Capitalize first letter of each word
 * @param {string} string - String to titleize
 * @param {string} separator - Word separator
 * @returns {string} Titleized string
 */
function titleize(string, separator = ' ') {
  if (!string) return '';
  
  return string
    .split(separator)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(separator);
}

/**
 * Clean HTML from description text
 * @param {string} description - Description with potential HTML
 * @returns {string} Clean description
 */
function cleanHtml(description) {
  if (!description) return '';
  return description.replace(/([</p>\n])/g, '').trim();
}

/**
 * Format file size in bytes to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to minutes
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (!ms || ms === 0) return '0 min';
  
  const minutes = Math.floor(ms / 60000);
  return `${minutes} min`;
}

/**
 * Check if an ID is a Hanime ID
 * With idPrefixes set in manifest, Stremio should only route IDs starting with "hanime:" to this addon
 * @param {string} id - ID to check
 * @returns {boolean} True if it's a Hanime ID
 */
function isHanimeId(id) {
  if (!id || typeof id !== 'string') return false;
  
  // Check if ID starts with hanime: prefix
  return id.startsWith(`${constants.addonPrefix}:`);
}

/**
 * Strip the addon prefix from an ID
 * @param {string} id - ID with prefix (e.g., "hanime:video-slug" or "hanime:series:slug:episode")
 * @returns {string} ID without prefix (e.g., "video-slug" or "series:slug:episode")
 */
function stripAddonPrefix(id) {
  if (!id || typeof id !== 'string') return id;
  
  const prefix = `${constants.addonPrefix}:`;
  if (id.startsWith(prefix)) {
    return id.substring(prefix.length);
  }
  
  return id;
}

module.exports = {
  titleize,
  cleanHtml,
  formatBytes,
  formatDuration,
  isHanimeId,
  stripAddonPrefix
};

