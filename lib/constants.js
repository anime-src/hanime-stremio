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
 * Brand / studio names that Hanime's search API accepts in its `brands` filter.
 * Surfaced in the same dropdown as genres, separated by GENRE_BRAND_SEPARATOR.
 */
const BRANDS = [
  '37c-Binetsu',
  'Adult Source Media',
  'AIC',
  'Ajia-Do',
  'Almond Collective',
  'Alpha Polis',
  'Ameliatie',
  'Amour',
  'Animac',
  'Antechinus',
  'APPP',
  'Arms',
  'Bishop',
  'Blue Eyes',
  'BOMB! CUTE! BOMB!',
  'Bootleg',
  'BreakBottle',
  'BugBug',
  'Bunnywalker',
  'Celeb',
  'Central Park Media',
  'ChiChinoya',
  'Chocolat',
  'ChuChu',
  'Circle Tribute',
  'CoCoans',
  'Collaboration Works',
  'Comet',
  'Comic Media',
  'Cosmos',
  'Cranberry',
  'Crimson',
  'D3',
  'Daiei',
  'demodemon',
  'Digital Works',
  'Discovery',
  'Dollhouse',
  'EBIMARU-DO',
  'Echo',
  'ECOLONUN',
  'Edge',
  'Erozuki',
  'evee',
  'Fanza',
  'FINAL FUCK 7',
  'Five Ways',
  'Friends Media Station',
  'Front Line',
  'fruit',
  'Godoy',
  'GOLD BEAR',
  'gomasioken',
  'Green Bunny',
  'Groover',
  'Hoods Entertainment',
  'Hot Bear',
  'Hykobo',
  'IRONBELL',
  'Ivory Tower',
  'J.C.',
  'Jellyfish',
  'Jewel',
  'Juicy Mango',
  'Jumondo',
  'kate_sai',
  'KENZsoft',
  'King Bee',
  'Kitty Media',
  'Knack',
  'KoaLa',
  'Kuril',
  'L.',
  'Lemon Heart',
  'Lilix',
  'Lune Pictures',
  'Magic Bus',
  'Magin Label',
  'Majin Petit',
  'Marigold',
  'Mary Jane',
  'Media Blasters',
  'MediaBank',
  'Metro Notes',
  'Milky',
  'MiMiA Cute',
  'Moon Rock',
  'Moonstone Cherry',
  'Mousou Senka',
  'MS Pictures',
  'Muse',
  'N43',
  'Nihikime no Dozeu',
  'Nikkatsu Video',
  'nur',
  'NuTech Digital',
  'Obtain Future',
  'Otodeli',
  'Pashmina',
  'Passione',
  'Pastel',
  'Peach Pie',
  'Pink Pineapple',
  'Pinkbell',
  'Pix',
  'Pixy Soft',
  'Pocomo Premium',
  'PoRO',
  'Project No.9',
  'Queen Bee',
  'Rabbit Gate',
  'ROJIURA JACK',
  'sakamotoJ',
  'Sakura Purin',
  'SANDWICHWORKS',
  'Schoolzone',
  'seismic',
  'SELFISH',
  'Seven',
  'Shadow Prod. Co.',
  'Shelf',
  'Shinyusha',
  'ShoSai',
  'Showten',
  'Soft on Demand',
  'SoftCell',
  'SPEED',
  'STARGATE3D',
  'Studio 9 Maiami',
  'Studio Akai Shohosen',
  'Studio Deen',
  'Studio Fantasia',
  'Studio FOW',
  'studio GGB',
  'Studio Gokumi',
  'Studio Houkiboshi',
  'Studio Zealot',
  'SurviveMore',
  'Suzuki Mirano',
  'SYLD',
  'T-Rex',
  't japan',
  'TDK Core',
  'TNK',
  'TOHO',
  'Toranoana',
  'Torudaya',
  'Triangle',
  'Trimax',
  'TYS Work',
  'U-Jin',
  'Umemaro-3D',
  'Union Cho',
  'Valkyria',
  'Vanilla',
  'White Bear'
];

/**
 * Visual separator inserted between genres and brands in the genre dropdown.
 * Selecting it should be treated as "no filter".
 */
const GENRE_BRAND_SEPARATOR = '-- Brands --';

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
  RECENT: 'hanime-recent',
  UNCENSORED: 'hanime-uncensored'
};

/**
 * Catalog extra parameters for filtering and pagination
 */
// Minimal catalog extras: search + skip only. Used where a genre dropdown
// adds little value (e.g. Series, where each item is an aggregate parent).
const CATALOG_EXTRAS_MINIMAL = [
  { name: 'search', isRequired: false },
  { name: 'skip', isRequired: false }
];

// Sort-only catalog extras: skip only, no `search`. Stremio only routes a
// search query to catalogs that declare `search` in their extras, so omitting
// it here keeps Recent / Most Likes / Most Views / Newest out of search
// results — search is intentionally limited to the main Hanime and Series
// catalogs to avoid five duplicate rows of identical hits.
const CATALOG_EXTRAS_SORT_ONLY = [
  { name: 'skip', isRequired: false }
];

// Base catalog extras: genres-only (used by sub-catalogs to keep manifest
// under Stremio's 8 KB limit).
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

// Full catalog extras: genres + separator + brands. Used by the main
// "Hanime" catalog only — embedding this on every catalog blows the
// manifest past Stremio's 8 KB ceiling.
const CATALOG_EXTRAS_WITH_BRANDS = [
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
    options: [...GENRES, GENRE_BRAND_SEPARATOR, ...BRANDS],
    isRequired: false
  }
];

// Brands the Uncensored catalog should expose. Generated by
// `npm run discover-brands`, which probes each brand for at least one
// uncensored hit. Falls back to the full BRANDS list if the file
// hasn't been generated yet.
let UNCENSORED_BRANDS = BRANDS;
try {
  const generated = require('./data/uncensored-brands.json');
  if (generated && Array.isArray(generated.brands) && generated.brands.length > 0) {
    UNCENSORED_BRANDS = generated.brands;
  }
} catch (_) {
  // No generated file yet — keep the full list as a safe fallback.
}

// Genres the Uncensored catalog should expose. Generated by
// `npm run discover-uncensored-genres`, which probes each genre for at
// least one uncensored hit. `censored` and `uncensored` are also stripped
// here as a defence-in-depth (the probe excludes them too) since they
// conflict with the catalog's forced `uncensored` tag. Falls back to the
// full GENRES list (minus the conflicting pair) if the file hasn't been
// generated yet.
const UNCENSORED_GENRE_BLOCKLIST = new Set(['censored', 'uncensored']);
let UNCENSORED_GENRES = GENRES.filter(g => !UNCENSORED_GENRE_BLOCKLIST.has(g));
try {
  const generated = require('./data/uncensored-genres.json');
  if (generated && Array.isArray(generated.genres) && generated.genres.length > 0) {
    UNCENSORED_GENRES = generated.genres.filter(g => !UNCENSORED_GENRE_BLOCKLIST.has(g));
  }
} catch (_) {
  // No generated file yet — keep the filtered fallback.
}

// Uncensored-only catalog extras: genres + separator + brands that
// actually have uncensored content. Same shape as WITH_BRANDS, but with
// `search` omitted so this catalog isn't queried during a global search
// (the main Hanime catalog already covers uncensored hits via tag filter).
const CATALOG_EXTRAS_UNCENSORED = [
  {
    name: 'skip',
    isRequired: false
  },
  {
    name: 'genre',
    options: [...UNCENSORED_GENRES, GENRE_BRAND_SEPARATOR, ...UNCENSORED_BRANDS],
    isRequired: false
  }
];

// Single constants export object
const Constants = {
  ADDON_PREFIX,
  GENRES,
  BRANDS,
  UNCENSORED_BRANDS,
  UNCENSORED_GENRES,
  GENRE_BRAND_SEPARATOR,
  ContentTypes,
  CatalogCategories,
  CATALOG_EXTRAS,
  CATALOG_EXTRAS_WITH_BRANDS,
  CATALOG_EXTRAS_UNCENSORED,
  CATALOG_EXTRAS_MINIMAL,
  CATALOG_EXTRAS_SORT_ONLY
};

// Export with backward compatibility for existing code
module.exports = Constants;
module.exports.addonPrefix = ADDON_PREFIX;
module.exports.genres = GENRES;
module.exports.brands = BRANDS;
module.exports.genreBrandSeparator = GENRE_BRAND_SEPARATOR;
module.exports.contentTypes = ContentTypes;
module.exports.catalogCategories = CatalogCategories;
module.exports.catalogExtras = CATALOG_EXTRAS;
module.exports.catalogExtrasWithBrands = CATALOG_EXTRAS_WITH_BRANDS;
module.exports.catalogExtrasUncensored = CATALOG_EXTRAS_UNCENSORED;
module.exports.catalogExtrasMinimal = CATALOG_EXTRAS_MINIMAL;
module.exports.catalogExtrasSortOnly = CATALOG_EXTRAS_SORT_ONLY;
module.exports.uncensoredBrands = UNCENSORED_BRANDS;
module.exports.uncensoredGenres = UNCENSORED_GENRES;
