/**
 * Application Constants
 * All constant values used throughout the addon
 */

/**
 * Addon ID prefix for namespacing
 */
const ADDON_PREFIX = 'hanime';

/**
 * Available genre tags for filtering
 */
const GENRES = [
  '3d',
  'ahegao',
  'anal',
  'bdsm',
  'big boobs',
  'blow job',
  'bondage',
  'boob job',
  'censored',
  'comedy',
  'cosplay',
  'creampie',
  'dark skin',
  'facial',
  'fantasy',
  'filmed',
  'foot job',
  'futanari',
  'gangbang',
  'glasses',
  'hand job',
  'harem',
  'hd',
  'horror',
  'incest',
  'inflation',
  'lactation',
  'loli',
  'maid',
  'masturbation',
  'milf',
  'mind break',
  'mind control',
  'monster',
  'nekomimi',
  'ntr',
  'nurse',
  'orgy',
  'plot',
  'pov',
  'pregnant',
  'public sex',
  'rape',
  'reverse rape',
  'rimjob',
  'scat',
  'school girl',
  'shota',
  'softcore',
  'swimsuit',
  'teacher',
  'tentacle',
  'threesome',
  'toys',
  'trap',
  'tsundere',
  'ugly bastard',
  'uncensored',
  'vanilla',
  'virgin',
  'watersports',
  'x-ray',
  'yaoi',
  'yuri'
];

/**
 * Content types supported by the addon
 */
const ContentTypes = {
  ANIME: 'anime',
  MOVIE: 'movie',
  SERIES: 'series',
  DEFAULT: 'anime' // Default content type for the addon
};

/**
 * Catalog category IDs
 * Prefixed with "hanime-" to avoid conflicts with other addons
 */
const CatalogCategories = {
  HANIME: 'hanime',
  SERIES: 'hanime-series',
  NEWEST: 'hanime-newest',
  MOST_LIKES: 'hanime-mostlikes',
  MOST_VIEWS: 'hanime-mostviews',
  RECENT: 'hanime-recent'
};

/**
 * Catalog extra parameters for filtering and pagination
 */
const CATALOG_EXTRAS = [
  {
    name: 'search',
    isRequired: false
  },
  {
    name: 'skip',
    isRequired: false
  },
  {
    name: 'genre',
    options: GENRES,
    isRequired: false
  }
];

// Single constants export object
const Constants = {
  ADDON_PREFIX,
  GENRES,
  ContentTypes,
  CatalogCategories,
  CATALOG_EXTRAS
};

// Export with backward compatibility for existing code
module.exports = Constants;
module.exports.addonPrefix = ADDON_PREFIX;
module.exports.genres = GENRES;
module.exports.contentTypes = ContentTypes;
module.exports.catalogCategories = CatalogCategories;
module.exports.catalogExtras = CATALOG_EXTRAS;

