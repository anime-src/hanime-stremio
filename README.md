# Hanime.tv Stremio Addon

A Stremio addon for browsing and streaming content from Hanime.tv.

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

A hosted version is available at:
```
https://anime-src-hanime-stremio.netlify.app/manifest.json
```

> **Note:** Issues with the deployed version may be caused by free hosting limitations or Hanime CDN blocking. For best performance, self-host using Docker.

## Installation in Stremio

1. Open Stremio
2. Go to Addons → Community Addons
3. Paste the manifest URL (local: `http://localhost:61327/manifest.json`)
4. Click "Install"

## Configuration

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `61327` | Server port |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |
| `CACHE_ENABLED` | `true` | Enable caching |
| `CACHE_MAX_SIZE` | `1000` | Maximum cache entries |

See `docker-compose.yml` for all available options.

## Available Catalogs

- General catalog, Series, Recent, Most Likes, Most Views, Newest
- Search by name and filter by genre

## Troubleshooting

- **Thumbnails not loading**: Ensure `PUBLIC_URL` is set correctly
- **No streams**: Check network connectivity and enable `LOG_LEVEL=debug`
- **High memory**: Reduce `CACHE_MAX_SIZE`
- **Slow catalogs**: Increase `CACHE_MAX_SIZE` or adjust cache TTLs

## Credits

Forked from [mrcanelas/hanime-tv-addon](https://github.com/mrcanelas/hanime-tv-addon).

## License

MIT

## Disclaimer

This addon is for educational purposes only. Ensure you comply with local laws and Hanime.tv's terms of service when using this addon.
