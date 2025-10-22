const constants = require("./addon_const");

function titleize(string, separator = " ") {
  return string
    .split(separator)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(separator);
}

function formatCatalog(catalog) {
  const genres = [];
  if(catalog.tags){
    catalog.tags.forEach(tag => {
      genres.push(tag[0].toUpperCase() + tag.slice(1).toLowerCase())
    });
  }
 
  return {
    id: catalog.slug,
    name: catalog.name,
    poster: proxyURL(catalog.cover_url),
    logo: constants.logo,
    genre: genres,
    description: catalog.description.replace(/([</p>\n])/g, "").trim(),
    posterShape: "poster",
    type: "movie",
    behaviorHints: { defaultVideoId: catalog.slug }
  };
}

function buildCatalogQueryParms(args) {
  let queryParms = {
    query: "",
    tags: [],
    orderBy: "created_at_unix",
    ordering: "desc",
    page: 0,
  };

  const id = args.id;

  switch (id) {
    case constants.catalogCategories.Mostlikes:
      queryParms.orderBy = "likes";
      break;
    case constants.catalogCategories.Recent:
      queryParms.orderBy = "created_at_unix";
      break;
    case constants.catalogCategories.Newset:
      queryParms.orderBy = "released_at_unix";
      break;
    case constants.catalogCategories.MostViews:
      queryParms.orderBy = "views";
      break;
  }

  queryParms.query = args.extra.search ? args.extra.search : "";
  queryParms.tags = args.extra.genre ? [args.extra.genre] : [];
  queryParms.page = args.extra.skip ? args.extra.skip / 48 + 1 : 0;

  return queryParms;
}

function proxyURL(url) {
  const u = new URL(url);
  return `${process.env.PUBLIC_URL}/proxy${u.pathname}`;
}

module.exports.buildCatalogQueryParms = buildCatalogQueryParms;
module.exports.formatCatalog = formatCatalog;
module.exports.titleize = titleize;
module.exports.proxyURL = proxyURL;
