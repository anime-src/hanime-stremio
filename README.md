# Hanime.tv Stremio Addon

A modern, performant Stremio addon for browsing and streaming content from Hanime.tv with advanced filtering, caching, and configurable logging.

## Features

- **Multiple Catalogs**: Browse by general, series, recent, most likes, most views, or newest releases
- **Genre Filtering**: Filter content by 64 genre tags
- **Search Functionality**: Find specific content by name
- **Smart Caching**: LRU cache with configurable TTL reduces API calls by 70-90%
- **Configurable Logging**: Debug, info, warn, or error levels for different environments
- **Image Proxy**: Handles CDN authentication transparently
- **Health Checks**: Built-in Docker healthcheck endpoints
- **Production Ready**: Multi-stage Docker builds, resource limits, and error handling

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker compose up -d
```

The addon will be accessible at `http://localhost:61327/manifest.json`

### Using Podman Compose

```bash
podman-compose up -d
```

### Using Node.js Directly

```bash
npm install
npm start
```

## Deployed Version

A hosted version of this addon is available at:
```
https://anime-src-hanime-stremio.vercel.app/manifest.json
```

You can install it directly in Stremio without running your own server.

## Installation in Stremio

1. Start the addon server (see Quick Start above)
2. Open Stremio
3. Go to Addons → Community Addons
4. Paste the manifest URL: `http://localhost:61327/manifest.json`
5. Click "Install"

For remote access, replace `localhost` with your server's IP address or domain.

## Configuration

### Environment Variables

#### Server Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `61327` | Server port |
| `PUBLIC_URL` | Auto-detected | Public URL for image proxying and addon assets |
| `NODE_ENV` | `development` | Environment (development/production) |

#### Cache Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_ENABLED` | `true` | Enable in-memory cache (set to `false` to disable) |
| `BROWSER_CACHE` | `true` | Enable browser caching (set to `false` to disable) |

#### Logging Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error/silent) |
| `LOGGING_ENABLED` | `true` | Enable logging (set to `false` to disable all logs) |

#### Addon Customization
| Variable | Default | Description |
|----------|---------|-------------|
| `ADDON_ID` | `hanime-addon` | Unique identifier for the addon |
| `ADDON_VERSION` | `package.json` | Override addon version |
| `ADDON_NAME` | `Hanime` | Display name of the addon |
| `ADDON_ICON` | `/images/favicon.ico` | Custom icon URL |
| `ADDON_LOGO` | `/images/logo.jpg` | Custom logo URL |
| `ADDON_BACKGROUND` | `/images/background.jpg` | Custom background URL |
| `ADDON_DESCRIPTION` | Default description | Custom addon description |

#### Stremio Addons Configuration (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `STREMIO_ADDONS_ISSUER` | None | Issuer for Stremio Addons authentication |
| `STREMIO_ADDONS_SIGNATURE` | None | Signature for Stremio Addons authentication |

### Development Scripts

```bash
# Start with default settings
npm start

# Start with debug logging and caching disabled
npm run dev

# Start production mode with minimal logging
npm run prod
```

### Docker Configuration

Edit `docker-compose.yml` to customize:

```yaml
environment:
  - PUBLIC_URL=http://your-server:61327
  - LOG_LEVEL=debug  # or info, warn, error
  - NODE_ENV=production
  - BROWSER_CACHE=false  # Disable browser caching for testing
  - ADDON_NAME=Custom Hanime Addon
  - ADDON_DESCRIPTION=My custom description
```

> **Note:** All environment variables defined in the [Environment Variables](#environment-variables) section can be added to the `docker-compose.yml` file under the `environment` key.

## Available Catalogs

- **Hanime**: General catalog with all content
- **Hanime Series**: Multi-episode series only
- **Hanime Recent**: Sorted by creation date
- **Hanime Most Likes**: Sorted by likes
- **Hanime Most Views**: Sorted by views  
- **Hanime Newest**: Sorted by release date

All catalogs support:
- Search by name
- Genre filtering (64 tags)
- Pagination

### Testing

```bash
# Test manifest endpoint
curl http://localhost:61327/manifest.json

# Test catalog
curl http://localhost:61327/catalog/anime/recent.json

# Test with filters
curl "http://localhost:61327/catalog/anime/recent/genre=vanilla.json"
```

### Debugging

Enable debug logging to see detailed request/response information:

```bash
LOG_LEVEL=debug npm start
```

Debug logs include:
- All HTTP requests with timing
- API call parameters and responses
- Cache hits/misses
- Stream details and validation
- Error stack traces

## Troubleshooting

### Thumbnails Not Loading

1. Ensure `PUBLIC_URL` is set correctly for your network
2. Check that the proxy route is accessible
3. Verify firewall rules allow traffic on port 61327

### No Streams Available

1. Check LOG_LEVEL=debug to see API responses
2. Verify network connectivity to hanime.tv APIs
3. Check for rate limiting or API changes

### High Memory Usage

1. Reduce cache size in `lib/config.js`
2. Lower cache TTL to expire entries faster
3. Check LOG_LEVEL isn't set to debug in production

## Credits

Originally forked from [mrcanelas/hanime-tv-addon](https://github.com/mrcanelas/hanime-tv-addon) with significant refactoring and improvements:
- Complete architectural redesign with classes and services
- Intelligent caching layer
- Configurable logging with production optimization
- Enhanced error handling
- Better code organization and maintainability

## License

MIT

## Disclaimer

This addon is for educational purposes only. Ensure you comply with local laws and Hanime.tv's terms of service when using this addon.
