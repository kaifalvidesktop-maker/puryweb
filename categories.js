// PuryWeb — content/categories.js
// 30 page categories. Each has a score(features) -> 0..100 and an extraction profile.
// `kind` selects the Phase 6 template family; `root`/`drop`/`itemSelector` steer the extractor.

export const isGovHost = (h) =>
  /(^|\.)(gov|mil|nic)(\.[a-z]{2,3})?$|(^|\.)(go|gob|gouv)\.[a-z]{2,3}$/i.test(h || '');

const GOV_TXT = /(গণপ্রজাতন্ত্রী|মন্ত্রণালয়|অধিদপ্তর|সরকার|government of|ministry|department of|republic of)/i;
const FORM_TXT = /(application|apply|registration|register|form|submit|আবেদন|ফরম|নিবন্ধন|রেজিস্ট্রেশন|জমা)/i;
const NOTICE_TXT = /(notice|circular|tender|gazette|office order|বিজ্ঞপ্তি|নোটিশ|প্রজ্ঞাপন|পরিপত্র|আদেশ|দরপত্র|নিয়োগ)/i;
const RESULT_TXT = /(result|marksheet|merit list|roll no|grade|ফলাফল|রেজাল্ট|মেধা তালিকা|রোল)/i;
const EDU_HOST = /(\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|university|varsity|college|school|educationboard|বিশ্ববিদ্যালয়)/i;
const NEWS_HOST = /(news|times|daily|post|prothom|kaler|jugantor|bdnews|samakal|ittefaq|bbc|cnn|reuters|guardian|nytimes|aljazeera|thedailystar|tbsnews|dhakatribune|banglatribune|jagonews|somoy|jamuna|ntv|rtv|channeli)/i;
const SHOP_HOST = /(daraz|amazon|ebay|aliexpress|alibaba|walmart|flipkart|shopify|etsy|rokomari|pickaboo|startech|ryans|chaldal|shajgoj|myshopify|temu|shein)/i;
const BLOG_HOST = /(medium\.com|substack|wordpress|blogspot|blogger|dev\.to|hashnode|ghost\.io|tumblr)/i;
const DOC_HOST = /(^(docs|developer|developers|devdocs|learn|help|support|wiki|api)\.|readthedocs|developer\.mozilla|github\.io|gitbook)/i;
const FORUM_HOST = /(stackoverflow|stackexchange|quora|discourse|reddit|forum|community)/i;
const JOB_HOST = /(bdjobs|indeed|glassdoor|naukri|monster|jobs\.|careers\.)/i;

const YT = (f) => /(^|\.)youtube\.com$|^youtu\.be$/.test(f.host);
const FB = (f) => /(^|\.)(facebook|fb)\.com$/.test(f.host);
const J = (f, ...types) => types.some((t) => f.jsonld.has(t.toLowerCase()));
const c = (f, k) => f.counts[k] || 0;
const gov = (f) => (isGovHost(f.host) ? 1 : GOV_TXT.test(f.text.slice(0, 2000)) ? 0.5 : 0);
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** @type {Array<{id:string,label:string,group:string,kind:string,score:(f:any)=>number,[k:string]:any}>} */
export const CATEGORIES = [
  {
    id: 'youtube-watch', label: 'YouTube video', group: 'video', kind: 'video', adapter: 'youtube-watch',
    root: ['#primary'], drop: ['#related', '#secondary', 'ytd-merch-shelf-renderer', '#chat', 'ytd-ad-slot-renderer'],
    score: (f) => (YT(f) && /^\/watch/.test(f.path) ? 100 : 0),
  },
  {
    id: 'youtube-home', label: 'YouTube home', group: 'video', kind: 'feed',
    root: ['ytd-rich-grid-renderer', '#contents'], itemSelector: 'ytd-rich-item-renderer, ytd-grid-video-renderer',
    cardFields: { title: '#video-title', channel: 'ytd-channel-name a, #channel-name a', meta: '#metadata-line span', href: 'a#thumbnail, a#video-title-link' },
    drop: ['ytd-ad-slot-renderer', 'ytd-statement-banner-renderer'],
    score: (f) => (YT(f) ? (f.path === '/' ? 100 : /^\/(feed|@|channel|c\/|user\/)/.test(f.path) ? 80 : 0) : 0),
  },
  {
    id: 'youtube-search', label: 'YouTube search', group: 'video', kind: 'listing',
    root: ['ytd-search', '#contents'], itemSelector: 'ytd-video-renderer, ytd-channel-renderer, ytd-playlist-renderer',
    cardFields: { title: '#video-title', channel: 'ytd-channel-name a', meta: '#metadata-line span', href: 'a#thumbnail, a#video-title' },
    drop: ['ytd-ad-slot-renderer', 'ytd-shelf-renderer'],
    score: (f) => (YT(f) && /^\/results/.test(f.path) ? 100 : 0),
  },
  {
    id: 'youtube-shorts', label: 'YouTube Shorts', group: 'video', kind: 'video', root: ['ytd-shorts'],
    score: (f) => (YT(f) && /^\/shorts/.test(f.path) ? 100 : 0),
  },
  {
    id: 'facebook-feed', label: 'Facebook feed', group: 'social', kind: 'feed', root: ['[role="feed"]', '[role="main"]'],
    itemSelector: '[role="article"]',
    score: (f) => (FB(f) ? (/^\/(home\.php|watch|groups\/[^/]+\/?$)?$/.test(f.path) && c(f, 'roleArticles') >= 1 ? 92 : 40) : 0),
  },
  {
    id: 'facebook-post', label: 'Facebook post', group: 'social', kind: 'thread', root: ['[role="main"]'],
    itemSelector: '[role="article"]',
    score: (f) => (FB(f) && (/\/(posts|permalink|photo|photos|videos|story)\b/.test(f.path) || /story_fbid|fbid/.test(f.query)) ? 95 : 0),
  },
  {
    id: 'instagram-feed', label: 'Instagram', group: 'social', kind: 'feed', root: ['main', '[role="main"]'], itemSelector: 'article',
    score: (f) => (/(^|\.)instagram\.com$/.test(f.host) ? 88 : 0),
  },
  {
    id: 'twitter-feed', label: 'X / Twitter', group: 'social', kind: 'feed', root: ['main', '[data-testid="primaryColumn"]'],
    itemSelector: 'article[data-testid="tweet"], article',
    score: (f) => (/(^|\.)(twitter|x)\.com$/.test(f.host) ? 90 : 0),
  },
  {
    id: 'reddit-thread', label: 'Reddit', group: 'social', kind: 'thread', root: ['main', '#main-content'],
    score: (f) => (/(^|\.)reddit\.com$/.test(f.host) ? (/\/comments\//.test(f.path) ? 100 : 55) : 0),
  },
  {
    id: 'linkedin-feed', label: 'LinkedIn', group: 'social', kind: 'feed', root: ['main'], itemSelector: '[data-id^="urn:li:activity"], .feed-shared-update-v2',
    score: (f) => (/(^|\.)linkedin\.com$/.test(f.host) && !/^\/jobs/.test(f.path) ? (/^\/(feed)?\/?$/.test(f.path) ? 95 : 70) : 0),
  },
  {
    id: 'gov-form', label: 'Government form', group: 'gov', kind: 'form',
    score: (f) => {
      let s = gov(f) * 35;
      if (c(f, 'inputs') >= 4) s += 30;
      if (c(f, 'selects') + c(f, 'textInputs') >= 6) s += 10;
      if (FORM_TXT.test(f.title + ' ' + f.h1 + ' ' + f.heads)) s += 15;
      if (c(f, 'legacy') >= 2 || c(f, 'layoutTables') >= 1) s += 5;
      if (f.flags.captcha) s += 5;
      if (c(f, 'passwords') && c(f, 'inputs') <= 6) s -= 40;
      if (!c(f, 'forms')) s = Math.min(s, 20);
      return clamp(s);
    },
  },
  {
    id: 'gov-notice', label: 'Government notice', group: 'gov', kind: 'notice',
    score: (f) => {
      let s = gov(f) * 35;
      if (NOTICE_TXT.test(f.title + ' ' + f.h1 + ' ' + f.heads)) s += 25;
      if (/(notice|circular|tender|news|bijnopti|বিজ্ঞপ্তি)/i.test(f.path)) s += 20;
      if (c(f, 'pdfLinks') >= 2) s += 15;
      if (c(f, 'inputs') < 4) s += 5;
      return clamp(s);
    },
  },
  {
    id: 'gov-result', label: 'Result page', group: 'gov', kind: 'result',
    score: (f) => {
      let s = 0;
      if (RESULT_TXT.test(f.title + ' ' + f.h1 + ' ' + f.heads)) s += 30;
      if (gov(f) || EDU_HOST.test(f.host)) s += 20;
      if (c(f, 'dataTables') >= 1) s += 15;
      if (f.flags.rollInput) s += 20;
      if (/result|marks|merit|রেজাল্ট/i.test(f.path)) s += 15;
      return clamp(s);
    },
  },
  {
    id: 'gov-portal-home', label: 'Government portal home', group: 'gov', kind: 'home',
    score: (f) => {
      let s = gov(f) * 40;
      if (/^\/(index(\.\w+)?|home|en|bn)?\/?$/.test(f.path)) s += 30;
      if (c(f, 'links') >= 40) s += 20;
      if (c(f, 'images') >= 5) s += 5;
      if (c(f, 'inputs') < 4) s += 5;
      return clamp(s);
    },
  },
  {
    id: 'news-article', label: 'News article', group: 'news', kind: 'article',
    root: ['article', '[itemprop="articleBody"]', '.article-body', '.story-body', '.detail-body'],
    score: (f) => {
      let s = 0;
      if (J(f, 'newsarticle', 'reportagenewsarticle', 'article')) s += 40;
      if (f.og === 'article') s += 25;
      if (f.flags.article) s += 10;
      if (f.flags.byline || f.flags.time) s += 10;
      if (c(f, 'paragraphs') >= 5) s += 10;
      if (NEWS_HOST.test(f.host)) s += 10;
      if (J(f, 'blogposting') || BLOG_HOST.test(f.host)) s -= 25;
      return clamp(s);
    },
  },
  {
    id: 'news-home', label: 'News homepage', group: 'news', kind: 'home', itemSelector: 'article, .story, .news-item, li',
    score: (f) => {
      let s = 0;
      if (c(f, 'headingLinks') >= 12) s += 35;
      if (f.path === '/' || /^\/(index|home)/.test(f.path)) s += 20;
      if (NEWS_HOST.test(f.host) || J(f, 'newsmediaorganization')) s += 25;
      if (c(f, 'images') >= 10) s += 10;
      if (c(f, 'paragraphs') < 12) s += 5;
      return clamp(s);
    },
  },
  {
    id: 'e-commerce-product', label: 'Product page', group: 'shop', kind: 'product',
    root: ['#productDetails', '[itemtype*="Product"]', '.product-detail', '.product-page', 'main'],
    score: (f) => {
      let s = 0;
      if (J(f, 'product')) s += 50;
      if (f.og === 'product' || f.og === 'og:product') s += 20;
      if (c(f, 'prices') >= 1) s += 10;
      if (f.flags.cart) s += 15;
      if (SHOP_HOST.test(f.host)) s += 15;
      if (c(f, 'prices') > 12) s -= 25;
      return clamp(s);
    },
  },
  {
    id: 'e-commerce-listing', label: 'Product listing', group: 'shop', kind: 'listing', itemSelector: '[class*="product" i], [data-qa-locator="product-item"], li.s-result-item',
    score: (f) => {
      let s = 0;
      if (c(f, 'prices') >= 6) s += 40;
      if (/(search|category|categories|shop|collections?|products|catalog|\/c\/|\/s\b)/i.test(f.path + f.query)) s += 20;
      if (SHOP_HOST.test(f.host)) s += 20;
      if (c(f, 'images') >= 8) s += 10;
      if (f.flags.pagination) s += 10;
      return clamp(s);
    },
  },
  {
    id: 'e-commerce-checkout', label: 'Cart & checkout', group: 'shop', kind: 'checkout',
    score: (f) => {
      let s = 0;
      if (/\/(cart|checkout|basket|payment|order|bag)\b/i.test(f.path)) s += 45;
      if (/(shipping address|billing|checkout|payment method|order summary|কার্ট|চেকআউট|ডেলিভারি)/i.test(f.text)) s += 25;
      if (c(f, 'forms') && c(f, 'inputs') >= 3) s += 15;
      if (SHOP_HOST.test(f.host)) s += 10;
      return clamp(s);
    },
  },
  {
    id: 'blog-post', label: 'Blog post', group: 'content', kind: 'article',
    root: ['article', '.post-content', '.entry-content', '.post-body', '[itemprop="articleBody"]'],
    score: (f) => {
      let s = 0;
      if (J(f, 'blogposting')) s += 50;
      if (f.og === 'article') s += 15;
      if (f.flags.article) s += 10;
      if (BLOG_HOST.test(f.host)) s += 25;
      if (/\/\d{4}\/\d{2}\//.test(f.path) || /\/(blog|post|posts|archives?)\b/.test(f.path)) s += 10;
      if (c(f, 'paragraphs') >= 4) s += 5;
      if (f.flags.comments) s += 5;
      return clamp(s);
    },
  },
  {
    id: 'old-table-site', label: 'Legacy table layout', group: 'content', kind: 'table',
    score: (f) => {
      let s = c(f, 'layoutTables') * 15 + c(f, 'legacy') * 10;
      if (f.flags.article || f.flags.main) s -= 20;
      if (J(f, 'article', 'newsarticle', 'blogposting', 'product')) s -= 20;
      return clamp(Math.min(70, s));
    },
  },
  {
    id: 'wikipedia-article', label: 'Wiki article', group: 'content', kind: 'article',
    root: ['#mw-content-text', '.mw-parser-output', '#bodyContent'], drop: ['.navbox', '.mw-editsection', '.noprint', '.reflist', '#toc', '.sidebar', '.hatnote'],
    score: (f) => (/(^|\.)(wikipedia|wikimedia|wikiwand|fandom)\.(org|com)$/.test(f.host) ? (/\/wiki\//.test(f.path) ? 100 : 60) : 0),
  },
  {
    id: 'documentation', label: 'Documentation', group: 'content', kind: 'doc',
    root: ['main', 'article', '[role="main"]', '.markdown-body', '.documentation'],
    score: (f) => {
      let s = 0;
      if (DOC_HOST.test(f.host)) s += 35;
      if (c(f, 'codeBlocks') >= 2) s += 30;
      if (/\/(docs?|guide|reference|api|manual|tutorial)\b/i.test(f.path)) s += 25;
      if (c(f, 'headings') >= 4) s += 10;
      return clamp(s);
    },
  },
  {
    id: 'forum-thread', label: 'Forum thread', group: 'social', kind: 'thread', itemSelector: '.post, .message, .answer, .comment, li.post',
    score: (f) => {
      let s = 0;
      if (FORUM_HOST.test(f.host)) s += 30;
      if (/\/(thread|threads|topic|topics|viewtopic|t\/|questions?|discussion|showthread)/i.test(f.path)) s += 45;
      if (f.flags.comments) s += 10;
      if (c(f, 'textareas') >= 1) s += 5;
      return clamp(s);
    },
  },
  {
    id: 'login-page', label: 'Login page', group: 'form', kind: 'login',
    score: (f) => {
      let s = 0;
      if (c(f, 'passwords') >= 1 && c(f, 'inputs') <= 6) s += 70;
      if (/\/(log-?in|sign-?in|auth|account\/login|session)\b/i.test(f.path)) s += 25;
      if (c(f, 'forms') >= 1) s += 5;
      if (c(f, 'passwords') >= 2) s -= 20;
      if (c(f, 'paragraphs') > 20) s -= 20;
      return clamp(s);
    },
  },
  {
    id: 'search-results', label: 'Search results', group: 'content', kind: 'listing', itemSelector: '.g, .result, li.b_algo, .web-result, article',
    score: (f) => {
      let s = 0;
      if (/(^|\.)(google|bing|duckduckgo|yahoo|brave|ecosia|startpage)\.[a-z.]+$/.test(f.host) && /^\/(search|html|web)?\/?$/.test(f.path) && /[?&](q|p|query)=/.test(f.query)) s += 90;
      else if (/[?&](q|query|search|s|keyword)=/.test(f.query) && c(f, 'links') >= 20) s += 40;
      return clamp(s);
    },
  },
  {
    id: 'video-platform-other', label: 'Video platform', group: 'video', kind: 'video',
    score: (f) => {
      let s = 0;
      if (/(vimeo|dailymotion|twitch|bilibili|rumble|tiktok|netflix|hotstar|chorki|bongo)/.test(f.host)) s += 70;
      if (c(f, 'videos') >= 1) s += 20;
      if (YT(f)) s = 0;
      return clamp(s);
    },
  },
  {
    id: 'recipe', label: 'Recipe', group: 'content', kind: 'article', root: ['article', '.recipe', '[itemtype*="Recipe"]', 'main'],
    score: (f) => {
      let s = 0;
      if (J(f, 'recipe')) s += 80;
      if (/(ingredients|instructions|prep time|উপকরণ|পদ্ধতি|রেসিপি)/i.test(f.heads + ' ' + f.text.slice(0, 3000))) s += 20;
      return clamp(s);
    },
  },
  {
    id: 'job-listing', label: 'Job listing', group: 'content', kind: 'article', root: ['main', 'article', '.job-description', '[itemtype*="JobPosting"]'],
    score: (f) => {
      let s = 0;
      if (J(f, 'jobposting')) s += 80;
      if (/(apply now|job description|responsibilities|requirements|qualifications|চাকরি|আবেদনের শেষ)/i.test(f.heads + ' ' + f.text.slice(0, 3000))) s += 15;
      if (JOB_HOST.test(f.host) || /\/jobs?\//i.test(f.path)) s += 10;
      return clamp(s);
    },
  },
  {
    id: 'university-portal', label: 'University portal', group: 'gov', kind: 'form',
    score: (f) => {
      let s = 0;
      if (EDU_HOST.test(f.host)) s += 40;
      if (/(student|admission|course|semester|enrol|transcript|ভর্তি|শিক্ষার্থী|সেমিস্টার|কোর্স)/i.test(f.title + ' ' + f.h1 + ' ' + f.heads + ' ' + f.path)) s += 25;
      if (c(f, 'forms') && c(f, 'inputs') >= 2) s += 15;
      if (c(f, 'dataTables') >= 1) s += 10;
      if (c(f, 'passwords') >= 1) s += 5;
      return clamp(s);
    },
  },
];

/** Fallback used when nothing scores high enough (counts as the 31st, not one of the 30). */
export const GENERIC = Object.freeze({ id: 'generic', label: 'Generic page', group: 'content', kind: 'article', root: [], drop: [] });

export const MIN_SCORE = 40;

export function getCategory(id) {
  return CATEGORIES.find((x) => x.id === id) || (id === 'generic' ? GENERIC : null);
}
