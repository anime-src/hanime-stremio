const assert = require('assert');
const crypto = require('crypto');

const RELAY_SECRET = 'expected-secret';

function signedHlsRequest(target, expires = Math.floor(Date.now() / 1000) + 300) {
  const signature = crypto
    .createHmac('sha256', RELAY_SECRET)
    .update(`${expires}.${target}`)
    .digest('base64url');
  return `https://relay.example/hls?url=${encodeURIComponent(target)}&expires=${expires}&signature=${signature}`;
}

async function loadWorker() {
  return import('../workers/handshake-relay/src/index.mjs');
}

async function testRejectsUnauthorizedRequests() {
  const { createRelay } = await loadWorker();
  let upstreamCalls = 0;
  const relay = createRelay({
    fetchImpl: async () => {
      upstreamCalls++;
      return new Response('unexpected');
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/api/v11/handshake', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' }
    }),
    { RELAY_SECRET: 'expected-secret' }
  );

  assert.strictEqual(response.status, 401);
  assert.strictEqual(upstreamCalls, 0);
}

async function testRejectsNonHandshakeRoutes() {
  const { createRelay } = await loadWorker();
  let upstreamCalls = 0;
  const relay = createRelay({
    fetchImpl: async () => {
      upstreamCalls++;
      return new Response('unexpected');
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/anything', {
      headers: { authorization: 'Bearer expected-secret' }
    }),
    { RELAY_SECRET: 'expected-secret' }
  );

  assert.strictEqual(response.status, 404);
  assert.strictEqual(upstreamCalls, 0);
}

async function testForwardsHandshakeAndPreservesToken() {
  const { createRelay } = await loadWorker();
  let upstreamRequest;
  const relay = createRelay({
    fetchImpl: async (request) => {
      upstreamRequest = request;
      return new Response('{"status":"OK"}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-token': 'sealed-stream-sources'
        }
      });
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/api/v11/handshake', {
      method: 'POST',
      body: '{"token":"sealed-request"}',
      headers: {
        authorization: 'Bearer expected-secret',
        'content-type': 'application/json',
        'x-signature': 'signature',
        'x-signature-version': 'web2',
        'x-time': '123',
        'x-session-token': 'session',
        'x-untrusted-header': 'must-not-forward'
      }
    }),
    { RELAY_SECRET: 'expected-secret' }
  );

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.headers.get('x-token'), 'sealed-stream-sources');
  assert.strictEqual(upstreamRequest.url, 'https://auth.hanime.tv/api/v11/handshake');
  assert.strictEqual(upstreamRequest.method, 'POST');
  assert.strictEqual(upstreamRequest.headers.get('x-signature'), 'signature');
  assert.strictEqual(upstreamRequest.headers.get('x-session-token'), 'session');
  assert.strictEqual(upstreamRequest.headers.get('authorization'), null);
  assert.strictEqual(upstreamRequest.headers.get('x-untrusted-header'), null);
  assert.deepStrictEqual(await upstreamRequest.json(), { token: 'sealed-request' });
}

async function testForwardsSignedSearchDatasetRequest() {
  const { createRelay } = await loadWorker();
  let upstreamRequest;
  const relay = createRelay({
    fetchImpl: async (request) => {
      upstreamRequest = request;
      return new Response('[{"slug":"test-video"}]', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/api/v11/search_hvs', {
      headers: {
        authorization: 'Bearer expected-secret',
        'x-claim': '123',
        'x-signature': 'signature',
        'x-signature-version': 'app2',
        'x-session-token': '',
        'x-untrusted-header': 'must-not-forward'
      }
    }),
    { RELAY_SECRET: 'expected-secret' }
  );

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), [{ slug: 'test-video' }]);
  assert.strictEqual(
    upstreamRequest.url,
    'https://guest.freeanimehentai.net/api/v11/search_hvs'
  );
  assert.strictEqual(upstreamRequest.method, 'GET');
  assert.strictEqual(upstreamRequest.headers.get('x-claim'), '123');
  assert.strictEqual(upstreamRequest.headers.get('x-signature'), 'signature');
  assert.strictEqual(upstreamRequest.headers.get('authorization'), null);
  assert.strictEqual(upstreamRequest.headers.get('x-untrusted-header'), null);
}

async function testReturnsBadGatewayWhenUpstreamFails() {
  const { createRelay } = await loadWorker();
  const relay = createRelay({
    fetchImpl: async () => {
      throw new Error('upstream unavailable');
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/api/v11/handshake', {
      method: 'POST',
      body: '{}',
      headers: {
        authorization: 'Bearer expected-secret',
        'content-type': 'application/json'
      }
    }),
    { RELAY_SECRET: 'expected-secret' }
  );

  assert.strictEqual(response.status, 502);
  assert.deepStrictEqual(await response.json(), { error: 'Upstream unavailable' });
}

async function testRejectsUnsignedHlsProxyRequests() {
  const { createRelay } = await loadWorker();
  let upstreamCalls = 0;
  const relay = createRelay({
    fetchImpl: async () => {
      upstreamCalls++;
      return new Response('unexpected');
    }
  });

  const response = await relay.fetch(
    new Request('https://relay.example/hls?url=https%3A%2F%2Fhanime.tv%2Fhls%2Fmaster.m3u8'),
    { RELAY_SECRET }
  );

  assert.strictEqual(response.status, 401);
  assert.strictEqual(upstreamCalls, 0);
}

async function testProxiesAndRewritesSignedHlsPlaylists() {
  const { createRelay } = await loadWorker();
  const masterPlaylist = 'https://hanime.tv/hls/master.m3u8?token=abc';
  const upstreamRequests = [];
  const relay = createRelay({
    fetchImpl: async (request) => {
      upstreamRequests.push(request);
      return new Response(
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://ct.htv-services.com/keys/video.key"\n#EXTINF:4.0,\nchunks/segment-01.ts\n#EXTINF:4.0,\nhttps://p34.hydaelyn-25x-18.top/chunks/segment-02.ts\n#EXTINF:4.0,\nhttps://etheirys.htv-hydaelyn-05.com/chunks/segment-03.ts\n',
        { headers: { 'content-type': 'application/x-mpegURL' } }
      );
    }
  });

  const response = await relay.fetch(
    new Request(signedHlsRequest(masterPlaylist), { headers: { range: 'bytes=0-2047' } }),
    { RELAY_SECRET }
  );
  const playlist = await response.text();
  const proxiedTargets = [...playlist.matchAll(/https:\/\/relay\.example\/hls\?([^\s"\n]+)/g)]
    .map(match => new URL(`https://relay.example/hls?${match[1]}`).searchParams.get('url'));

  assert.strictEqual(response.status, 200);
  assert.strictEqual(upstreamRequests.length, 1);
  assert.strictEqual(upstreamRequests[0].headers.get('range'), 'bytes=0-2047');
  assert.deepStrictEqual(proxiedTargets.sort(), [
    'https://ct.htv-services.com/keys/video.key',
    'https://etheirys.htv-hydaelyn-05.com/chunks/segment-03.ts',
    'https://hanime.tv/hls/chunks/segment-01.ts',
    'https://p34.hydaelyn-25x-18.top/chunks/segment-02.ts'
  ]);
  assert.ok(!playlist.includes('\nchunks/segment-01.ts\n'));
  assert.ok(!playlist.includes('URI="https://ct.htv-services.com/keys/video.key"'));
  assert.ok(!playlist.includes('etheirys.htv-hydaelyn-05.com/chunks/segment-03.ts'));
}

async function run() {
  await testRejectsUnauthorizedRequests();
  await testRejectsNonHandshakeRoutes();
  await testForwardsHandshakeAndPreservesToken();
  await testForwardsSignedSearchDatasetRequest();
  await testReturnsBadGatewayWhenUpstreamFails();
  await testRejectsUnsignedHlsProxyRequests();
  await testProxiesAndRewritesSignedHlsPlaylists();
  console.log('worker relay tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
