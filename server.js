#!/usr/bin/env node

/**
 * Hanime Stremio Addon Server
 * Express server with request logging and image proxy
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
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
  
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')?.substring(0, 50) || 'unknown'
  });

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

  app.use(requestLogger);
  app.use(getRouter(addonInterface));

  const landingHTML = landingTemplate(addonInterface.manifest);
  app.get('/', (req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(landingHTML);
  });

  // Try public/images first for Vercel, then images for local
  const publicImagesPath = path.join(__dirname, 'public', 'images');
  const imagesPath = path.join(__dirname, 'images');
  const imagePath = fs.existsSync(publicImagesPath) ? publicImagesPath : imagesPath;
  app.use('/images', express.static(imagePath));

  app.get('/proxy/image/:id/:type', createImageProxyMiddleware(config));

  const server = app.listen(opts.port);

  return new Promise((resolve, reject) => {
    server.on('listening', () => {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      
      // Set publicUrl at runtime if not already set
      if (!config.server.publicUrl) {
        config.server.publicUrl = baseUrl;
      }

      const url = `${baseUrl}/manifest.json`;
      
      logger.info('='.repeat(60));
      logger.info('Hanime Stremio Addon Server Started');
      logger.info('='.repeat(60));
      logger.info(`HTTP addon accessible at: ${url}`);
      logger.info(`Public URL: ${config.server.publicUrl}`);
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
