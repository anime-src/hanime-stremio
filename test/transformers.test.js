const assert = require('assert');
const constants = require('../lib/constants');
const { buildGenreCategories, cleanDescription } = require('../lib/transformers/formatters');
const { toStremioCatalog } = require('../lib/transformers/catalog_transformer');
const { toStremioMeta, toStremioSeriesMeta } = require('../lib/transformers/meta_transformer');
const { toStremioStream } = require('../lib/transformers/stream_transformer');
const CatalogHandler = require('../lib/handlers/catalog_handler');
const MetaHandler = require('../lib/handlers/meta_handler');

const uncensoredVideo = {
  slug: 'uncensored-test-video',
  name: 'Uncensored Test Video',
  description: '<p>Test description</p>',
  tags: ['uncensored'],
  hentai_tags: [{ text: 'uncensored' }],
  brand: 'MS Pictures',
  released_at_unix: 1_700_000_000
};

function testManifestScopesHanimeIdResources() {
  const { manifest } = require('../addon');

  assert.deepStrictEqual(manifest.resources, [
    'catalog',
    { name: 'stream', types: ['anime', 'series'], idPrefixes: ['hanime'] },
    { name: 'meta', types: ['anime', 'series'], idPrefixes: ['hanime'] }
  ]);
}

function testCleanDescriptionPreservesLetterP() {
  const description = '<p>A popular episode with plenty of suspense.</p>\n<p>Part two.</p>';

  assert.strictEqual(
    cleanDescription(description),
    'A popular episode with plenty of suspense.\nPart two.'
  );
}

function testGenreCategoriesDeduplicateBrandAndIgnoreBlankValues() {
  assert.deepStrictEqual(
    buildGenreCategories(['vanilla'], 'Vanilla'),
    ['Vanilla']
  );
  assert.deepStrictEqual(
    buildGenreCategories(['uncensored'], '   '),
    ['Uncensored']
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
  assert.deepStrictEqual(item.genre, ['Uncensored', 'MS Pictures']);
  assert.deepStrictEqual(item.genres, ['Uncensored', 'MS Pictures']);

  const meta = toStremioMeta(
    uncensoredVideo,
    {},
    constants.contentTypes.SERIES
  );
  assert.strictEqual(meta.type, constants.contentTypes.SERIES);
  assert.deepStrictEqual(meta.genre, ['Uncensored', 'MS Pictures']);
  assert.strictEqual(
    meta.links.filter(link => link.name === 'MS Pictures').length,
    1
  );
  assert.strictEqual(
    meta.links.find(link => link.name === 'MS Pictures').category,
    'Studio'
  );
  assert.deepStrictEqual(meta.videos, [{
    id: 'hanime:uncensored-test-video',
    title: 'Uncensored Test Video',
    released: '2023-11-14T22:13:20.000Z',
    season: 1,
    episode: 1,
    overview: 'Test description'
  }]);
}

function testGroupedSeriesIncludesBrandAsGenreCategory() {
  const meta = toStremioSeriesMeta(
    'series:uncensored-test-video',
    'Uncensored Test Video',
    [uncensoredVideo],
    {}
  );

  assert.deepStrictEqual(meta.genre, ['Uncensored', 'MS Pictures']);
  assert.deepStrictEqual(meta.genres, ['Uncensored', 'MS Pictures']);
}

function testDefaultCatalogAndMetaRemainAnime() {
  const [item] = toStremioCatalog([uncensoredVideo]);
  const meta = toStremioMeta(uncensoredVideo, {});

  assert.strictEqual(item.type, constants.contentTypes.ANIME);
  assert.strictEqual(meta.type, constants.contentTypes.ANIME);
  assert.strictEqual(meta.videos, undefined);
}

async function testUncensoredCatalogToSeriesMetaRouting() {
  assert.strictEqual(constants.uncensoredBrands.includes('Suiseisha'), false);
  const config = {
    cache: { ttl: { catalog: 1, meta: 1 } },
    pagination: { itemsPerPage: 20 }
  };
  const logger = { warn() {}, error() {} };
  let videoDataCalls = 0;
  let seriesSearchParams;
  const apiClient = {
    async search(params) {
      seriesSearchParams = params;
      return [{
        ...uncensoredVideo,
        tags: ['uncensored', 'censored', 'hd', '2000-year-old dragon girl']
      }];
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
  assert.deepStrictEqual(catalog.metas[0].genre, ['Hd', 'MS Pictures']);
  assert.deepStrictEqual(catalog.metas[0].genres, ['Hd', 'MS Pictures']);
  assert.strictEqual(response.meta.type, constants.contentTypes.SERIES);
  assert.strictEqual(response.meta.videos.length, 1);
  assert.strictEqual(response.meta.videos[0].id, videoId);
  assert.strictEqual(animeResponse.meta.type, constants.contentTypes.ANIME);
  assert.strictEqual(animeResponse.meta.videos, undefined);
  assert.strictEqual(videoDataCalls, 2);
  assert.strictEqual(seriesSearchParams.paginate, false);
  assert.strictEqual(seriesSearchParams.query, '');
}

async function testUncensoredCatalogGroupsNumberedEpisodesAndKeepsStandaloneVideos() {
  const episodes = Array.from({ length: 12 }, (_, index) => ({
    ...uncensoredVideo,
    slug: `isekai-meikyuu-de-harem-wo-${index + 1}`,
    name: `Isekai Meikyuu de Harem wo ${index + 1}`
  }));
  const standalone = {
    ...uncensoredVideo,
    slug: 'standalone-film',
    name: 'Standalone Film'
  };
  const config = {
    cache: { ttl: { catalog: 1 } },
    pagination: { itemsPerPage: 20 }
  };
  let searchCalls = 0;
  const apiClient = {
    async search() {
      searchCalls++;
      return [...episodes, standalone];
    }
  };
  const handler = new CatalogHandler(apiClient, { warn() {}, error() {} }, config);

  const response = await handler.handle({
    id: constants.catalogCategories.UNCENSORED,
    extra: { search: 'isekai grouping regression' }
  });

  assert.deepStrictEqual(response.metas.map(item => item.id), [
    'hanime:series:isekai-meikyuu-de-harem-wo',
    'hanime:standalone-film'
  ]);
  assert.strictEqual(response.metas[0].type, constants.contentTypes.SERIES);
  assert.deepStrictEqual(response.metas[0].genre, ['MS Pictures']);
  assert.deepStrictEqual(response.metas[0].genres, ['MS Pictures']);
  assert.match(response.metas[0].description, /^12 Episodes/);
  assert.strictEqual(response.metas[1].type, constants.contentTypes.SERIES);
  assert.deepStrictEqual(response.metas[1].genre, ['MS Pictures']);
  assert.deepStrictEqual(response.metas[1].genres, ['MS Pictures']);
  assert.strictEqual(response.metas[1].behaviorHints.defaultVideoId, 'hanime:standalone-film');

  const secondPageHandler = new CatalogHandler(apiClient, { warn() {}, error() {} }, {
    ...config,
    pagination: { itemsPerPage: 1 }
  });
  const secondPage = await secondPageHandler.handle({
    id: constants.catalogCategories.UNCENSORED,
    extra: { search: 'isekai grouping regression', skip: 1 }
  });
  assert.deepStrictEqual(secondPage.metas.map(item => item.id), [
    'hanime:standalone-film'
  ]);
  assert.strictEqual(searchCalls, 1);
}

async function run() {
  testManifestScopesHanimeIdResources();
  testCleanDescriptionPreservesLetterP();
  testGenreCategoriesDeduplicateBrandAndIgnoreBlankValues();
  testStreamMetadataUsesStremioCompatibleNotation();
  testUncensoredCatalogUsesPlayableSeriesEntries();
  testGroupedSeriesIncludesBrandAsGenreCategory();
  testDefaultCatalogAndMetaRemainAnime();
  await testUncensoredCatalogToSeriesMetaRouting();
  await testUncensoredCatalogGroupsNumberedEpisodesAndKeepsStandaloneVideos();
  console.log('transformer tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
