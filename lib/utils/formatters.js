/**
 * Utility Formatters
 * ID validation and prefix handling utilities
 */

const constants = require('../constants');

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
  isHanimeId,
  stripAddonPrefix
};

