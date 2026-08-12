const assert = require('assert');
const axios = require('axios');
const signatureService = require('../lib/services/htv_signature_service');
const HtvStreamResolver = require('../lib/services/htv_stream_resolver');
const { sealMessage } = require('../lib/services/htv_stream_resolver');
const { toStremioStream } = require('../lib/transformers/stream_transformer');
const config = require('../lib/config');

const originalGet = axios.get;
const originalPost = axios.post;
const originalGetSignature = signatureService.getSignature;

async function testDoesNotProbeBlockedMetadataSources() {
  const getRequests = [];

  signatureService.getSignature = async () => ({ signature: 'test', time: 123 });
  axios.post = async () => ({
    status: 200,
    headers: {
      'x-token': sealMessage({ sources: [{ height: 720, url: '/hls/blocked-720' }] })
    }
  });
  axios.get = async (url) => {
    getRequests.push(url);
    return { status: 403, headers: {}, data: '<html>blocked</html>' };
  };

  const resolver = new HtvStreamResolver(config);
  const streams = await resolver.resolveStreams('test-video');

  assert.deepStrictEqual(getRequests, []);
  assert.strictEqual(streams[0].durationMs, 20 * 60 * 1000);
  assert.strictEqual(streams[0].filesizeMbs, 202.5);
  assert.strictEqual(streams[0].durationEstimated, true);
  assert.strictEqual(streams[0].filesizeEstimated, true);
}

async function testAlwaysUsesAuthenticatedWorkerRelay() {
  let handshakeRequest;

  signatureService.getSignature = async () => ({ signature: 'test', time: 123 });
  axios.post = async (url, body, options) => {
    handshakeRequest = { url, body, options };
    return {
      status: 200,
      headers: {
        'x-token': sealMessage({ sources: [{ height: 720, url: '/hls/relay-720' }] })
      }
    };
  };
  const resolver = new HtvStreamResolver({
    api: {
      defaultDurationMs: 20 * 60 * 1000,
      htv: {
        handshakeUrl: 'https://hanime-handshake.skynetsource.com/api/v11/handshake',
        relaySecret: 'relay-secret',
        hlsHost: 'https://hanime.tv'
      }
    }
  });
  const streams = await resolver.resolveStreams('test-video');

  assert.strictEqual(streams.length, 1);
  assert.strictEqual(
    handshakeRequest.url,
    'https://hanime-handshake.skynetsource.com/api/v11/handshake'
  );
  assert.strictEqual(
    handshakeRequest.options.headers.authorization,
    'Bearer relay-secret'
  );
  const proxiedUrl = new URL(streams[0].url);
  assert.strictEqual(proxiedUrl.origin, 'https://hanime-handshake.skynetsource.com');
  assert.strictEqual(proxiedUrl.pathname, '/hls');
  assert.strictEqual(proxiedUrl.searchParams.get('url'), 'https://hanime.tv/hls/relay-720');
  assert.ok(Number(proxiedUrl.searchParams.get('expires')) > Math.floor(Date.now() / 1000));
  assert.ok(proxiedUrl.searchParams.get('signature'));
}

function testDefaultHandshakeAuthorityIsWorkerRelay() {
  assert.strictEqual(
    config.api.htv.handshakeUrl,
    'https://hanime-handshake.skynetsource.com/api/v11/handshake'
  );
}

function testStreamCacheWindowIsSixHours() {
  assert.strictEqual(config.cache.ttl.stream, 6 * 60 * 60);
}

function testMissingMetadataDoesNotRenderZeroes() {
  const stream = toStremioStream({
    url: 'https://hanime.tv/hls/test',
    height: 720,
    video_stream_group_id: 'Hanime.TV'
  });

  assert.ok(!stream.title.includes('💾 0 MB'));
  assert.ok(!stream.title.includes('⌚ 0 min'));
  assert.ok(stream.title.includes('💾 203 MB'));
  assert.ok(stream.title.includes('⌚ 20 min'));
  assert.ok(!stream.title.includes('~'));
  assert.strictEqual(
    stream.behaviorHints.videoSize,
    Math.round(202.5 * 1024 * 1024)
  );
}

async function run() {
  try {
    await testDoesNotProbeBlockedMetadataSources();
    await testAlwaysUsesAuthenticatedWorkerRelay();
    testDefaultHandshakeAuthorityIsWorkerRelay();
    testStreamCacheWindowIsSixHours();
    testMissingMetadataDoesNotRenderZeroes();
    console.log('htv_stream_resolver tests passed');
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    signatureService.getSignature = originalGetSignature;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
