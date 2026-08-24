const RELAY_PATH = '/api/v11/handshake';
const SEARCH_PATH = '/api/v11/search_hvs';
const HLS_PATH = '/hls';
const UPSTREAM_URL = 'https://auth.hanime.tv/api/v11/handshake';
const SEARCH_UPSTREAM_URL = 'https://guest.freeanimehentai.net/api/v11/search_hvs';
const MAX_BODY_BYTES = 16 * 1024;
const HLS_PROXY_MAX_TTL_SECONDS = 12 * 60 * 60;
const FORWARDED_REQUEST_HEADERS = [
  'x-signature',
  'x-signature-version',
  'x-claim',
  'x-time',
  'x-session-token'
];

async function secretsEqual(actual, expected) {
  if (!actual || !expected) return false;

  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index++) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function base64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hlsSigningKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function hlsSignature(key, expires, target) {
  const value = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${expires}.${target}`)
  );
  return base64Url(value);
}

function allowedHlsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'hanime.tv') {
      return url.pathname.startsWith('/hls/') ? url : null;
    }
    // These are the only origins emitted by Hanime's HLS playlists: the AES
    // key service and the numbered media hosts. Keeping this list narrow
    // prevents the public playback URL from becoming an open proxy.
    if (
      url.hostname === 'ct.htv-services.com' ||
      /^p\d+\.hydaelyn-25x-\d{2}\.top$/.test(url.hostname) ||
      /^etheirys\.htv-hydaelyn-\d{2}\.com$/.test(url.hostname)
    ) {
      return url;
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function hlsProxyUrl(requestUrl, target, expires, key) {
  const signature = await hlsSignature(key, expires, target.toString());
  const proxyUrl = new URL(HLS_PATH, requestUrl);
  proxyUrl.searchParams.set('url', target.toString());
  proxyUrl.searchParams.set('expires', String(expires));
  proxyUrl.searchParams.set('signature', signature);
  return proxyUrl.toString();
}

async function rewriteHlsPlaylist(playlist, sourceUrl, requestUrl, expires, key) {
  const proxyReference = async (reference) => {
    const target = allowedHlsUrl(new URL(reference, sourceUrl).toString());
    return target ? hlsProxyUrl(requestUrl, target, expires, key) : reference;
  };

  const rewrittenLines = [];
  for (const line of playlist.split('\n')) {
    if (!line.trim()) {
      rewrittenLines.push(line);
    } else if (line.startsWith('#')) {
      const matches = [...line.matchAll(/URI="([^"]+)"/g)];
      let offset = 0;
      let rewritten = '';
      for (const match of matches) {
        rewritten += line.slice(offset, match.index);
        rewritten += `URI="${await proxyReference(match[1])}"`;
        offset = match.index + match[0].length;
      }
      rewrittenLines.push(rewritten + line.slice(offset));
    } else {
      rewrittenLines.push(await proxyReference(line.trim()));
    }
  }
  return rewrittenLines.join('\n');
}

async function handleHlsProxy(request, env, url, fetchImpl) {
  const target = allowedHlsUrl(url.searchParams.get('url'));
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');
  const now = Math.floor(Date.now() / 1000);
  if (!target || !Number.isInteger(expires) || !signature) {
    return jsonResponse(401, 'Unauthorized');
  }
  if (expires < now || expires > now + HLS_PROXY_MAX_TTL_SECONDS) {
    return jsonResponse(403, 'Expired HLS proxy URL');
  }
  const key = await hlsSigningKey(env.RELAY_SECRET || '');
  const expectedSignature = await hlsSignature(key, expires, target.toString());
  if (!(await secretsEqual(signature, expectedSignature))) {
    return jsonResponse(401, 'Unauthorized');
  }

  let upstream;
  try {
    const headers = new Headers({
      accept: '*/*',
      origin: 'https://hanime.tv',
      referer: 'https://hanime.tv/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
    });
    const range = request.headers.get('range');
    if (range) headers.set('range', range);
    upstream = await fetchImpl(new Request(target, { headers }));
  } catch (_) {
    return jsonResponse(502, 'Upstream unavailable');
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const responseHeaders = new Headers({
    'cache-control': 'no-store',
    'content-type': contentType
  });
  for (const header of ['accept-ranges', 'content-length', 'content-range']) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  if (!contentType.toLowerCase().includes('mpegurl')) {
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }

  const playlist = await upstream.text();
  responseHeaders.delete('content-length');
  return new Response(
    await rewriteHlsPlaylist(playlist, upstream.url || target.toString(), url, expires, key),
    { status: upstream.status, headers: responseHeaders }
  );
}

function jsonResponse(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function createRelay({ fetchImpl = fetch } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const isHandshake = url.pathname === RELAY_PATH;
      const isSearch = url.pathname === SEARCH_PATH;
      const isHls = url.pathname === HLS_PATH;
      if (!isHandshake && !isSearch && !isHls) {
        return jsonResponse(404, 'Not found');
      }
      if (isHls) {
        if (request.method !== 'GET') return jsonResponse(405, 'Method not allowed');
        return handleHlsProxy(request, env, url, fetchImpl);
      }
      const expectedMethod = isHandshake ? 'POST' : 'GET';
      if (request.method !== expectedMethod) {
        return jsonResponse(405, 'Method not allowed');
      }

      const authorized = await secretsEqual(
        request.headers.get('authorization'),
        env.RELAY_SECRET && `Bearer ${env.RELAY_SECRET}`
      );
      if (!authorized) {
        return jsonResponse(401, 'Unauthorized');
      }
      let body;
      if (isHandshake) {
        if (!request.headers.get('content-type')?.startsWith('application/json')) {
          return jsonResponse(415, 'JSON body required');
        }
        body = await request.arrayBuffer();
        if (body.byteLength > MAX_BODY_BYTES) {
          return jsonResponse(413, 'Request body too large');
        }
      }

      const headers = new Headers({
        accept: 'application/json',
        'content-type': 'application/json',
        origin: 'https://hanime.tv',
        referer: 'https://hanime.tv/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
      });
      for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }

      let upstream;
      try {
        upstream = await fetchImpl(new Request(
          isHandshake ? UPSTREAM_URL : SEARCH_UPSTREAM_URL,
          {
            method: expectedMethod,
            headers,
            body
          }
        ));
      } catch (_) {
        return jsonResponse(502, 'Upstream unavailable');
      }
      const responseHeaders = new Headers({
        'cache-control': 'no-store',
        'content-type': upstream.headers.get('content-type') || 'application/json'
      });
      const token = upstream.headers.get('x-token');
      if (token) responseHeaders.set('x-token', token);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
    }
  };
}

export default createRelay();
