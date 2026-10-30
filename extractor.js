// PuryWeb — content/extractor.js
// Turns a page into a clean, bounded block model (headings, paragraphs, lists, tables, cards, forms).
// The model — never raw HTML — is what the AI sees and what Phase 6 templates render.

import {
  resetRegistry, register, cleanText, textOf, truncate, isVisible, noiseToken, linkDensity, isLayoutTable,
  absUrl, pickSrc, num, quickHidden, SKIP_TAGS, INLINE_TAGS, cssPath,
} from './dom-utils.js';
import { extractForms } from './form-extractor.js';
import { ADAPTERS, cardWithFields } from './adapters.js';

const LIMITS = { blocks: 400, chars: 60000, images: 30, cards: 80, rows: 60, cols: 12, listItems: 60 };
const CHROME_TAGS = new Set(['NAV', 'FOOTER', 'ASIDE']);
const CHROME_ROLES = /^(navigation|complementary|contentinfo|dialog|alertdialog|search)$/i;
const BLOCK_SEL = 'p,div,ul,ol,table,h1,h2,h3,h4,h5,h6,img,form,section,article,li,blockquote,pre,figure,video';
const PRICE_RE = /(?:৳|\btk\.?|\bbdt|\$|€|£|₹|\brs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:৳|\btk\b|\bbdt\b)/i;
const EMBED_RE = /(youtube\.com\/embed|youtube-nocookie|youtu\.be|player\.vimeo|dailymotion\.com\/embed|facebook\.com\/plugins\/video)/i;
const SEM_ROOTS = ['article', '[role="main"]', 'main', '[itemprop="articleBody"]', '#main-content', '#content', '#main',
  '.post-content', '.entry-content', '.article-body', '.article-content', '.story-body'];

/* ---------------- meta ---------------- */
function readMeta(doc, loc) {
  const m = (sel) => doc.querySelector(sel)?.getAttribute('content') || '';
  return {
    title: cleanText(doc.title) || cleanText(doc.querySelector('h1')?.textContent),
    description: truncate(cleanText(m('meta[name="description"]') || m('meta[property="og:description"]')), 300),
    image: absUrl(m('meta[property="og:image"]'), doc.baseURI || loc.href),
    site: cleanText(m('meta[property="og:site_name"]')) || String(loc.hostname || '').replace(/^www\./, ''),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    published: m('meta[property="article:published_time"]') || doc.querySelector('time[datetime]')?.getAttribute('datetime') || '',
    author: cleanText(m('meta[name="author"]') || doc.querySelector('[rel="author"], [itemprop="author"], .byline')?.textContent || ''),
    lang: doc.documentElement.lang || '',
  };
}

function readNav(doc, base) {
  const seen = new Set();
  const out = [];
  for (const a of doc.querySelectorAll('nav a[href], [role="navigation"] a[href]')) {
    const text = textOf(a);
    const href = absUrl(a.getAttribute('href'), base);
    if (!text || text.length > 60 || !href || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, href });
    if (out.length >= 30) break;
  }
  return out;
}

/* ---------------- root selection ---------------- */
const textLen = (el) => (el.textContent || '').length;

function pickRoot(doc, profile) {
  for (const sel of profile.root || []) {
    let el = null;
    try {
      el = doc.querySelector(sel);
    } catch {
      /* invalid selector */
    }
    if (el && isVisible(el) && textLen(el) > 40) return { el, by: 'profile' };
  }
  let best = null;
  let bestScore = 0;
  for (const sel of SEM_ROOTS) {
    for (const el of doc.querySelectorAll(sel)) {
      if (!isVisible(el)) continue;
      const score = textLen(el) * (1 - linkDensity(el));
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
  }
  if (best && bestScore > 200) return { el: best, by: 'semantic' };

  const scores = new Map();
  const add = (el, s) => el && scores.set(el, (scores.get(el) || 0) + s);
  for (const p of Array.from(doc.querySelectorAll('p, pre, td')).slice(0, 1500)) {
    const tx = cleanText(p.textContent);
    if (tx.length < 25) continue;
    const s = 1 + (tx.split(/[,،।]/).length - 1) + Math.min(Math.floor(tx.length / 100), 3);
    add(p.parentElement, s);
    add(p.parentElement && p.parentElement.parentElement, s / 2);
  }
  let top = null;
  let topScore = 0;
  for (const [el, s] of scores) {
    const adj = s * (1 - linkDensity(el));
    if (adj > topScore) {
      top = el;
      topScore = adj;
    }
  }
  if (top && topScore > 6) return { el: top, by: 'paragraphs' };
  return { el: best || doc.body, by: 'body' };
}

/* ---------------- cards (feeds, listings, homepages) ---------------- */
function cardFrom(el, base, profile) {
  if (profile.cardFields) {
    const c = cardWithFields(el, profile.cardFields, base);
    if (c) c.id = register(el, 'c');
    return c;
  }
  const links = Array.from(el.querySelectorAll('a[href]')).filter((a) => absUrl(a.getAttribute('href'), base));
  const heading = el.querySelector('h1,h2,h3,h4,h5,[class*="title" i],[id*="title" i]');
  let title = heading ? textOf(heading) : '';
  let a = heading ? heading.closest('a') || heading.querySelector('a') : null;
  if (!a) a = links.slice().sort((x, y) => (y.textContent || '').length - (x.textContent || '').length)[0] || null;
  if (!title && a) title = textOf(a);
  const img = Array.from(el.querySelectorAll('img')).find((i) => {
    const w = num(i.getAttribute('width'));
    return pickSrc(i) && (!w || w >= 64);
  });

  const metas = [];
  const seen = new Set([title.toLowerCase()]);
  const walker = el.ownerDocument.createTreeWalker(el, 4);
  for (let n = walker.nextNode(); n && metas.length < 6; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || quickHidden(p)) continue;
    const t = cleanText(n.nodeValue);
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    metas.push(truncate(t, 120));
  }
  if (!title && !img) return null;
  const card = { id: register(el, 'c'), title: truncate(title || metas.shift() || '', 200) };
  if (a) card.href = absUrl(a.getAttribute('href'), base);
  if (img) card.image = absUrl(pickSrc(img), base);
  const price = metas.find((m) => PRICE_RE.test(m));
  if (price) card.price = price;
  const rest = metas.filter((m) => m !== price);
  if (rest.length) card.meta = rest.slice(0, 4);
  if (card.href && /\/shorts\//.test(card.href)) card.tag = 'short';
  return card;
}

function findRepeated(root) {
  let best = [];
  let bestScore = 0;
  const parents = [root, ...Array.from(root.querySelectorAll('ul,ol,div,section,main,tbody')).slice(0, 800)];
  for (const p of parents) {
    const kids = Array.from(p.children);
    if (kids.length < 4 || p.closest('nav,footer,header,aside')) continue;
    const groups = new Map();
    for (const k of kids) {
      const sig = k.tagName + '.' + (k.classList[0] || '');
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(k);
    }
    for (const g of groups.values()) {
      if (g.length < 4) continue;
      const good = g.filter((k) => !noiseToken(k) && k.querySelector('a[href]') && (k.textContent || '').trim().length >= 12);
      if (good.length < 4) continue;
      const total = good.reduce((n, k) => n + Math.min(400, (k.textContent || '').length), 0);
      const score = good.length + total / 2000;
      if (score > bestScore) {
        best = good;
        bestScore = score;
      }
    }
  }
  return best;
}

function extractCards(root, doc, base, profile) {
  let els = [];
  if (profile.itemSelector) {
    try {
      els = Array.from(root.querySelectorAll(profile.itemSelector));
    } catch {
      els = [];
    }
    els = els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
  }
  if (els.length < 3) els = Array.from(root.querySelectorAll('[role="article"]'));
  if (els.length < 3) els = findRepeated(root);
  const cards = [];
  const seenTitles = new Set();
  for (const el of els) {
    if (cards.length >= LIMITS.cards) break;
    if (quickHidden(el) || !isVisible(el)) continue;
    const c = cardFrom(el, base, profile);
    if (!c || !c.title || seenTitles.has(c.title)) continue;
    seenTitles.add(c.title);
    cards.push(c);
  }
  return cards;
}

/* ---------------- block walker ---------------- */
function makeCtx(profile, base, formIdOf) {
  const dropSel = (profile.drop || []).join(',');
  return {
    base, formIdOf, blocks: [], buf: '', links: [], chars: 0, images: 0, full: false, truncated: false,
    dropped: 0, seen: new Set(), lastHeading: '',
    drops(el) {
      if (!dropSel) return false;
      try {
        return el.matches(dropSel);
      } catch {
        return false;
      }
    },
  };
}

function push(ctx, block, el) {
  if (ctx.blocks.length >= LIMITS.blocks || ctx.chars >= LIMITS.chars) {
    ctx.full = true;
    ctx.truncated = true;
    return;
  }
  block.id = 'b' + (ctx.blocks.length + 1);
  if (el) block.ref = register(el, 'r');
  ctx.chars += JSON.stringify(block).length;
  ctx.blocks.push(block);
}

function flush(ctx) {
  const text = cleanText(ctx.buf);
  const links = ctx.links;
  ctx.buf = '';
  ctx.links = [];
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
  const key = text.toLowerCase();
  if (text.length >= 24) {
    if (ctx.seen.has(key)) return;
    ctx.seen.add(key);
  }
  const b = { type: 'paragraph', text: truncate(text, 2000) };
  if (links.length) b.links = links.slice(0, 6);
  push(ctx, b);
}

function hasBlock(el) {
  return !!el.querySelector(BLOCK_SEL);
}

function isChrome(el) {
  const tag = el.tagName.toUpperCase();
  if (CHROME_TAGS.has(tag)) return true;
  if (tag === 'HEADER') return !el.closest('article, main') && !el.querySelector('h1, h2');
  const role = el.getAttribute('role');
  if (role && CHROME_ROLES.test(role)) return true;
  if (role === 'banner') return !el.querySelector('h1');
  return el.getAttribute('aria-modal') === 'true';
}

function addInline(ctx, el) {
  const text = textOf(el);
  if (!text) return;
  ctx.buf += ' ' + text + ' ';
  if (el.tagName.toUpperCase() === 'A') {
    const href = absUrl(el.getAttribute('href'), ctx.base);
    if (href) ctx.links.push({ text: truncate(text, 80), href });
  }
}

function handleList(el, ctx) {
  const items = [];
  const collect = (list, level) => {
    for (const li of list.children) {
      if (li.tagName.toUpperCase() !== 'LI' || quickHidden(li) || items.length >= LIMITS.listItems) continue;
      const text = textOf(li, new Set(['UL', 'OL']));
      const a = Array.from(li.querySelectorAll('a[href]')).find((x) => x.closest('li') === li);
      const href = a ? absUrl(a.getAttribute('href'), ctx.base) : '';
      if (text) items.push(href ? { text: truncate(text, 200), href, level } : { text: truncate(text, 200), level });
      if (level < 2) for (const sub of li.children) if (/^(UL|OL)$/i.test(sub.tagName)) collect(sub, level + 1);
    }
  };
  collect(el, 0);
  if (!items.length) return;
  flush(ctx);
  const linked = items.filter((i) => i.href).length;
  if (items.length >= 5 && linked / items.length > 0.8) {
    push(ctx, { type: 'link-group', title: ctx.lastHeading, links: items.slice(0, 40).map((i) => ({ text: i.text, href: i.href })) }, el);
  } else {
    push(ctx, { type: 'list', ordered: el.tagName.toUpperCase() === 'OL', items }, el);
  }
}

function handleTable(el, ctx, depth) {
  if (isLayoutTable(el)) {
    for (const tr of Array.from(el.rows || []).slice(0, 200)) {
      for (const td of tr.children) {
        flush(ctx);
        walk(td, ctx, depth + 1);
        flush(ctx);
      }
    }
    return;
  }
  flush(ctx);
  const rows = Array.from(el.rows || []);
  if (!rows.length) return;
  const cell = (td) => {
    const text = truncate(textOf(td), 200);
    const a = td.querySelector('a[href]');
    const href = a ? absUrl(a.getAttribute('href'), ctx.base) : '';
    return href ? { text, href } : text;
  };
  let headers = [];
  let start = 0;
  const firstCells = Array.from(rows[0].cells);
  if (firstCells.length && (firstCells.every((c) => c.tagName.toUpperCase() === 'TH') || el.tHead)) {
    headers = firstCells.slice(0, LIMITS.cols).map((c) => textOf(c));
    start = 1;
  }
  const body = rows.slice(start, start + LIMITS.rows).map((r) => Array.from(r.cells).slice(0, LIMITS.cols).map(cell));
  const block = { type: 'table', headers, rows: body };
  const cap = el.caption ? textOf(el.caption) : '';
  if (cap) block.caption = cap;
  if (rows.length - start > LIMITS.rows) block.truncated = true;
  push(ctx, block, el);
}

function handleImage(img, ctx, caption = '') {
  if (ctx.images >= LIMITS.images) return;
  const src = pickSrc(img);
  if (!src || /pixel|spacer|blank|tracking|1x1|sprite/i.test(src)) return;
  const w = num(img.getAttribute('width')) || img.naturalWidth || 0;
  const h = num(img.getAttribute('height')) || img.naturalHeight || 0;
  if ((w && w < 64) || (h && h < 64)) return;
  const abs = absUrl(src, ctx.base);
  if (!abs) return;
  flush(ctx);
  ctx.images++;
  const block = { type: 'image', src: abs, alt: truncate(cleanText(img.getAttribute('alt') || ''), 200) };
  if (w) block.w = w;
  if (h) block.h = h;
  if (caption) block.caption = truncate(caption, 240);
  push(ctx, block, img);
}

function handleMedia(el, ctx) {
  const tag = el.tagName.toUpperCase();
  if (tag === 'VIDEO') {
    const src = el.getAttribute('src') || el.querySelector('source[src]')?.getAttribute('src') || '';
    flush(ctx);
    push(ctx, { type: 'video', src: absUrl(src, ctx.base), poster: absUrl(el.getAttribute('poster'), ctx.base) }, el);
  } else if (tag === 'IFRAME') {
    const src = el.getAttribute('src') || '';
    if (EMBED_RE.test(src)) {
      flush(ctx);
      push(ctx, { type: 'video', embed: true, src: absUrl(src, ctx.base), title: el.getAttribute('title') || '' }, el);
    }
  }
}

function handleDl(el, ctx) {
  const items = [];
  let key = '';
  for (const c of el.children) {
    const t = c.tagName.toUpperCase();
    if (t === 'DT') key = textOf(c);
    else if (t === 'DD' && key) {
      const v = textOf(c);
      if (v) items.push({ k: truncate(key, 80), v: truncate(v, 300) });
    }
  }
  if (items.length) {
    flush(ctx);
    push(ctx, { type: 'kv', items: items.slice(0, 60) }, el);
  }
}

function walk(parent, ctx, depth) {
  for (const n of parent.childNodes) {
    if (ctx.full) return;
    if (n.nodeType === 3) ctx.buf += n.nodeValue;
    else if (n.nodeType === 1) visit(n, ctx, depth);
  }
}

function visit(el, ctx, depth) {
  if (ctx.full || depth > 40) return;
  const tag = el.tagName.toUpperCase();
  if (tag === 'VIDEO' || tag === 'IFRAME') return handleMedia(el, ctx);
  if (SKIP_TAGS.has(tag)) return;
  if (tag === 'LABEL' && (el.hasAttribute('for') || el.querySelector('input,select,textarea'))) return;
  if (quickHidden(el) || !isVisible(el)) return;
  if (ctx.drops(el) || isChrome(el) || (noiseToken(el) && !el.querySelector('h1'))) {
    ctx.dropped++;
    return;
  }

  switch (tag) {
    case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
      flush(ctx);
      const text = textOf(el);
      if (text) {
        ctx.lastHeading = truncate(text, 120);
        push(ctx, { type: 'heading', level: +tag[1], text: truncate(text, 240) }, el);
      }
      return;
    }
    case 'P': {
      flush(ctx);
      addInline(ctx, el);
      flush(ctx);
      return;
    }
    case 'UL': case 'OL':
      return handleList(el, ctx);
    case 'DL':
      return handleDl(el, ctx);
    case 'TABLE':
      return handleTable(el, ctx, depth);
    case 'IMG':
      return handleImage(el, ctx);
    case 'PICTURE': {
      const img = el.querySelector('img');
      if (img) handleImage(img, ctx);
      return;
    }
    case 'FIGURE': {
      const img = el.querySelector('img');
      const cap = el.querySelector('figcaption');
      if (img) handleImage(img, ctx, cap ? textOf(cap) : '');
      else walk(el, ctx, depth + 1);
      return;
    }
    case 'BLOCKQUOTE': {
      flush(ctx);
      const text = textOf(el);
      if (text) push(ctx, { type: 'quote', text: truncate(text, 1200) }, el);
      return;
    }
    case 'PRE': {
      flush(ctx);
      const text = (el.textContent || '').replace(/\s+$/, '');
      if (text.trim()) push(ctx, { type: 'code', text: truncate(text, 2000) }, el);
      return;
    }
    case 'FORM': {
      flush(ctx);
      const fid = ctx.formIdOf.get(el);
      if (fid && !isWrapper(el)) push(ctx, { type: 'form', formId: fid }, el);
      else if (fid) {
        walk(el, ctx, depth + 1);
        flush(ctx);
      }
      return;
    }
    case 'HR':
      return flush(ctx);
    case 'BR':
      ctx.buf += ' ';
      return;
    default:
      break;
  }

  if (INLINE_TAGS.has(tag) && !hasBlock(el)) return addInline(ctx, el);
  flush(ctx);
  walk(el, ctx, depth + 1);
  flush(ctx);
}

function isWrapper(formEl) {
  const n = formEl.querySelectorAll('input:not([type=hidden]), select, textarea').length;
  const len = (formEl.textContent || '').length;
  return (!!formEl.querySelector('input[name="__VIEWSTATE"]') && len > 1500) ||
    (!!formEl.querySelector('header, nav, footer, h1') && n < 40) || (len > 2500 && n <= 25);
}

/* ---------------- public API ---------------- */
export function extractPage(doc, loc, detection, opts = {}) {
  resetRegistry();
  const profile = detection.profile || {};
  const base = doc.baseURI || loc.href;
  const meta = readMeta(doc, loc);
  const { forms, byEl } = extractForms(doc, base);
  const rootInfo = pickRoot(doc, profile);
  const ctx = makeCtx(profile, base, byEl);

  let blocks = null;
  let by = rootInfo.by;
  const adapter = profile.adapter && ADAPTERS[profile.adapter];
  if (adapter) {
    try {
      const out = adapter(doc, loc);
      if (out && out.length) {
        blocks = out.map((b, i) => ({ ...b, id: 'b' + (i + 1) }));
        by = 'adapter';
      }
    } catch (e) {
      blocks = null;
    }
  }

  if (!blocks && ['feed', 'listing', 'home'].includes(detection.kind || profile.kind)) {
    const cards = extractCards(rootInfo.el, doc, base, profile);
    if (cards.length >= 3) {
      const h1 = cleanText(doc.querySelector('h1')?.textContent) || meta.title;
      blocks = [
        { id: 'b1', type: 'heading', level: 1, text: truncate(h1, 200) },
        { id: 'b2', type: 'cards', items: cards },
      ];
      by = 'cards';
    }
  }

  if (!blocks) {
    walk(rootInfo.el, ctx, 0);
    flush(ctx);
    blocks = ctx.blocks;
    if (!blocks.length) {
      const text = textOf(rootInfo.el);
      if (text) blocks = [{ id: 'b1', type: 'paragraph', text: truncate(text, 4000) }];
    }
  }

  return {
    v: 1,
    url: loc.href,
    host: String(loc.hostname || '').replace(/^www\./, ''),
    meta,
    category: { id: detection.id, label: detection.label, kind: detection.kind, confidence: detection.confidence },
    nav: readNav(doc, base),
    blocks,
    forms,
    stats: {
      blocks: blocks.length,
      forms: forms.length,
      chars: ctx.chars,
      truncated: ctx.truncated,
      dropped: ctx.dropped,
      root: rootInfo.el ? cssPath(rootInfo.el) : '',
      by,
      userExtra: opts.note || '',
    },
  };
}

/* ---------------- AI payload (token-lean, no selectors/refs) ---------------- */
const DROP_KEYS = new Set(['ref', 'w', 'h', 'selector', 'xpath']);

function slim(o) {
  if (Array.isArray(o)) return o.map(slim);
  if (!o || typeof o !== 'object') return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (DROP_KEYS.has(k) || v === '' || v === null || v === false || (Array.isArray(v) && !v.length)) continue;
    out[k] = slim(v);
  }
  return out;
}

function compactForm(f) {
  return {
    id: f.id,
    title: f.title,
    fields: f.fields.map((x) => {
      const o = { id: x.id, kind: x.kind, label: x.label, required: x.required, section: x.section, hint: x.hint, placeholder: x.placeholder };
      if (x.options && x.kind !== 'checkbox') {
        o.optionCount = x.options.length;
        o.optionSample = x.options.slice(0, 6).map((p) => p.label);
      }
      return o;
    }),
    actions: f.actions.map((a) => ({ id: a.id, label: a.label, primary: a.primary })),
  };
}

export function compactForAI(model, maxChars = 24000) {
  const out = slim({
    page: { url: model.url, title: model.meta.title, lang: model.meta.lang, site: model.meta.site, description: model.meta.description },
    category: model.category.id,
    blocks: model.blocks,
    forms: model.forms.map(compactForm),
    nav: model.nav.slice(0, 20),
  });
  let cut = false;
  while (JSON.stringify(out).length > maxChars && out.blocks.length > 3) {
    out.blocks.length = Math.max(3, Math.floor(out.blocks.length * 0.85));
    cut = true;
  }
  if (cut) out.truncated = true;
  return out;
}
