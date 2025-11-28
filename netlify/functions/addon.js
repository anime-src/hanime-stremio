/**
 * serverless function for Hanime Stremio Addon
 */

const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const generateLandingHTML = require('../../lib/templates/landing_template');
const addonInterface = require('../../addon');
const apiClient = addonInterface.apiClient; // Get the shared apiClient instance
const createImageProxyMiddleware = require('../../lib/middleware/proxy_image_middleware');
const config = require('../../lib/config');
const logger = require('../../lib/logger');

const app = express();

app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.get('user-agent')?.substring(0, 50) || 'unknown'
  });
  next();
});

const landingHTML = generateLandingHTML(addonInterface.manifest);
const hasConfig = (addonInterface.manifest.config || []).length > 0;

// Handle landing page - redirect to /configure if config is required
app.get('/', (req, res) => {
  if (hasConfig && addonInterface.manifest.behaviorHints?.configurationRequired) {
    res.redirect('/configure');
  } else {
    res.setHeader('content-type', 'text/html');
    res.end(landingHTML);
  }
});

// Handle configuration page (required when config is defined)
if (hasConfig) {
  app.get('/configure', (req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(landingHTML);
  });
}

app.use(getRouter(addonInterface));

app.get('/proxy/image/:id/:type', (req, res, next) => {
  logger.debug('Proxy request received', {
    path: req.path,
    id: req.params.id,
    type: req.params.type
  });
  next();
}, createImageProxyMiddleware(config, apiClient));

app.use('/images', express.static(path.join(__dirname, '../../public/images')));
app.use('/css', express.static(path.join(__dirname, '../../public/css')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: addonInterface.manifest.version,
    cacheEnabled: config.cache.enabled,
    prefetchEnabled: config.cache.prefetch?.enabled || false
  });
});

// Binary support required for image responses in serverless
module.exports.handler = serverless(app, {
  binary: ['image/*', 'application/octet-stream']
});
