/**
 * Stream Transformer
 * Transforms Hanime streams to Stremio format
 */

const { titleize } = require('./formatters');

/**
 * Transform Hanime stream to Stremio stream object
 * @param {Object} stream - Hanime stream object
 * @returns {Object} Stremio stream object
 */
function toStremioStream(stream) {
  if (!stream || !stream.url) return null;

  const groupName = stream.video_stream_group_id || '';
  const name = titleize(groupName.replace(/-/g, ' '));
  const durationMin = stream.duration_in_ms 
    ? (stream.duration_in_ms / 60000).toFixed(0)
    : '0';

  return {
    name: `Hanime.TV\n${stream.height || 0}p`,
    title: `${name.slice(0, -3)}\n 💾 ${stream.filesize_mbs || 0} MB ⌚ ${durationMin} min`,
    url: stream.url
  };
}

/**
 * Transform array of Hanime streams to Stremio streams
 * @param {Array} hanimeStreams - Array of Hanime stream objects
 * @param {Object} cacheConfig - Cache configuration
 * @returns {Object} Stremio streams response
 */
function toStremioStreams(hanimeStreams, cacheConfig) {
  if (!Array.isArray(hanimeStreams)) {
    return { streams: [] };
  }

  const streams = hanimeStreams
    .map(stream => toStremioStream(stream))
    .filter(stream => stream?.url?.trim());

  return {
    streams: streams,
    cacheMaxAge: cacheConfig.maxAge,
    staleError: cacheConfig.staleError
  };
}

module.exports = {
  toStremioStream,
  toStremioStreams
};
