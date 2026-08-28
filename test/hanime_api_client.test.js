const assert = require('assert');
const axios = require('axios');
const HanimeApiClient = require('../lib/clients/hanime_api_client');
const config = require('../lib/config');

const originalGet = axios.get;
const originalPost = axios.post;

async function testSearchUsesSearchHvsDataset() {
  const calls = [];
  const searchUrl = 'https://cached.freeanimehentai.net/api/v10/search_hvs';

  axios.get = async (url) => {
    calls.push(['get', url]);
    assert.strictEqual(url, searchUrl);

    return {
      status: 200,
      data: [
        {
          id: 1,
          name: 'Alpha Episode',
          search_titles: 'Alpha',
          slug: 'alpha-episode',
          description: '<p>first result</p>',
          brand: 'Queen Bee',
          tags: ['hd', 'anal'],
          views: 10,
          likes: 2,
          created_at_unix: 100,
          released_at_unix: 1000
        },
        {
          id: 2,
          name: 'Beta Episode',
          search_titles: 'Beta alternate',
          slug: 'beta-episode',
          description: '<p>matching description</p>',
          brand: 'Queen Bee',
          tags: ['hd', 'milf'],
          views: 50,
          likes: 5,
          created_at_unix: 200,
          released_at_unix: 900
        },
        {
          id: 3,
          name: 'Beta Other Studio',
          search_titles: 'Beta',
          slug: 'beta-other-studio',
          description: '<p>matching but wrong brand</p>',
          brand: 'Pink Pineapple',
          tags: ['hd'],
          views: 100,
          likes: 1,
          created_at_unix: 300,
          released_at_unix: 800
        }
      ]
    };
  };

  axios.post = async () => {
    throw new Error('search should use the current GET search_hvs endpoint');
  };

  const client = new HanimeApiClient({
    api: {
      authority: 'hanime.tv',
      defaultAuthority: 'hw.hanime.tv',
      searchUrl
    }
  });

  const results = await client.search({
    query: 'beta',
    tags: ['hd'],
    brands: ['Queen Bee'],
    orderBy: 'views',
    ordering: 'desc',
    page: 0
  });

  assert.deepStrictEqual(results.map(item => item.slug), ['beta-episode']);
  assert.deepStrictEqual(calls, [['get', searchUrl]]);
}

async function testSearchAcceptsCurrentDataWrappedDataset() {
  axios.get = async () => ({
    status: 200,
    data: {
      data: [{
        id: 4,
        name: 'Current API Episode',
        search_titles: 'Current Episode',
        slug: 'current-api-episode',
        description: '<p>Current search payload shape</p>',
        brand: 'Queen Bee',
        tags: ['hd'],
        views: 10,
        likes: 2,
        created_at_unix: 100,
        released_at_unix: 1000
      }],
      ads: []
    }
  });

  const client = new HanimeApiClient(config);
  const results = await client.search({ query: 'current' });

  assert.deepStrictEqual(results.map(item => item.slug), ['current-api-episode']);
}

async function testSearchCanReturnAllFilteredResultsBeforePagination() {
  axios.get = async () => ({
    status: 200,
    data: [1, 2, 3].map(number => ({
      id: number,
      name: `Grouped Show ${number}`,
      slug: `grouped-show-${number}`,
      tags: ['uncensored'],
      created_at_unix: number
    }))
  });

  const client = new HanimeApiClient({
    ...config,
    pagination: { itemsPerPage: 2 }
  });
  const results = await client.search({
    tags: ['uncensored'],
    paginate: false
  });

  assert.deepStrictEqual(results.map(item => item.slug), [
    'grouped-show-3',
    'grouped-show-2',
    'grouped-show-1'
  ]);
}

async function testVideoMetadataUsesSearchDatasetWithoutCallingRetiredEndpoint() {
  const requestedUrls = [];
  axios.get = async (url) => {
    requestedUrls.push(url);

    if (url.includes('/api/v8/video')) {
      throw new Error('Retired video metadata endpoint must not be requested');
    }

    return {
      status: 200,
      data: [{
        slug: 'test-video',
        name: 'Test Video',
        tags: ['hd', 'plot']
      }]
    };
  };

  const client = new HanimeApiClient(config);
  const result = await client.getVideoData('test-video');

  assert.strictEqual(result.hentai_video.slug, 'test-video');
  assert.deepStrictEqual(requestedUrls, [
    'https://hanime-handshake.skynetsource.com/api/v11/search_hvs'
  ]);
}

async function testProductionSearchUsesAuthenticatedWorkerRelay() {
  let request;
  axios.get = async (url, options) => {
    request = { url, options };
    return { status: 200, data: [] };
  };

  const client = new HanimeApiClient({
    ...config,
    api: {
      ...config.api,
      htv: {
        ...config.api.htv,
        relaySecret: 'relay-secret'
      }
    }
  });
  await client.search({});

  assert.strictEqual(
    request.url,
    'https://hanime-handshake.skynetsource.com/api/v11/search_hvs'
  );
  assert.strictEqual(request.options.headers.authorization, 'Bearer relay-secret');
  assert.strictEqual(request.options.headers['x-signature-version'], 'app2');
  assert.ok(request.options.headers['x-claim']);
  assert.ok(request.options.headers['x-signature']);
}

async function testVideoMetadataNormalizesSearchDatasetFields() {
  axios.get = async (url) => {
    if (url.includes('/api/v11/search_hvs')) {
      return {
        status: 200,
        data: [{
          slug: 'dataset-video',
          name: 'Dataset Video',
          tags: ['hd', 'plot'],
          description: '<p>Dataset description</p>'
        }]
      };
    }
    throw new Error(`Unexpected GET ${url}`);
  };

  const client = new HanimeApiClient(config);
  const result = await client.getVideoData('dataset-video');

  assert.strictEqual(result.hentai_video.slug, 'dataset-video');
  assert.strictEqual(result.hentai_video.duration_in_ms, 20 * 60 * 1000);
  assert.deepStrictEqual(result.hentai_video.hentai_tags, [
    { text: 'hd' },
    { text: 'plot' }
  ]);
}

function testSearchDatasetCacheWindowIsSixHours() {
  const client = new HanimeApiClient(config);
  assert.strictEqual(client.searchDatasetTtlMs, 6 * 60 * 60 * 1000);
}

async function main() {
  try {
    await testSearchUsesSearchHvsDataset();
    await testSearchAcceptsCurrentDataWrappedDataset();
    await testSearchCanReturnAllFilteredResultsBeforePagination();
    await testVideoMetadataUsesSearchDatasetWithoutCallingRetiredEndpoint();
    await testProductionSearchUsesAuthenticatedWorkerRelay();
    await testVideoMetadataNormalizesSearchDatasetFields();
    testSearchDatasetCacheWindowIsSixHours();
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
  }
}

main()
  .then(() => {
    console.log('hanime_api_client tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
