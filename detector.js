// PuryWeb — content/detector.js
// Collects cheap page features once, then scores all 30 categories.

import { CATEGORIES, GENERIC, MIN_SCORE, getCategory } from './categories.js';
import { cleanText, isLayoutTable } from './dom-utils.js';

const TEXT_CAP = 60000;
const PRICE_RE = /(?:৳|\btk\.?|\bbdt|\$|€|£|₹|\brs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:৳|\btk\b|\bbdt\b)/gi;
const NO_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
const CTRL = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea';

function readText(doc) {
  const root = doc.body || doc.documentElement;
  const parts = [];
  let len = 0;
  const walker = doc.createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n && len < TEXT_CAP; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || NO_TEXT.has(p.tagName.toUpperCase())) continue;
    const v = n.nodeValue;
    if (!v || !v.trim()) continue;
    parts.push(v);
    len += v.length;
  }
  return cleanText(parts.join(' '));
}

function collectTypes(node, out, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out, depth + 1));
  if (typeof node !== 'object') return;
  const t = node['@type'];
  if (t) (Array.isArray(t) ? t : [t]).forEach((x) => out.add(String(x).toLowerCase()));
  for (const k of Object.keys(node)) if (node[k] && typeof node[k] === 'object') collectTypes(node[k], out, depth + 1);
}

function readJsonLd(doc) {
  const out = new Set();
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0, 12)) {
    try {
      collectTypes(JSON.parse(s.textContent || ''), out);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

const q = (doc, sel) => doc.querySelectorAll(sel).length;
const meta = (doc, sel) => doc.querySelector(sel)?.getAttribute('content') || '';

export function collectFeatures(doc, loc) {
  const text = readText(doc);
  const headEls = Array.from(doc.querySelectorAll('h1,h2,h3')).slice(0, 40);
  const tables = Array.from(doc.querySelectorAll('table')).slice(0, 80);
  let layoutTables = 0;
  let dataTables = 0;
  for (const t of tables) {
    if (isLayoutTable(t)) layoutTables++;
    else if ((t.rows ? t.rows.length : 0) >= 3) dataTables++;
  }
  const prices = (text.slice(0, 20000).match(PRICE_RE) || []).length;
  const textInputs = q(doc, 'input:not([type]), input[type=text], input[type=email], input[type=tel], input[type=number], input[type=date], input[type=search], input[type=url]');
  const words = text ? text.split(' ').length : 0;
  const linkLen = Array.from(doc.querySelectorAll('a')).slice(0, 600).reduce((n, a) => n + (a.textContent || '').length, 0);

  return {
    host: String(loc.hostname || '').toLowerCase().replace(/^www\./, ''),
    path: String(loc.pathname || '/'),
    query: String(loc.search || ''),
    title: cleanText(doc.title),
    h1: cleanText(doc.querySelector('h1')?.textContent),
    heads: headEls.map((h) => cleanText(h.textContent)).join(' | ').slice(0, 1500),
    text: text.slice(0, 6000),
    words,
    linkDensity: text.length ? Math.min(1, linkLen / text.length) : 0,
    lang: doc.documentElement.lang || '',
    og: (meta(doc, 'meta[property="og:type"]') || '').toLowerCase(),
    jsonld: readJsonLd(doc),
    counts: {
      forms: q(doc, 'form'),
      inputs: q(doc, CTRL),
      textInputs,
      selects: q(doc, 'select'),
      textareas: q(doc, 'textarea'),
      passwords: q(doc, 'input[type=password]'),
      tables: tables.length,
      layoutTables,
      dataTables,
      images: q(doc, 'img'),
      links: q(doc, 'a[href]'),
      paragraphs: q(doc, 'p'),
      videos: q(doc, 'video, iframe[src*="youtube"], iframe[src*="vimeo"]'),
      roleArticles: q(doc, '[role="article"]'),
      legacy: q(doc, 'font, center, marquee, frameset, frame, blink, big, strike'),
      headingLinks: q(doc, 'h1 a[href], h2 a[href], h3 a[href], h4 a[href]'),
      pdfLinks: Array.from(doc.querySelectorAll('a[href]')).filter((a) => /\.pdf(\?|#|$)/i.test(a.getAttribute('href') || '')).length,
      codeBlocks: q(doc, 'pre code, pre.highlight, .highlight pre'),
      headings: q(doc, 'h1,h2,h3,h4'),
      prices,
    },
    flags: {
      article: !!doc.querySelector('article'),
      main: !!doc.querySelector('main, [role="main"]'),
      time: !!doc.querySelector('time[datetime], [itemprop="datePublished"]'),
      byline: !!doc.querySelector('[rel="author"], [itemprop="author"], .byline, .author, [class*="byline" i]'),
      cart: !!doc.querySelector('[class*="add-to-cart" i], [id*="add-to-cart" i], [name="add-to-cart"], button[name="add"]') ||
        /(add to cart|buy now|কার্টে যোগ|এখনই কিনুন|অর্ডার করুন)/i.test(text.slice(0, 8000)),
      captcha: !!doc.querySelector('.g-recaptcha, iframe[src*="recaptcha"], [class*="captcha" i], img[src*="captcha" i], input[name*="captcha" i]'),
      comments: !!doc.querySelector('#comments, .comments, [id*="comment" i], [class*="comment-list" i], ytd-comments'),
      pagination: !!doc.querySelector('.pagination, [class*="pagination" i], a[rel="next"], nav[aria-label*="pagination" i]'),
      rollInput: !!doc.querySelector('input[name*="roll" i], input[id*="roll" i], input[placeholder*="roll" i], input[name*="regi" i], input[placeholder*="রোল"]'),
    },
  };
}

/**
 * Detect the page category.
 * @returns {{id,label,group,kind,profile,confidence,runnerUp,scores,features}}
 */
export function detectCategory(doc, loc, { forceId = null, features = null } = {}) {
  const f = features || collectFeatures(doc, loc);
  const scored = CATEGORIES.map((cat) => {
    let score = 0;
    try {
      score = cat.score(f) || 0;
    } catch {
      score = 0;
    }
    return { id: cat.id, score };
  }).sort((a, b) => b.score - a.score);

  const forced = forceId ? getCategory(forceId) : null;
  const best = scored[0];
  const second = scored[1];
  let cat;
  let confidence;
  if (forced) {
    cat = forced;
    confidence = 1;
  } else if (best.score >= MIN_SCORE) {
    cat = getCategory(best.id);
    const margin = best.score ? (best.score - second.score) / best.score : 0;
    confidence = Math.round((best.score / 100) * (0.7 + 0.3 * margin) * 100) / 100;
  } else {
    cat = GENERIC;
    confidence = Math.round((best.score / 100) * 100) / 100;
  }

  return {
    id: cat.id,
    label: cat.label,
    group: cat.group,
    kind: cat.kind,
    profile: cat,
    confidence,
    runnerUp: second && second.score >= MIN_SCORE ? second : null,
    scores: scored.slice(0, 5),
    features: f,
  };
}
