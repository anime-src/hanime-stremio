const crypto = require('crypto');
const axios = require('axios');
const logger = require('../logger');
const signatureService = require('./htv_signature_service');

const ESTIMATED_BITRATES_MBPS = new Map([
  [360, 0.48],
  [480, 0.62],
  [720, 1.35],
  [1080, 2.7]
]);

// hanime's "insecure" message envelope: AES-256-GCM, key = SHA-256 of a fixed
// label, AAD = a second fixed label. Used to seal the handshake request token
// and to open the `x-token` response header. (Names taken verbatim from
// hanime's app_init bundle: encryptInsecureMessage / decryptInsecureMessage.)
const MSG_KEY = crypto.createHash('sha256').update('htv-insecure-handshake-v1').digest();
const MSG_AAD = Buffer.from('htv-insecure-v1');

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (str) => Buffer.from(
  String(str).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '='),
  'base64'
);

/**
 * Seal an object into a hanime "insecure" message token.
 * @param {Object} obj
 * @returns {string} base64url token
 */
function sealMessage(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MSG_KEY, iv, { authTagLength: 16 });
  cipher.setAAD(MSG_AAD);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const envelope = {
    v: 1,
    alg: 'AES-256-GCM',
    iv: b64url(iv),
    tag: b64url(cipher.getAuthTag()),
    data: b64url(data)
  };
  return b64url(Buffer.from(JSON.stringify(envelope)));
}

/**
 * Open a hanime "insecure" message token.
 * @param {string} token base64url token
 * @returns {Object} parsed payload
 */
function openMessage(token) {
  const envelope = JSON.parse(b64urlDecode(token).toString('utf8'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', MSG_KEY, b64urlDecode(envelope.iv), { authTagLength: 16 });
  decipher.setAAD(MSG_AAD);
  decipher.setAuthTag(b64urlDecode(envelope.tag));
  const plain = Buffer.concat([decipher.update(b64urlDecode(envelope.data)), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

class HtvStreamResolver {
  /**
   * @param {Object} config - App config (uses config.api.htv)
   */
  constructor(config) {
    const htv = (config && config.api && config.api.htv) || {};
    this.handshakeUrl = htv.handshakeUrl ||
      'https://hanime-handshake.skynetsource.com/api/v11/handshake';
    this.relaySecret = htv.relaySecret || null;
    this.hlsHost = htv.hlsHost || 'https://hanime.tv';
    this.hlsProxyUrl = htv.hlsProxyUrl || new URL('/hls', this.handshakeUrl).toString();
    this.hlsProxyTtlSeconds = htv.hlsProxyTtlSeconds || 8 * 60 * 60;
    this.timeoutMs = htv.timeoutMs || 15000;
    this.defaultDurationMs = htv.defaultDurationMs ||
      (config && config.api && config.api.defaultDurationMs) ||
      20 * 60 * 1000;
    this.userAgent = htv.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
  }

  /**
   * Resolve playable HLS streams for a video slug via the /api/v11/handshake
   * flow. Returns absolute hanime.tv/hls URLs that Stremio can play directly
   * (their segments and AES key are openly fetchable). Empty array on failure.
   *
   * @param {string} slug - Video slug (e.g. "bible-black-6")
   * @param {string} [sessionToken] - Optional session token to unlock premium
   *   (e.g. 1080p) qualities; omit for guest playback.
   * @returns {Promise<Array<{height: (string|number), url: string}>>}
   */
  async resolveStreams(slug, sessionToken) {
    if (!slug) return [];

    const sig = await signatureService.getSignature();
    if (!sig) {
      logger.warn('HTV stream resolve: no signature available', { slug });
      return [];
    }

    const token = sealMessage({
      timestamp_unix: Math.floor(Date.now() / 1000),
      directive: 'htv_player_handshake',
      slug
    });

    const headers = {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': this.userAgent,
      referer: 'https://hanime.tv/',
      origin: 'https://hanime.tv',
      'x-signature-version': 'web2',
      'x-signature': sig.signature,
      'x-time': String(sig.time)
    };
    if (this.relaySecret) headers.authorization = `Bearer ${this.relaySecret}`;
    if (sessionToken) headers['x-session-token'] = sessionToken;

    let response;
    try {
      response = await axios.post(this.handshakeUrl, { token }, {
        headers,
        timeout: this.timeoutMs,
        validateStatus: () => true
      });
    } catch (error) {
      logger.warn('HTV handshake request failed', { slug, error: error.message });
      return [];
    }

    const xToken = response.headers['x-token'];
    if (response.status !== 200 || !xToken) {
      logger.warn('HTV handshake non-200 or missing x-token', {
        slug,
        status: response.status,
        errorId: response.data && response.data.error_id
      });
      return [];
    }

    let payload;
    try {
      payload = openMessage(xToken);
    } catch (error) {
      logger.warn('HTV handshake x-token decode failed', { slug, error: error.message });
      return [];
    }

    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const normalizedSources = sources
      .map((s) => {
        const rawUrl = s.url || s.src || '';
        if (!rawUrl) return null;
        const sourceUrl = rawUrl.startsWith('http') ? rawUrl : `${this.hlsHost}${rawUrl}`;
        return {
          height: s.height || s.label || '',
          url: this._proxyHlsUrl(sourceUrl)
        };
      })
      .filter(Boolean);

    return normalizedSources.map((source) => {
      const durationMs = this.defaultDurationMs;
      const bitrateMbps = ESTIMATED_BITRATES_MBPS.get(Number(source.height)) || 1.35;
      const filesizeMbs = Math.round(
        (bitrateMbps * (durationMs / 1000) / 8) * 10
      ) / 10;
      return {
        ...source,
        filesizeMbs,
        durationMs,
        filesizeEstimated: true,
        durationEstimated: true
      };
    });
  }

  _proxyHlsUrl(sourceUrl) {
    if (!this.relaySecret || !this.hlsProxyUrl) return sourceUrl;

    const expires = Math.floor(Date.now() / 1000) + this.hlsProxyTtlSeconds;
    const signature = crypto
      .createHmac('sha256', this.relaySecret)
      .update(`${expires}.${sourceUrl}`)
      .digest('base64url');
    const proxyUrl = new URL(this.hlsProxyUrl);
    proxyUrl.searchParams.set('url', sourceUrl);
    proxyUrl.searchParams.set('expires', String(expires));
    proxyUrl.searchParams.set('signature', signature);
    return proxyUrl.toString();
  }
}

module.exports = HtvStreamResolver;
module.exports.sealMessage = sealMessage;
module.exports.openMessage = openMessage;
