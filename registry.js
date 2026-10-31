// PuryWeb — templates/registry.js
// Maps each of the 30 categories (+ generic) to a template family and its look.
// tone: warm (orange) | cool (violet) | neutral. cols: card columns. width: reading width.

import { FAMILIES, WIDTH } from './families.js';

const C = (family, tone, width, cols = 2) => ({ family, tone, width, cols });

export const TEMPLATE_MAP = {
  'youtube-watch': C('video', 'warm', 'wide'),
  'youtube-home': C('grid', 'warm', 'full', 3),
  'youtube-search': C('grid', 'warm', 'wide', 1),
  'youtube-shorts': C('video', 'warm', 'narrow'),
  'facebook-feed': C('grid', 'cool', 'normal', 1),
  'facebook-post': C('thread', 'cool', 'normal'),
  'instagram-feed': C('grid', 'warm', 'normal', 1),
  'twitter-feed': C('grid', 'neutral', 'normal', 1),
  'reddit-thread': C('thread', 'warm', 'normal'),
  'linkedin-feed': C('grid', 'cool', 'normal', 1),
  'gov-form': C('form', 'cool', 'normal'),
  'gov-notice': C('notice', 'cool', 'normal'),
  'gov-result': C('result', 'cool', 'wide'),
  'gov-portal-home': C('home', 'cool', 'full', 3),
  'news-article': C('article', 'neutral', 'normal'),
  'news-home': C('grid', 'neutral', 'full', 3),
  'e-commerce-product': C('product', 'warm', 'full'),
  'e-commerce-listing': C('grid', 'warm', 'full', 3),
  'e-commerce-checkout': C('form', 'warm', 'normal'),
  'blog-post': C('article', 'warm', 'normal'),
  'old-table-site': C('article', 'neutral', 'wide'),
  'wikipedia-article': C('article', 'neutral', 'wide'),
  documentation: C('article', 'cool', 'wide'),
  'forum-thread': C('thread', 'neutral', 'normal'),
  'login-page': C('login', 'cool', 'narrow'),
  'search-results': C('grid', 'neutral', 'wide', 1),
  'video-platform-other': C('video', 'warm', 'wide'),
  recipe: C('article', 'warm', 'normal'),
  'job-listing': C('article', 'cool', 'normal'),
  'university-portal': C('form', 'cool', 'wide'),
  generic: C('article', 'neutral', 'normal'),
};

export function pickTemplate(categoryId) {
  const cfg = TEMPLATE_MAP[categoryId] || TEMPLATE_MAP.generic;
  // kind=login pages and forms share data, so a login-like form on any category still renders safely.
  return { cfg, render: FAMILIES[cfg.family] || FAMILIES.article, widthClass: WIDTH[cfg.width] || WIDTH.normal };
}
