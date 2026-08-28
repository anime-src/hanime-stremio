const assert = require('assert');
const constants = require('../lib/constants');
const { cleanDescription } = require('../lib/transformers/formatters');
const { toStremioCatalog } = require('../lib/transformers/catalog_transformer');
const { toStremioMeta } = require('../lib/transformers/meta_transformer');
const { toStremioStream } = require('../lib/transformers/stream_transformer');
const CatalogHandler = require('../lib/handlers/catalog_handler');
const MetaHandler = require('../lib/handlers/meta_handler');

const uncensoredVideo = {
  slug: 'uncensored-test-video',
  name: 'Uncensored Test Video',
  description: '<p>Test description</p>',
  tags: ['uncensored'],
  hentai_tags: [{ text: 'uncensored' }],
  released_at_unix: 1_700_000_000
};

function testCleanDescriptionPreservesLetterP() {
  const description = '<p>A popular episode with plenty of suspense.</p>\n<p>Part two.</p>';

  assert.strictEqual(
    cleanDescription(description),
    'A popular episode with plenty of suspense.\nPart two.'
  );
}

function testStreamMetadataUsesStremioCompatibleNotation() {
  const stream = toStremioStream({
    url: 'https://hanime.tv/hls/test',
    height: 720,
    video_stream_group_id: 'Hanime.TV',
    filesize_mbs: 202.5,
    filesize_estimated: true,
    duration_in_ms: 20 * 60 * 1000,
    duration_estimated: true
  });

  assert.ok(stream.title.includes('💾 203 MB'));
  assert.ok(stream.title.includes('⌚ 20 min'));
  assert.ok(!stream.title.includes('~'));
  assert.strictEqual(stream.description, stream.title);
  assert.strictEqual(
    stream.behaviorHints.videoSize,
    Math.round(202.5 * 1024 * 1024)
  );
}

function testUncensoredCatalogUsesPlayableSeriesEntries() {
  const [item] = toStremioCatalog([uncensoredVideo], constants.contentTypes.SERIES);
  assert.strictEqual(item.type, constants.contentTypes.SERIES);

  const meta = toStremioMeta(
    uncensoredVideo,
    {},
    constants.contentTypes.SERIES
  );
  assert.strictEqual(meta.type, constants.contentTypes.SERIES);
  assert.deepStrictEqual(meta.videos, [{
    id: 'hanime:uncensored-test-video',
    title: 'Uncensored Test Video',
    released: '2023-11-14T22:13:20.000Z',
    season: 1,
    episode: 1,
    overview: 'Test description'
  }]);
}

function testDefaultCatalogAndMetaRemainAnime() {
  const [item] = toStremioCatalog([uncensoredVideo]);
  const meta = toStremioMeta(uncensoredVideo, {});

  assert.strictEqual(item.type, constants.contentTypes.ANIME);
  assert.strictEqual(meta.type, constants.contentTypes.ANIME);
  assert.strictEqual(meta.videos, undefined);
}

async function testUncensoredCatalogToSeriesMetaRouting() {
  const config = {
    cache: { ttl: { catalog: 1, meta: 1 } },
    pagination: { itemsPerPage: 20 }
  };
  const logger = { warn() {}, error() {} };
  let videoDataCalls = 0;
  const apiClient = {
    async search() {
      return [uncensoredVideo];
    },
    async getVideoData() {
      videoDataCalls++;
      return { hentai_video: uncensoredVideo };
    }
  };
  const catalogHandler = new CatalogHandler(apiClient, logger, config);
  const metaHandler = new MetaHandler(apiClient, logger, config);

  const catalog = await catalogHandler.handle({
    id: constants.catalogCategories.UNCENSORED,
    extra: {}
  });
  const videoId = catalog.metas[0].id;
  const response = await metaHandler.handle({
    id: videoId,
    type: constants.contentTypes.SERIES
  });
  const animeResponse = await metaHandler.handle({
    id: videoId,
    type: constants.contentTypes.ANIME
  });

  assert.strictEqual(catalog.metas[0].type, constants.contentTypes.SERIES);
  assert.strictEqual(response.meta.type, constants.contentTypes.SERIES);
  assert.strictEqual(response.meta.videos.length, 1);
  assert.strictEqual(response.meta.videos[0].id, videoId);
  assert.strictEqual(animeResponse.meta.type, constants.contentTypes.ANIME);
  assert.strictEqual(animeResponse.meta.videos, undefined);
  assert.strictEqual(videoDataCalls, 2);
}

async function run() {
  testCleanDescriptionPreservesLetterP();
  testStreamMetadataUsesStremioCompatibleNotation();
  testUncensoredCatalogUsesPlayableSeriesEntries();
  testDefaultCatalogAndMetaRemainAnime();
  await testUncensoredCatalogToSeriesMetaRouting();
  console.log('transformer tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
