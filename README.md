# Hanime.tv Stremio Addon

[![Fly.io](https://img.shields.io/badge/Fly.io-hosting-unavailable?logo=fly.io&color=lightgrey)](#)

A self-hostable Stremio addon for browsing and streaming content from Hanime.tv, with guest playback, optional account-based premium qualities, catalog search, genre filtering, brand/studio filtering, and an Uncensored catalog.

# Playback and Optional Account Configuration

Hanime removed stream URLs from its public metadata API. The addon now resolves
playback through Hanime's signed web handshake. Guest playback works without an
account and normally exposes up to 720p. Supplying Hanime credentials is
optional and may unlock premium qualities such as 1080p.

---

### Account configuration

The configure page can verify Hanime credentials before generating an install
URL. If credentials are omitted or login fails, playback falls back to the
guest handshake instead of returning no streams.

**Benefits:**
- Guest playback without credentials
- Premium users can receive 1080p when Hanime exposes it for their session
- Credential verification before generating a configured install URL
- Per-user sessions without server-side plaintext password storage

**How to Configure:**
1. Install the addon in Stremio
2. Optionally click "Configure" and enter your Hanime email and password
3. Verify and save the configuration

---

### Security Note

Credentials are carried in the configured Stremio addon URL and sent to the
addon only when authentication is requested. The addon uses them to create a
Hanime session and does not log the password in plaintext. Protect configured
install URLs as secrets.

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker compose up -d
```

The addon will be accessible at `http://localhost:61327/manifest.json`

### Using Podman Compose

```bash
podman compose up -d
```

### Using Node.js Directly

```bash
npm install
npm start
```

## Deployed / Hosted Version Status

🚫 **Public hosted version is currently unavailable**

The addon is **no longer hosted publicly**.

Running this addon on Fly.io (or similar platforms) requires **paid plans with high and unpredictable costs** due to:

- Continuous traffic from Stremio clients
- Bandwidth-heavy streaming metadata requests
- Always-on server requirements

Because of this, maintaining a **free or public hosted instance is not financially sustainable**.

Stremio Addons page:
```
https://stremio-addons.net/addons/hanime
```
> **Note:** Issues with the deployed version may be caused by free hosting limitations or Hanime CDN blocking. For best performance, self-host using Docker.

## Installation in Stremio

1. Open Stremio
2. Go to Addons → Community Addons
3. Paste the manifest URL (local: `http://localhost:61327/manifest.json`)
4. Click "Install"

## What's Changed From the Original

This fork includes several changes beyond the original Hanime Stremio addon:

- Signed guest stream access after Hanime removed stream URLs from the public API
- Optional Hanime account configuration for premium stream qualities
- Signed Cloudflare Worker HLS proxy for networks blocked by Hanime's Cloudflare rules
- `/verify` endpoint used by the configure page to test credentials before install
- Multi-user session handling so different Stremio users can use different Hanime credentials
- Premium account support for 1080p streams when Hanime marks the account as premium
- Uncensored catalog that automatically applies the `uncensored` tag
- Genre and brand/studio filtering in catalog browsing
- Curated Uncensored genre and brand lists that only show filters with matching uncensored results
- Cleaner Stremio search behavior: global search is limited to the main Hanime catalog and Series catalog to avoid duplicate rows from sort-only catalogs
- Redesigned configure/landing page with the current install URL handling
- Runtime logo support through `/images/logo.png`
- Additional discovery scripts for refreshing uncensored brand and genre datasets
- Updated cache, rate limit, slow-down, and proxy-aware server behavior for self-hosting

## Configuration

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `61327` | Server port |
| `PUBLIC_URL` | - | Public base URL used for manifest assets and install links |
| `LOG_LEVEL` | `debug` | Logging level (debug/info/warn/error/silent) |
| `CACHE_ENABLED` | `true` | Enable caching |
| `CACHE_MAX_SIZE` | `5000` | Maximum cache entries |
| `CACHE_BROWSER_CACHE` | `true` | Enable browser caching |
| `CACHE_REDIS_URL` | - | Redis connection URL for persistent cache |
| `REDIS_URL` | - | Backward-compatible Redis connection URL |
| `RATE_LIMIT_ENABLED` | `true` | Enable request rate limiting |
| `SLOW_DOWN_ENABLED` | `true` | Enable gradual request slow-down before rate limits |
| `TRUST_PROXY` | `true` | Trust reverse proxy headers for client IP detection |
| `ADDON_NAME` | `Hanime` | Stremio addon display name |
| `ADDON_ID` | `hanime-addon` | Stremio addon ID |
| `ADDON_VERSION` | package version | Override manifest version |
| `HTV_HANDSHAKE_URL` | hosted relay URL | Cloudflare Worker handshake relay endpoint |
| `HTV_RELAY_SECRET` | - | Bearer secret shared with the handshake relay Worker |
| `HTV_HLS_PROXY_URL` | hosted relay `/hls` URL | Signed HLS playlist, key, and media proxy endpoint |

See `docker-compose.yml` for all available options.

### Worker relay for hosted deployments

Hanime can return a Cloudflare 403 before processing signed API requests from
datacenter, VPS, cloud, and other non-residential IPs. Deployments on those
networks require the locked Worker in `workers/handshake-relay`; do not rely on
direct upstream fallback. The current addon routes both catalog data and stream
handshakes through the Worker at all times so production behavior is
consistent.

The Worker exposes only these constrained routes:

- `GET /api/v11/search_hvs` for the signed catalog search dataset
- `POST /api/v11/handshake` for playable stream handshakes
- `GET /hls` for time-limited, HMAC-signed HLS playlist, key, and media requests

The HLS route accepts only signed HTTPS targets on Hanime's known playlist,
key, and numbered media hosts. It rewrites every child reference in a playlist
back through the same route, so neither Oracle nor the viewer needs direct
access to Hanime's Cloudflare-protected media hosts. It is not an open proxy.

The hosted Worker uses `hanime-handshake.skynetsource.com`. On a new hosted
addon machine, set `HTV_RELAY_SECRET` to the same value as the Worker's
`RELAY_SECRET`; never commit that value. If deploying a separate Worker domain,
update all relay targets: set `HTV_HANDSHAKE_URL` for the handshake route,
`HTV_HLS_PROXY_URL` for playback, and change `config.api.searchUrl` in
`lib/config.js` for the search route. Changing only one route leaves part of
the addon pointed at the old Worker.

Deploy the included Worker after adjusting its account and custom domain:

```bash
npx wrangler secret put RELAY_SECRET \
  --config workers/handshake-relay/wrangler.jsonc
npx wrangler deploy --config workers/handshake-relay/wrangler.jsonc
```

Set the identical value as `HTV_RELAY_SECRET` in the addon environment. The
secret authenticates the API relay routes and signs short-lived HLS proxy URLs.
Because media bytes traverse the Worker, monitor Cloudflare bandwidth and
request limits on hosted deployments.

After deploying, verify multiple catalog categories and a poster, film/series
metadata, all stream qualities, parseable file size/duration tags, a rewritten
HLS playlist, and a ranged media response through the Worker before treating
the deployment as healthy.

Upstream caches are demand-driven; the addon does not poll Hanime on a timer.
Stream handshakes and the shared search dataset are reused for six hours after
the first request, while metadata is reused for 36 hours.

## Available Catalogs

- **Hanime**: main searchable catalog with genre and brand/studio filters
- **Hanime Series**: searchable series aggregation catalog
- **Hanime Uncensored**: uncensored-only browsing with pruned genre and brand/studio filters
- **Hanime Recent**, **Most Likes**, **Most Views**, and **Newest**: sort-focused browsing catalogs

Search is intentionally exposed only on the main Hanime and Series catalogs. The sort-only and Uncensored catalogs omit search to prevent Stremio from showing duplicate rows for the same query.

## Maintenance Scripts

Refresh generated Uncensored filter datasets when Hanime's catalog changes:

```bash
npm run discover-brands
npm run discover-uncensored-genres
```

These scripts probe Hanime's search API with paced requests and update:

- `lib/data/uncensored-brands.json`
- `lib/data/uncensored-genres.json`

## Troubleshooting

- **Thumbnails not loading**: Ensure `PUBLIC_URL` is set correctly
- **No streams**: Check `HTV_RELAY_SECRET`, Worker deployment health, and enable `LOG_LEVEL=debug`
- **Playlist loads but playback fails**: Confirm playlist child URLs point to the Worker `/hls` route and that a ranged media request returns HTTP 206
- **Credential verification fails**: Confirm the Hanime account works on hanime.tv and retry from `/configure`
- **Duplicate search rows**: Reinstall the addon so Stremio picks up the latest manifest extras
- **High memory**: Reduce `CACHE_MAX_SIZE`
- **Slow catalogs**: Increase `CACHE_MAX_SIZE` or adjust cache TTLs

## Credits

Forked from [mrcanelas/hanime-tv-addon](https://github.com/mrcanelas/hanime-tv-addon).

## License

MIT

## Disclaimer

This addon is for educational purposes only. Ensure you comply with local laws and Hanime.tv's terms of service when using this addon.
