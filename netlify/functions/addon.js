/**
 * serverless function for Hanime Stremio Addon
 */

const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const landingTemplate = require('stremio-addon-sdk/src/landingTemplate');
const addonInterface = require('../../addon');
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

app.use(getRouter(addonInterface));

const landingHTML = landingTemplate(addonInterface.manifest);
app.get('/', (req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(landingHTML);
});

app.get('/proxy/image/:id/:type', (req, res, next) => {
  logger.debug('Proxy request received', { 
    path: req.path,
    id: req.params.id,
    type: req.params.type 
  });
  next();
}, createImageProxyMiddleware(config));

app.use('/images', express.static(path.join(__dirname, '../../public/images')));

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

