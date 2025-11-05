/**
 * Configurable logger with log levels for production optimization
 * Log levels: debug (0), info (1), warn (2), error (3), silent (999)
 */

const config = require('./config');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 999 // Disable all logging
};

/**
 * Get current log level dynamically
 */
function getCurrentLevel() {
  // If logging is disabled, return silent level
  if (!config.logging.enabled) {
    return LOG_LEVELS.silent;
  }
  
  const level = config.logging.level;
  const result = LOG_LEVELS[level];
  if (result === undefined) {
    console.log('WARNING: Unknown log level:', level, 'Available:', Object.keys(LOG_LEVELS));
    return LOG_LEVELS.info;
  }
  return result;
}

/**
 * Format timestamp and log level prefix
 */
function formatPrefix(level) {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
}

const logger = {
  debug: (message, ...args) => {
    if (getCurrentLevel() <= LOG_LEVELS.debug) {
      console.log(formatPrefix('debug'), message, ...args);
    }
  },
  
  info: (message, ...args) => {
    if (getCurrentLevel() <= LOG_LEVELS.info) {
      console.log(formatPrefix('info'), message, ...args);
    }
  },
  
  warn: (message, ...args) => {
    if (getCurrentLevel() <= LOG_LEVELS.warn) {
      console.warn(formatPrefix('warn'), message, ...args);
    }
  },
  
  error: (message, ...args) => {
    if (getCurrentLevel() <= LOG_LEVELS.error) {
      console.error(formatPrefix('error'), message, ...args);
    }
  },
  
  // Get current log level
  getLevel: () => config.logging.level,
  
  // Check if a log level is enabled
  isEnabled: (level) => getCurrentLevel() <= (LOG_LEVELS[level] || LOG_LEVELS.info)
};

module.exports = logger;

