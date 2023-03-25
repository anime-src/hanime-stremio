const { addonBuilder } = require("stremio-addon-sdk");
const apis = require("./lib/addon_api");
const constants = require("./lib/addon_const");
const helper = require("./lib/addon_helper");

const autohority = "hanime.tv";

const manifest = {
  id: "hanime-addon",
  version: "1.0.1",
  behaviorHints: {
    adult: true,
  },
  catalogs: [
    {
      type: "movie",
      name: "Hanime Recent",
      id: constants.catalogCategories.Recent,
      extra: constants.catalogExtrass,
    },
    {
      type: "movie",
      name: "Hanime Most likes",
      id: constants.catalogCategories.Mostlikes,
      extra: constants.catalogExtrass,
    },
    {
      type: "movie",
      name: "Hanime Most Views",
      id: constants.catalogCategories.MostViews,
      extra: constants.catalogExtrass,
    },
    {
      type: "movie",
      name: "Hanime Newset",
      id: constants.catalogCategories.Newset,
      extra: constants.catalogExtrass,
    },
  ],
  resources: ["catalog", "stream", "meta"],
  types: ["movie"],
  name: "Hanime",
  icon: "https://bit.ly/3ca6ETu",
  description:
    "Enjoy your unlimited hentai & anime collection. We are the definitive source for the best curated 720p / 1080p HD hentai videos for free.",
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async (args) => {
  const parms = helper.buildCatalogQueryParms(args);
  resp = await apis.hanime.addon.getSearch(parms.query, parms.tags, parms.orderBy, parms.ordering, parms.page);
  metas = resp.map(helper.formatCatalog);
  return Promise.resolve({ metas });
});


builder.defineMetaHandler(async (args) => {
  const id = args.id;
  const resp = await apis.hanime.addon.getMeta(autohority, id);
  const genres = resp.hentai_tags.map((el) => {
    return el.text;
  });
  const new_gen = genres.map(
    (word) => word[0].toUpperCase() + word.slice(1).toLowerCase()
  );
  const metas = {
    id: resp.slug,
    name: resp.name,
    logo: constants.logo,
    background: resp.poster_url,
    genre: new_gen,
    description: resp.description.replace(/([</p>\n])/g, "").trim(),
    posterShape: "landscape",
    type: "movie",
  };
  return Promise.resolve({ meta: metas });
});

builder.defineStreamHandler(async (args) => {
  const id = args.id;
  const resp = await apis.hanime.addon.getStream(autohority, id);
  const streams = resp.map((obj) => {
    const name = helper.titleize(obj.video_stream_group_id.replace(/-/g, " "));
    return {
      name: `Hanime.TV\n${obj.height}p`,
      title: `${name.slice(0, -3)}\n 💾 ${obj.filesize_mbs} MB ⌚ ${(
        obj.duration_in_ms / 60000
      ).toFixed()} min`,
      url: obj.url || "",
      behaviorHints: {
        proxyHeaders: {
          request: {
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9",
            "origin": "https://player.hanime.tv",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
          },
        },
      },
    };
  });
  return Promise.resolve({ streams });
});

module.exports = builder.getInterface();
