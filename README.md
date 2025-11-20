# Hanime.tv Stremio Addon

A modern, performant Stremio addon for browsing and streaming content from Hanime.tv with advanced filtering, caching, and configurable logging.

## Features

- **Multiple Catalogs**: Browse by general, series, recent, most likes, most views, or newest releases
- **Genre Filtering**: Filter content by 80+ genre tags
- **Search Functionality**: Find specific content by name
- **Catalog Prefetch**: Optional background service to prefetch all catalog data for instant responses
- **In-Memory Filtering**: Fast search and genre filtering using prefetched data
- **Smart Caching**: LRU cache (lru-cache) with configurable TTLs reduces API calls by 70-90%
- **Parallel Fetching**: Configurable concurrency for faster catalog prefetching
- **Image Proxy**: CDN authentication with deduplication, retry logic, and rate limiting
- **Configurable Logging**: Debug, info, warn, or error levels for different environments
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
https://anime-src-hanime-stremio.netlify.app/manifest.json

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
| `CACHE_MAX_SIZE` | `1000` | Maximum number of cache entries (LRU eviction) |
| `CATALOG_CACHE_ENABLED` | `true` | Enable catalog response caching (set to `false` to disable) |
| `CACHE_CATALOG_TTL` | `7200000` | Catalog cache TTL in milliseconds (default: 2 hours) |
| `CACHE_META_TTL` | `129600000` | Meta cache TTL in milliseconds (default: 1.5 days) |
| `CACHE_STREAM_TTL` | `129600000` | Stream cache TTL in milliseconds (default: 1.5 days) |
| `BROWSER_CACHE` | `true` | Enable browser caching (set to `false` to disable) |

#### Catalog Prefetch Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `CATALOG_PREFETCH` | `false` | Enable catalog prefetching (set to `true` to enable) |
| `CATALOG_PREFETCH_INTERVAL` | `7200000` | Refresh interval in milliseconds (default: 2 hours) |
| `CATALOG_PREFETCH_CONCURRENCY` | `5` | Number of parallel page requests (1-20 recommended) |
| `CATALOG_PREFETCH_PAGE_DELAY` | `50` | Delay between page batches in milliseconds |

#### Image Proxy Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `IMAGE_PROXY_QUEUE` | `true` | Enable image proxy request queue (set to `false` to disable) |
| `IMAGE_PROXY_QUEUE_DELAY` | `100` | Delay between queued requests in milliseconds |

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
  - CATALOG_PREFETCH=true  # Enable catalog prefetching
  - CATALOG_PREFETCH_CONCURRENCY=10  # Faster prefetching
  - CACHE_MAX_SIZE=2000  # Larger cache
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
- Cache hits/misses and statistics
- Prefetch progress and catalog sizes
- Image proxy operations (cache, deduplication, queue)
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

1. Reduce cache size: `CACHE_MAX_SIZE=500`
2. Disable catalog prefetch: `CATALOG_PREFETCH=false`
3. Lower cache TTLs (in milliseconds)
4. Check LOG_LEVEL isn't set to debug in production

### Slow Catalog Loading

1. Enable catalog prefetch: `CATALOG_PREFETCH=true`
2. Increase concurrency: `CATALOG_PREFETCH_CONCURRENCY=10`
3. Reduce page delay: `CATALOG_PREFETCH_PAGE_DELAY=25`
4. Increase cache size: `CACHE_MAX_SIZE=2000`

## Credits

Originally forked from [mrcanelas/hanime-tv-addon](https://github.com/mrcanelas/hanime-tv-addon) with significant refactoring and improvements:
- Complete architectural redesign with classes and services
- Catalog prefetch service with parallel fetching and in-memory filtering
- LRU cache with configurable TTLs (using lru-cache library)
- Refactored image proxy with deduplication, retry logic, and rate limiting
- Configurable logging with production optimization
- Enhanced error handling and service separation
- Better code organization and maintainability

## License

MIT

## Disclaimer

This addon is for educational purposes only. Ensure you comply with local laws and Hanime.tv's terms of service when using this addon.
