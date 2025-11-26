# Hanime.tv Stremio Addon

[![Netlify Status](https://api.netlify.com/api/v1/badges/aec4757e-b8a4-4062-b390-29defc8d309d/deploy-status)](https://app.netlify.com/projects/anime-src-hanime-stremio/deploys)
[![Fly.io](https://img.shields.io/badge/Fly.io-deployed-success?logo=fly.io)](https://hanime-stremio.fly.dev)

A Stremio addon for browsing and streaming content from Hanime.tv.

# ⚠️ Important Announcement – Streams Currently Unavailable

Hanime has **removed all stream URLs from their public API**.  
Because of this, the current addon version **cannot load any playable streams**, and all videos will fail with playback errors. This affects all users.

---

### ✅ Work in Progress

A new addon version is being developed that will include a **required configuration page**.  
You will need to enter your **Hanime email and password** so the addon can securely access the streams.  
Premium users will also automatically get **1080p quality**.

---

### ❗ Please do NOT open new issues

Playback errors are expected until the new version is released.  
An update will be posted when the new version is ready.

Thank you for your patience!

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

https://hanime-stremio.fly.dev/manifest.json
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
