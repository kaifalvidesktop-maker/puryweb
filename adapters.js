// PuryWeb — content/adapters.js
// Site-specific extractors for SPAs whose DOM is made of custom elements.
// An adapter returns an array of blocks, or null to fall back to the generic extractor.

import { cleanText, textOf, truncate, absUrl } from './dom-utils.js';

const first = (root, sel) => {
  for (const s of sel.split('|')) {
    const el = root.querySelector(s.trim());
    if (el) return el;
  }
  return null;
};
const txt = (root, sel) => {
  const el = first(root, sel);
  return el ? cleanText(el.textContent) : '';
};

function youtubeWatch(doc, loc) {
  const title = txt(doc, 'h1.ytd-watch-metadata yt-formatted-string|#title h1|h1.title');
  if (!title) return null;
  const channel = txt(doc, '#owner #channel-name a|ytd-channel-name a|#upload-info a');
  const info = txt(doc, '#info-container #info|#info-strings|ytd-watch-info-text #info');
  const desc = txt(doc, '#description-inner #snippet-text|ytd-text-inline-expander #snippet-text|#description-inner|#description');

  const blocks = [];
  let vid = '';
  try {
    vid = new URL(loc.href).searchParams.get('v') || '';
  } catch {
    /* ignore */
  }
  blocks.push({ type: 'video', platform: 'youtube', videoId: vid, src: loc.href, title });
  blocks.push({ type: 'heading', level: 1, text: title });
  const kv = [];
  if (channel) kv.push({ k: 'Channel', v: channel });
  if (info) kv.push({ k: 'Info', v: truncate(info, 120) });
  if (kv.length) blocks.push({ type: 'kv', items: kv });
  if (desc) blocks.push({ type: 'paragraph', text: truncate(desc, 1800) });

  const comments = [];
  for (const th of Array.from(doc.querySelectorAll('ytd-comment-thread-renderer')).slice(0, 50)) {
    const text = txt(th, '#content-text');
    if (!text) continue;
    comments.push({
      author: txt(th, '#author-text'),
      text: truncate(text, 600),
      likes: txt(th, '#vote-count-middle'),
      time: txt(th, '.published-time-text a|#published-time-text a'),
    });
  }
  if (comments.length) blocks.push({ type: 'comments', items: comments });
  return blocks;
}

export const ADAPTERS = {
  'youtube-watch': youtubeWatch,
};

/** Card builder that honours per-site field selectors (profile.cardFields). */
export function cardWithFields(el, fields, base) {
  const title = txt(el, fields.title || '') || '';
  const channel = fields.channel ? txt(el, fields.channel) : '';
  const metaEls = fields.meta ? Array.from(el.querySelectorAll(fields.meta)) : [];
  const meta = metaEls.map((m) => cleanText(m.textContent)).filter(Boolean).slice(0, 4);
  const link = fields.href ? first(el, fields.href) : el.querySelector('a[href]');
  const href = link ? absUrl(link.getAttribute('href'), base) : '';
  const img = el.querySelector('img');
  const image = img ? img.getAttribute('src') || img.getAttribute('data-src') || '' : '';
  if (!title && !image) return null;
  const card = { title: title || textOf(el).slice(0, 100), href };
  if (channel) card.channel = channel;
  if (meta.length) card.meta = meta;
  if (image && !image.startsWith('data:')) card.image = absUrl(image, base);
  if (/\/shorts\//.test(href)) card.tag = 'short';
  return card;
}
