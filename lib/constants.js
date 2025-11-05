/**
 * Application Constants
 * All constant values used throughout the addon
 */

/**
 * Addon ID prefix for namespacing
 * @type {string}
 */
const ADDON_PREFIX = 'hanime';

/**
 * Available genre tags for filtering
 * @type {Array<string>}
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
 * @enum {string}
 */
const CONTENT_TYPES = {
  Anime: 'anime',
  Movie: 'movie',
  Series: 'series',
  DEFAULT: 'anime' // Default content type for the addon
};

/**
 * Catalog category IDs
 * @enum {string}
 */
const CATALOG_CATEGORIES = {
  Hanime: 'hanime',
  Series: 'series',
  Newset: 'newset',
  Mostlikes: 'mostlikes',
  MostViews: 'mostviews',
  Recent: 'recent'
};

/**
 * Catalog extra parameters for filtering and pagination
 * @type {Array<Object>}
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

module.exports = {
  addonPrefix: ADDON_PREFIX,
  contentTypes: CONTENT_TYPES,
  genres: GENRES,
  catalogCategories: CATALOG_CATEGORIES,
  catalogExtras: CATALOG_EXTRAS
};

