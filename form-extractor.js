// PuryWeb — content/form-extractor.js
// Turns every real <form> (and orphan controls) into a structured model.
// Every field/action keeps a registry id + selector + xpath so the Phase 7 headless proxy
// can fill the ORIGINAL controls and trigger the ORIGINAL submit.

import {
  register, cleanText, textOf, isVisible, esc, cssPath, xpath, humanize, absUrl, truncate,
} from './dom-utils.js';

const MAX_FIELDS = 300;
const MAX_OPTIONS = 300;
const CHROME_SEL = 'nav, footer, aside, [role="navigation"], [role="contentinfo"], [role="complementary"]';
const ACTION_SEL = 'button, input[type=submit], input[type=button], input[type=image], input[type=reset], a[onclick], a[href^="javascript:" i], [role="button"]';
const POS = /(submit|save|search|find|next|continue|apply|register|send|confirm|login|log in|sign in|pay|order|জমা|সংরক্ষণ|খুঁজ|অনুসন্ধান|পরবর্তী|আবেদন|নিশ্চিত|প্রবেশ|লগইন|সাবমিট)/i;
const NEG = /(reset|cancel|clear|back|previous|close|delete|remove|বাতিল|মুছ|ফিরে|পূর্ববর্তী|বন্ধ|রিসেট)/i;
const CAPTCHA_RE = /(captcha|verification code|security code|ভেরিফিকেশন|ক্যাপচা)/i;
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

const inChrome = (el) => !!el.closest(CHROME_SEL);

function cleanLabel(s) {
  return cleanText(s).replace(/\s*[:：]\s*$/, '').replace(/\s*\(?\*\)?\s*$/, '').replace(/\s*\((required|আবশ্যক)\)\s*$/i, '').trim();
}

/* ---------------- label resolution ---------------- */
function labelledBy(el) {
  const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  const doc = el.ownerDocument;
  return cleanText(ids.map((i) => doc.getElementById(i)?.textContent || '').join(' '));
}

function explicitLabel(el) {
  const doc = el.ownerDocument;
  const by = labelledBy(el);
  if (by) return by;
  if (el.id) {
    const labels = doc.querySelectorAll(`label[for="${esc(el.id)}"]`);
    const t = cleanText(Array.from(labels).map((l) => textOf(l)).join(' '));
    if (t) return t;
  }
  const wrap = el.closest('label');
  if (wrap) {
    const t = textOf(wrap);
    if (t) return t;
  }
  return cleanText(el.getAttribute('aria-label') || '');
}

function cellLabel(el) {
  const cell = el.closest('td,th');
  if (cell) {
    for (let p = cell.previousElementSibling; p; p = p.previousElementSibling) {
      const t = textOf(p);
      if (t && t.length <= 120) return t;
    }
  }
  const dd = el.closest('dd');
  if (dd && dd.previousElementSibling && dd.previousElementSibling.tagName === 'DT') return textOf(dd.previousElementSibling);
  return '';
}

function prevText(el) {
  let node = el.previousSibling;
  for (let hops = 0; node && hops < 6; node = node.previousSibling, hops++) {
    const t = node.nodeType === 3 ? cleanText(node.nodeValue) : node.nodeType === 1 && !/^(INPUT|SELECT|TEXTAREA|BUTTON|SCRIPT|STYLE)$/i.test(node.tagName) ? textOf(node) : '';
    if (t) return t.length <= 100 ? t : '';
  }
  return '';
}

function fieldLabel(el) {
  const raw = explicitLabel(el) || cellLabel(el) || prevText(el) || cleanText(el.getAttribute('placeholder') || '') ||
    cleanText(el.getAttribute('title') || '') || humanize(el.getAttribute('name') || el.id);
  return truncate(cleanLabel(raw), 120);
}

function groupLabel(el) {
  const legend = el.closest('fieldset')?.querySelector('legend');
  if (legend) return cleanLabel(textOf(legend));
  return cleanLabel(cellLabel(el) || prevText(el.closest('label') || el) || humanize(el.getAttribute('name')));
}

function optionLabel(el) {
  const doc = el.ownerDocument;
  let t = '';
  if (el.id) t = textOf(doc.querySelector(`label[for="${esc(el.id)}"]`) || doc.createElement('i'));
  if (!t && el.closest('label')) t = textOf(el.closest('label'));
  if (!t) {
    const n = el.nextSibling;
    t = n ? (n.nodeType === 3 ? cleanText(n.nodeValue) : n.nodeType === 1 ? textOf(n) : '') : '';
  }
  return truncate(cleanLabel(t) || cleanText(el.value), 100);
}

function hintOf(el) {
  const doc = el.ownerDocument;
  const ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const t = cleanText(ids.map((i) => doc.getElementById(i)?.textContent || '').join(' '));
  if (t) return truncate(t, 160);
  const n = el.nextElementSibling;
  if (n && /^(SMALL|SPAN|DIV|P)$/i.test(n.tagName) && /(hint|help|note|desc|tip|small|muted)/i.test(n.className || '')) return truncate(textOf(n), 160);
  return '';
}

function isRequired(el, label) {
  return !!(el.required || el.getAttribute('aria-required') === 'true' ||
    /(^|\s)(required|mandatory)(\s|$)/i.test(el.getAttribute('class') || '') || /\*/.test(label || ''));
}

/* ---------------- sections ---------------- */
function collectMarks(formEl) {
  return Array.from(formEl.querySelectorAll('h1,h2,h3,h4,h5,h6,caption,.legend,.panel-heading,.card-header')).slice(0, 80);
}

function sectionOf(el, marks) {
  const legend = el.closest('fieldset')?.querySelector('legend');
  if (legend) return truncate(cleanText(legend.textContent), 80);
  let found = '';
  for (const m of marks) {
    if (m.compareDocumentPosition(el) & 4 /* el follows m */) found = m;
    else break;
  }
  return found ? truncate(textOf(found), 80) : '';
}

/* ---------------- fields ---------------- */
function postbackKind(el) {
  const oc = el.getAttribute('onchange') || '';
  if (/__doPostBack|setTimeout\(/i.test(oc)) return 'postback';
  return oc ? 'script' : '';
}

function typeOf(el) {
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return 'textarea';
  if (tag === 'SELECT') return el.multiple ? 'select-multiple' : 'select';
  return (el.getAttribute('type') || 'text').toLowerCase();
}

function baseField(el, type, marks) {
  const label = fieldLabel(el);
  const f = {
    id: register(el, 'f'),
    kind: type,
    name: el.getAttribute('name') || '',
    label,
    required: isRequired(el, explicitLabel(el) || label),
    placeholder: truncate(cleanText(el.getAttribute('placeholder') || ''), 100),
    hint: hintOf(el),
    section: sectionOf(el, marks),
    disabled: !!el.disabled,
    readonly: !!el.readOnly,
    selector: cssPath(el),
    xpath: xpath(el),
  };
  const sig = `${f.name} ${el.id} ${el.getAttribute('class') || ''} ${f.placeholder} ${label}`;
  if (CAPTCHA_RE.test(sig)) f.captcha = true;
  return f;
}

function readControls(controls, formEl, stats) {
  const marks = collectMarks(formEl);
  const fields = [];
  const groups = new Map();
  for (const el of controls) {
    if (fields.length >= MAX_FIELDS) break;
    const type = typeOf(el);
    if (type === 'hidden') {
      stats.hidden++;
      continue;
    }
    if (SKIP_TYPES.has(type)) continue;
    if (!isVisible(el, true)) {
      stats.hiddenControls++;
      continue;
    }
    if (inChrome(el)) continue;

    if ((type === 'radio' || type === 'checkbox') && el.name) {
      const key = type + ':' + el.name;
      const opt = { id: register(el, 'o'), value: el.value, label: optionLabel(el), checked: !!el.checked, disabled: !!el.disabled };
      if (groups.has(key)) {
        groups.get(key).options.push(opt);
        continue;
      }
      const f = baseField(el, type, marks);
      f.label = groupLabel(el) || f.label;
      f.options = [opt];
      groups.set(key, f);
      fields.push(f);
      continue;
    }

    const f = baseField(el, type, marks);
    if (type === 'select' || type === 'select-multiple') {
      f.options = Array.from(el.options).slice(0, MAX_OPTIONS).map((o) => ({
        value: o.value, label: truncate(cleanText(o.textContent), 100), selected: !!o.selected, disabled: !!o.disabled,
      }));
      const first = f.options[0];
      if (first && (first.value === '' || /^(select|choose|--|please|নির্বাচন|বাছাই)/i.test(first.label))) first.placeholder = true;
      f.onchange = postbackKind(el);
      f.optionsTotal = el.options.length;
    } else if (type === 'checkbox') {
      f.checked = !!el.checked;
      f.options = [{ id: f.id, value: el.value, label: f.label, checked: !!el.checked }];
    } else {
      if (type !== 'password' && type !== 'file') f.value = truncate(String(el.value || ''), 200);
      if (el.maxLength > 0 && el.maxLength < 100000) f.maxlength = el.maxLength;
      const pattern = el.getAttribute('pattern');
      if (pattern) f.pattern = pattern;
      for (const a of ['min', 'max', 'step']) if (el.getAttribute(a)) f[a] = el.getAttribute(a);
      f.onchange = postbackKind(el);
    }
    fields.push(f);
  }
  for (const f of fields) {
    if (f.kind === 'checkbox' && f.options.length === 1 && groups.has('checkbox:' + f.name)) {
      f.checked = f.options[0].checked;
    } else if (f.kind === 'checkbox' && f.options.length > 1) {
      f.kind = 'checkbox-group';
    }
  }
  return fields;
}

/* ---------------- actions ---------------- */
function parsePostback(js) {
  const m = /__doPostBack\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/.exec(js || '');
  return m ? { target: m[1], arg: m[2] } : null;
}

function actionLabel(el) {
  const tag = el.tagName.toUpperCase();
  const t = tag === 'INPUT' ? el.getAttribute('value') || el.getAttribute('alt') || '' : textOf(el);
  return truncate(cleanLabel(t || el.getAttribute('aria-label') || el.getAttribute('title') || humanize(el.getAttribute('name') || el.id)), 80);
}

function readActions(scope, formEl) {
  const seen = new Set();
  const list = [];
  const candidates = Array.from(scope.querySelectorAll(ACTION_SEL));
  if (formEl) for (const e of formEl.elements) if (/^(BUTTON|INPUT)$/i.test(e.tagName)) candidates.push(e);
  for (const el of candidates) {
    if (seen.has(el) || list.length >= 12) continue;
    seen.add(el);
    if (!isVisible(el, true) || inChrome(el)) continue;
    const tag = el.tagName.toUpperCase();
    const type = (el.getAttribute('type') || (tag === 'BUTTON' ? 'submit' : '')).toLowerCase();
    if (tag === 'INPUT' && !/^(submit|button|image|reset)$/.test(type)) continue;
    const label = actionLabel(el);
    if (!label) continue;
    const js = el.getAttribute('onclick') || el.getAttribute('href') || '';
    let kind = type === 'reset' ? 'reset' : type === 'submit' || type === 'image' ? 'submit' : tag === 'A' ? 'link' : 'button';
    if (kind !== 'reset' && kind !== 'submit' && POS.test(label) && !NEG.test(label)) kind = 'submit';
    list.push({
      id: register(el, 'a'),
      label,
      kind,
      disabled: !!el.disabled,
      postback: parsePostback(js),
      selector: cssPath(el),
      xpath: xpath(el),
      _score: (POS.test(label) ? 2 : 0) + (kind === 'submit' ? 1 : 0) - (NEG.test(label) ? 3 : 0),
    });
  }
  const best = list.filter((a) => a._score > 0 && !a.disabled).sort((a, b) => b._score - a._score)[0];
  for (const a of list) {
    a.primary = !!best && a.id === best.id;
    delete a._score;
  }
  return list;
}

/* ---------------- form-level ---------------- */
function isWrapperForm(f) {
  const n = f.querySelectorAll('input:not([type=hidden]), select, textarea').length;
  const len = (f.textContent || '').length;
  if (f.querySelector('input[name="__VIEWSTATE"]') && len > 1500) return true;
  if (f.querySelector('header, nav, footer, h1') && n < 40) return true;
  return len > 2500 && n <= 25;
}

function isSearchForm(f, fields) {
  if (fields.length > 2) return false;
  const role = (f.getAttribute('role') || '').toLowerCase();
  return role === 'search' || fields.some((x) => x.kind === 'search' || /^(q|s|search|query|keyword|keywords)$/i.test(x.name));
}

function formTitle(f, headings) {
  const direct = f.getAttribute('aria-label') || f.querySelector('legend, h1, h2, h3, h4')?.textContent;
  if (direct) return truncate(cleanText(direct), 100);
  let prev = '';
  for (const h of headings) {
    if (h.compareDocumentPosition(f) & 4) prev = h;
    else break;
  }
  return prev ? truncate(textOf(prev), 100) : '';
}

function frameworkOf(f) {
  if (f.querySelector('input[name="__VIEWSTATE"], input[name="__EVENTTARGET"]')) return 'aspnet';
  if (f.querySelector('input[name="csrfmiddlewaretoken"]')) return 'django';
  if (f.querySelector('input[name="authenticity_token"]')) return 'rails';
  if (f.querySelector('input[name="_token"]')) return 'laravel';
  if (f.querySelector('input[name^="form_build_id"]')) return 'drupal';
  return '';
}

function captchaInfo(scope, fields) {
  const input = fields.find((x) => x.captcha);
  const img = scope.querySelector('img[src*="captcha" i], img[id*="captcha" i], img[class*="captcha" i], canvas[id*="captcha" i]');
  const widget = scope.querySelector('.g-recaptcha, iframe[src*="recaptcha"], .h-captcha, .cf-turnstile');
  if (!input && !img && !widget) return null;
  return {
    fieldId: input ? input.id : null,
    imageSelector: img ? cssPath(img) : null,
    widget: widget ? (widget.className || widget.tagName).toString().slice(0, 40) : null,
    humanRequired: true,
  };
}

/**
 * @returns {{forms: object[], byEl: Map<Element,string>}}
 */
export function extractForms(doc, base) {
  const forms = [];
  const byEl = new Map();
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4')).slice(0, 200);
  const claimed = new Set();

  for (const formEl of Array.from(doc.forms).slice(0, 20)) {
    if (!isVisible(formEl, true)) continue;
    const ctrls = Array.from(formEl.elements).filter((e) => /^(INPUT|SELECT|TEXTAREA)$/i.test(e.tagName));
    ctrls.forEach((c) => claimed.add(c));
    const stats = { hidden: 0, hiddenControls: 0 };
    const fields = readControls(ctrls, formEl, stats);
    const actions = readActions(formEl, formEl);
    if (!fields.length && !actions.some((a) => a.primary)) continue;
    const id = register(formEl, 'F');
    const primary = actions.find((a) => a.primary);
    const model = {
      id,
      name: formEl.getAttribute('name') || formEl.id || '',
      title: formTitle(formEl, headings),
      action: absUrl(formEl.getAttribute('action') || '', base) || base,
      method: (formEl.getAttribute('method') || 'get').toLowerCase(),
      enctype: formEl.getAttribute('enctype') || '',
      wrapper: isWrapperForm(formEl),
      framework: frameworkOf(formEl),
      hiddenFields: stats.hidden,
      hiddenControls: stats.hiddenControls,
      hasFile: fields.some((x) => x.kind === 'file'),
      captcha: captchaInfo(formEl, fields),
      fields,
      actions,
      primaryActionId: primary ? primary.id : null,
      selector: cssPath(formEl),
      xpath: xpath(formEl),
    };
    model.search = isSearchForm(formEl, fields);
    forms.push(model);
    byEl.set(formEl, id);
  }

  // Controls that live outside any <form> (common in legacy JS-driven pages).
  const orphans = Array.from(doc.querySelectorAll('input, select, textarea')).filter((e) => !e.form && !claimed.has(e));
  if (orphans.length >= 2) {
    const stats = { hidden: 0, hiddenControls: 0 };
    const scope = doc.querySelector('main, [role="main"], #content, body') || doc.body;
    const fields = readControls(orphans, scope, stats);
    if (fields.length >= 2) {
      const actions = readActions(scope, null).filter((a) => !forms.some((f) => f.actions.some((x) => x.id === a.id)));
      const primary = actions.find((a) => a.primary);
      forms.push({
        id: register(scope, 'F'), name: 'virtual', title: formTitle(scope, headings), action: base, method: 'js',
        enctype: '', wrapper: false, framework: '', hiddenFields: stats.hidden, hiddenControls: stats.hiddenControls,
        hasFile: fields.some((x) => x.kind === 'file'), captcha: captchaInfo(scope, fields), fields, actions,
        primaryActionId: primary ? primary.id : null, selector: cssPath(scope), xpath: xpath(scope), virtual: true, search: false,
      });
    }
  }

  // Drop header search boxes when real forms exist.
  const real = forms.filter((f) => !f.search);
  return { forms: real.length ? real : forms, byEl };
}
