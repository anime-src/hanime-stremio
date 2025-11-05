#!/usr/bin/env node

/**
 * Hanime Stremio Addon Server
 * Express server with request logging and image proxy
 */

const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const config = require('./lib/config');
const logger = require('./lib/logger');
const addonInterface = require('./addon');
const createImageProxyMiddleware = require('./lib/middleware/proxy_image_middleware');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log incoming request
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')?.substring(0, 50) || 'unknown'
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    logger[level](`${req.method} ${req.path} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      status: res.statusCode
    });
  });

  next();
}

/**
 * Start HTTP server
 */
function serveHTTP(addonInterface, opts = {}) {
  const app = express();

  // Apply request logging
  app.use(requestLogger);

  // Stremio addon routes
  app.use(getRouter(addonInterface));

  // Landing page
  const landingHTML = landingTemplate(addonInterface.manifest);
  app.get('/', (req, res) => {
    logger.debug('Serving landing page');
    res.setHeader('content-type', 'text/html');
    res.end(landingHTML);
  });

  // Image proxy route
  app.get('/proxy/images/:type/:image', createImageProxyMiddleware(config));

  // Start server
  const server = app.listen(opts.port);

  return new Promise((resolve, reject) => {
    server.on('listening', () => {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      
      // Set PUBLIC_URL if not already set
      if (!process.env.PUBLIC_URL) {
        process.env.PUBLIC_URL = baseUrl;
        config.server.publicUrl = baseUrl;
      }

      const url = `${baseUrl}/manifest.json`;
      
      // Log server startup
      logger.info('='.repeat(60));
      logger.info('Hanime Stremio Addon Server Started');
      logger.info('='.repeat(60));
      logger.info(`HTTP addon accessible at: ${url}`);
      logger.info(`Public URL: ${config.server.publicUrl || baseUrl}`);
      logger.info(`Port: ${server.address().port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`Log Level: ${config.logging.level}`);
      logger.info('='.repeat(60));
      logger.info('Waiting for requests...');
      
      resolve({ url, server });
    });

    server.on('error', (err) => {
      logger.error('Server error', { error: err.message, stack: err.stack });
      reject(err);
    });
  });
}

// Start server
serveHTTP(addonInterface, { port: config.server.port })
  .catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
