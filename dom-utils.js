// PuryWeb — content/dom-utils.js
// DOM helpers shared by detector / extractor / form-extractor (and the Phase 7 proxy engine).

const REG = (globalThis.__PW_REGISTRY__ ||= new Map());
const ids = new WeakMap();
let seq = 0;

/* ---------- element registry: id <-> live element ---------- */
export function resetRegistry() {
  REG.clear();
  seq = 0;
}
export function register(el, prefix = 'n') {
  const cur = ids.get(el);
  if (cur && REG.get(cur) === el) return cur;
  const id = prefix + ++seq;
  ids.set(el, id);
  REG.set(id, el);
  return id;
}
export const lookup = (id) => REG.get(id) || null;

/* ---------- text ---------- */
export const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'LINK', 'META', 'HEAD', 'OBJECT', 'EMBED',
  'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'OPTION', 'OPTGROUP', 'DATALIST', 'MAP', 'AREA', 'AUDIO', 'VIDEO', 'IFRAME',
]);
export const INLINE_TAGS = new Set([
  'A', 'SPAN', 'B', 'I', 'STRONG', 'EM', 'SMALL', 'SUP', 'SUB', 'U', 'MARK', 'ABBR', 'TIME', 'CODE', 'CITE', 'Q',
  'S', 'DEL', 'INS', 'FONT', 'LABEL', 'BDI', 'BDO', 'KBD', 'VAR', 'SAMP', 'BIG', 'TT',
]);
const HIDDEN_CLS = /(^|\s)(sr-only|visually-hidden|screen-reader-text|hidden|d-none|hide|invisible)(\s|$)/i;

export const cleanText = (s) => String(s ?? '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
export const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function quickHidden(el) {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
  const st = el.style;
  if (st && (st.display === 'none' || st.visibility === 'hidden')) return true;
  return HIDDEN_CLS.test(el.getAttribute('class') || '');
}

/** Visible text of an element without form controls / scripts. Optional extra tags to skip. */
export function inlineText(el, out = [], skip = null) {
  for (const n of el.childNodes) {
    if (n.nodeType === 3) {
      out.push(n.nodeValue);
    } else if (n.nodeType === 1) {
      const t = n.tagName.toUpperCase();
      if (SKIP_TAGS.has(t) || (skip && skip.has(t)) || quickHidden(n)) continue;
      if (t === 'BR') {
        out.push(' ');
        continue;
      }
      inlineText(n, out, skip);
      if (!INLINE_TAGS.has(t)) out.push(' ');
    }
  }
  return out;
}
export const textOf = (el, skip = null) => cleanText(inlineText(el, [], skip).join(''));

/* ---------- visibility ---------- */
const layoutCache = new WeakMap();
function hasLayout(doc) {
  if (!layoutCache.has(doc)) {
    const b = doc.body;
    layoutCache.set(doc, !!(b && b.getClientRects && b.getClientRects().length));
  }
  return layoutCache.get(doc);
}

export function isVisible(el, deep = false) {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  if (!win) return true;
  const check = (node) => {
    if (node.hidden) return false;
    const st = win.getComputedStyle(node);
    return !(st.display === 'none' || st.visibility === 'hidden' || st.visibility === 'collapse');
  };
  if (!check(el)) return false;
  if (hasLayout(doc)) {
    if (win.getComputedStyle(el).display === 'contents') return true;
    return el.getClientRects().length > 0;
  }
  if (deep) {
    for (let p = el.parentElement, i = 0; p && p !== doc.body && i < 12; p = p.parentElement, i++) {
      if (!check(p)) return false;
    }
  }
  return true;
}

/* ---------- noise heuristics ---------- */
const NOISE_RE = /(^|[-_\s])(ad|ads|advert|advertisement|sponsor|sponsored|promo|promoted|banner|popup|cookie|cookies|consent|gdpr|newsletter|subscribe|share|sharing|social|sidebar|widget|related|recommended|breadcrumb|breadcrumbs|toolbar|skip|overlay|outbrain|taboola|adsbygoogle)([-_\s]|$)/i;

export function noiseToken(el) {
  const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
  return NOISE_RE.test(`${el.id || ''} ${cls}`);
}

export function linkDensity(el) {
  const total = (el.textContent || '').length;
  if (!total) return 0;
  let linked = 0;
  const as = el.querySelectorAll('a');
  const n = Math.min(as.length, 400);
  for (let i = 0; i < n; i++) linked += (as[i].textContent || '').length;
  return Math.min(1, linked / total);
}

export function isLayoutTable(t) {
  if (t.getAttribute('role') === 'presentation') return true;
  if (t.querySelector('table')) return true;
  if (t.querySelector('input,select,textarea')) return true;
  if (t.querySelector('th,thead,caption')) return false;
  if (t.querySelector('div,p,ul,ol,h1,h2,h3,h4,h5,h6,form,hr')) return true;
  return (t.rows ? t.rows.length : 0) < 2;
}

/* ---------- urls & media ---------- */
export function absUrl(href, base) {
  const h = String(href || '').trim();
  if (!h || /^(javascript|mailto|tel|data|blob):/i.test(h) || h === '#') return '';
  try {
    return new URL(h, base).href;
  } catch {
    return '';
  }
}

export function pickSrc(img) {
  const direct = img.currentSrc || img.getAttribute('src') || '';
  const lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
  if (direct && !/^data:image\/(gif|svg)/i.test(direct)) return direct;
  if (lazy) return lazy;
  const set = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
  if (set) {
    const parts = set.split(',').map((s) => s.trim().split(/\s+/));
    parts.sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
    if (parts[0] && parts[0][0]) return parts[0][0];
  }
  return direct;
}

export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- selectors ---------- */
export const esc = (s) => (globalThis.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));

export function cssPath(el) {
  const doc = el.ownerDocument;
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && n !== doc.documentElement; n = n.parentElement) {
    if (n.id) {
      const sel = '#' + esc(n.id);
      if (doc.querySelectorAll(sel).length === 1) {
        parts.unshift(sel);
        break;
      }
    }
    const tag = n.tagName.toLowerCase();
    let seg = tag;
    const name = n.getAttribute && n.getAttribute('name');
    if (name && /^(input|select|textarea|button)$/.test(tag)) {
      seg += `[name="${name.replace(/"/g, '\\"')}"]`;
    }
    const sibs = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : [];
    if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(n) + 1})`;
    parts.unshift(seg);
    if (tag === 'body') break;
  }
  return parts.join(' > ');
}

export function xpath(el) {
  const parts = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const tag = n.tagName.toLowerCase();
    const sibs = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : [n];
    parts.unshift(sibs.length > 1 ? `${tag}[${sibs.indexOf(n) + 1}]` : tag);
  }
  return '/' + parts.join('/');
}

/* ---------- names ---------- */
export function humanize(name) {
  let s = String(name || '').split(/[$:.]/).filter(Boolean).pop() || '';
  s = s.replace(/^(txt|ddl|drp|chk|rb|rbl|btn|lbl|cmb|cbo|sel|inp|fld)(?=[A-Z_])/, '');
  s = s.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
