// PuryWeb — content/proxy-engine.js
// HEADLESS PROXY: the new UI is only a skin. Every keystroke is mirrored into the ORIGINAL (hidden) controls,
// and every action clicks the ORIGINAL button, so old validators, tokens, ViewState and JS keep working 100%.
//
// Guarantees
//  1. Values go through the native setter + full event sequence (React/Angular/Vue/jQuery/ASP.NET safe).
//  2. Original -> UI sync: dependent dropdowns, datepickers and scripts that change fields update the new UI.
//  3. Postbacks (AutoPostBack, dependent selects) reload the page: a short-lived "resume" record rebuilds the
//     same purified UI after the reload with no new AI call.
//  4. Actions click the original element (or call __doPostBack in the page's own JS world).
//  5. If anything cannot be mirrored (reCAPTCHA, vanished element) the user is sent to the original page.

import { lookup, isVisible } from './dom-utils.js';
import { t } from '../shared/i18n.js';
import {
  commit, convertDate, toIso, writeText, writeChecked, writeSelectIndex, writeSelectMultiple, writeFiles,
  readSignature, optionsSignature,
} from './field-writer.js';

const TEXTUAL = new Set(['text', 'email', 'tel', 'number', 'date', 'url', 'search', 'password', 'time', 'datetime-local', 'month', 'week', 'textarea']);
const POLL_MS = 600;
const ERROR_SEL = '.error, .errors, .validation-summary-errors, .field-validation-error, .text-danger, .invalid-feedback, span[id*="Validator" i], span[class*="error" i], [role="alert"]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const computeSig = (model) => model.forms.map((f) => f.fields.map((x) => x.name + ':' + x.kind).join(',')).join('|');

function resolveEl(id, sel, xp) {
  let el = lookup(id);
  if (el && el.isConnected) return el;
  el = null;
  try {
    if (sel) el = document.querySelector(sel);
  } catch {
    /* invalid selector */
  }
  if (!el && xp) {
    try {
      el = document.evaluate(xp, document, null, 9, null).singleNodeValue;
    } catch {
      /* invalid xpath */
    }
  }
  return el && el.isConnected ? el : null;
}

/**
 * @param {{root:ShadowRoot, model:object, plan:object, lang:string}} ctx
 * @returns {Promise<boolean>} true when the proxy is attached
 */
export async function bind({ root, model, plan, lang }) {
  const fields = new Map();
  const actions = new Map();
  for (const form of model.forms) {
    for (const f of form.fields) fields.set(f.id, { f, form });
    for (const a of form.actions) actions.set(a.id, { a, form });
  }
  const state = { pending: 0, queue: Promise.resolve(), busy: false, disposed: false, last: new Map(), observers: [], timers: [], pulls: new Map() };
  const tr = (k, v) => t(k, v, lang);

  const origOf = (entry) => resolveEl(entry.f.id, entry.f.selector, entry.f.xpath);
  const uiOf = (fid) => root.querySelector(`[data-pw-field="${fid}"]:not([data-pw-option])`);
  const optUis = (fid) => Array.from(root.querySelectorAll(`[data-pw-field="${fid}"][data-pw-option]`));
  const remember = (fid, el) => el && state.last.set(fid, readSignature(el));

  /* ---------- feedback ---------- */
  function toast(text) {
    root.querySelector('[data-pw-flash]')?.remove();
    const el = document.createElement('div');
    el.setAttribute('data-pw-flash', '');
    el.setAttribute('role', 'alert');
    el.className = 'fixed bottom-6 left-1/2 z-20 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[18px] leading-8 text-amber-900 shadow-xl';
    el.textContent = text;
    (root.getElementById('scroll') || root).append(el);
    setTimeout(() => el.remove(), 7000);
  }

  function markError(fid, message) {
    const wrap = root.querySelector(`[data-pw-wrap="${fid}"]`);
    if (!wrap) return;
    const panel = wrap.closest('[data-pw-step]');
    const form = wrap.closest('[data-pw-form]');
    if (panel && form && panel.classList.contains('hidden')) {
      form.querySelectorAll('[data-pw-step]').forEach((p) => p.classList.toggle('hidden', p !== panel));
      form.dataset.pwCurrent = panel.dataset.pwStep;
    }
    wrap.querySelector('[data-pw-err]')?.remove();
    wrap.classList.add('rounded-2xl', 'ring-2', 'ring-red-400', 'p-3');
    const p = document.createElement('p');
    p.setAttribute('data-pw-err', '');
    p.className = 'mt-2 text-[16px] font-medium text-red-600';
    p.textContent = message || tr('form.fillthis');
    wrap.append(p);
  }

  /* ---------- resume (postback survival) ---------- */
  async function saveResume() {
    const formEl = root.querySelector('[data-pw-form]');
    const step = formEl ? Number(formEl.dataset.pwCurrent || 0) : 0;
    try {
      await chrome.runtime.sendMessage({
        type: 'PW_RESUME_SAVE',
        record: { path: location.origin + location.pathname, sig: computeSig(model), plan, step },
      });
    } catch {
      /* best effort */
    }
  }

  /* ---------- UI -> original ---------- */
  async function push(entry, ui, isChange, { resume = true } = {}) {
    const { f } = entry;
    if (f.kind === 'radio' || f.kind === 'checkbox-group') {
      if (!isChange) return;
      const o = resolveEl(ui.getAttribute('data-pw-option'));
      if (!o) return;
      if (resume && ui.checked !== !!o.checked) await saveResume();
      writeChecked(o, ui.checked);
      remember(f.id, o);
      return;
    }
    const orig = origOf(entry);
    if (!orig) return;

    if (f.kind === 'checkbox') {
      if (isChange) {
        if (resume && ui.checked !== !!orig.checked) await saveResume();
        writeChecked(orig, ui.checked);
      }
    } else if (f.kind === 'select') {
      if (!isChange) return;
      const idx = Number(ui.value);
      if (resume && orig.selectedIndex !== idx) await saveResume();
      writeSelectIndex(orig, idx);
    } else if (f.kind === 'select-multiple') {
      if (isChange) writeSelectMultiple(orig, Array.from(ui.selectedOptions).map((o) => Number(o.value)));
    } else if (f.kind === 'file') {
      if (isChange && ui.files) writeFiles(orig, Array.from(ui.files));
    } else if (TEXTUAL.has(f.kind)) {
      const v = f.kind === 'date' ? convertDate(ui.value, orig) : ui.value;
      writeText(orig, v);
      if (isChange) commit(orig);
    }
    remember(f.id, orig);
  }

  // Pushes run strictly in order (a select may await the resume save before writing).
  function enqueue(job) {
    state.pending++;
    state.queue = state.queue.then(job).catch((err) => console.warn('[PuryWeb] mirror failed', err)).finally(() => state.pending--);
    return state.queue;
  }

  function onUi(e) {
    if (state.disposed) return;
    const ui = e.target;
    const fid = ui && ui.getAttribute && ui.getAttribute('data-pw-field');
    const entry = fid && fields.get(fid);
    if (!entry) return;
    const isChange = e.type === 'change';
    enqueue(() => push(entry, ui, isChange));
  }

  async function flushAll() {
    await state.queue;
    for (const entry of fields.values()) {
      const list = entry.f.kind === 'radio' || entry.f.kind === 'checkbox-group' ? optUis(entry.f.id) : [uiOf(entry.f.id)];
      for (const ui of list) if (ui) await enqueue(() => push(entry, ui, true, { resume: false }));
    }
  }

  /* ---------- original -> UI ---------- */
  function rebuildSelect(ui, orig) {
    ui.textContent = '';
    Array.from(orig.options).forEach((o, i) => {
      const op = document.createElement('option');
      op.value = String(i);
      op.textContent = o.text.trim();
      if (o.disabled) op.disabled = true;
      if (i === 0 && (o.value === '' || /^(select|choose|--|নির্বাচন|বাছাই)/i.test(o.text.trim()))) op.setAttribute('data-pw-ph', '');
      ui.append(op);
    });
    ui.dataset.pwSig = optionsSignature(orig);
  }

  function pull(fid) {
    const entry = fields.get(fid);
    if (!entry || state.disposed) return;
    const { f } = entry;
    if (state.pending) return schedulePull(fid);
    {
      if (f.kind === 'radio' || f.kind === 'checkbox-group') {
        for (const ui of optUis(fid)) {
          const o = resolveEl(ui.getAttribute('data-pw-option'));
          if (o) ui.checked = !!o.checked;
        }
        return;
      }
      const orig = origOf(entry);
      const ui = uiOf(fid);
      if (!orig || !ui) return;
      if (f.kind === 'select' || f.kind === 'select-multiple') {
        if (ui.dataset.pwSig !== optionsSignature(orig)) rebuildSelect(ui, orig);
        if (f.kind === 'select') ui.selectedIndex = orig.selectedIndex;
        else Array.from(orig.options).forEach((o, i) => ui.options[i] && (ui.options[i].selected = o.selected));
      } else if (f.kind === 'checkbox') {
        ui.checked = !!orig.checked;
      } else if (TEXTUAL.has(f.kind) && root.activeElement !== ui) {
        const v = ui.type === 'date' ? toIso(orig.value, orig) : orig.value;
        if (ui.value !== v) ui.value = v;
      }
      remember(fid, orig);
    }
  }

  function schedulePull(fid) {
    clearTimeout(state.pulls.get(fid));
    state.pulls.set(fid, setTimeout(() => pull(fid), 60));
  }

  function poll() {
    if (state.disposed || state.pending) return;
    for (const [fid, entry] of fields) {
      if (entry.f.kind === 'file' || entry.f.kind === 'radio' || entry.f.kind === 'checkbox-group') continue;
      const orig = origOf(entry);
      if (orig && state.last.get(fid) !== readSignature(orig)) pull(fid);
    }
  }

  /* ---------- actions ---------- */
  function nativeInvalid(form) {
    const bad = [];
    for (const f of form.fields) {
      const o = resolveEl(f.id, f.selector, f.xpath);
      if (o && o.willValidate && typeof o.checkValidity === 'function' && !o.checkValidity()) bad.push({ fid: f.id, msg: o.validationMessage });
    }
    return bad;
  }

  function collectErrors(form) {
    const scope = (form.id && lookup(form.id)) || document;
    const seen = new Set();
    for (const el of scope.querySelectorAll(ERROR_SEL)) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && text.length < 200 && isVisible(el)) seen.add(text);
    }
    return Array.from(seen).slice(0, 4);
  }

  async function postback(pb) {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'PW_POSTBACK', target: pb.target, arg: pb.arg });
      return !!(r && r.ran);
    } catch {
      return false;
    }
  }

  async function runAction(actionId) {
    const entry = actions.get(actionId);
    if (!entry || state.busy) return;
    state.busy = true;
    const btns = Array.from(root.querySelectorAll(`[data-pw-action="${actionId}"]`));
    btns.forEach((b) => (b.disabled = true));
    try {
      await flushAll();
      const bad = nativeInvalid(entry.form);
      if (bad.length) {
        bad.forEach((b) => markError(b.fid, b.msg));
        toast(tr('proxy.invalid'));
        return;
      }
      const el = resolveEl(actionId, entry.a.selector, entry.a.xpath);
      if (!el) {
        toast(tr('proxy.gone'));
        window.dispatchEvent(new CustomEvent('puryweb:show-original'));
        return;
      }
      if (entry.a.postback) {
        if (!(await postback(entry.a.postback))) el.click();
      } else {
        el.click();
      }
      await sleep(1000);
      const errs = collectErrors(entry.form);
      if (errs.length) toast(errs.join(' · '));
    } finally {
      state.busy = false;
      btns.forEach((b) => (b.disabled = false));
    }
  }

  const onAction = (ev) => {
    if (state.disposed || !ev.detail) return;
    ev.detail.handled = true;
    runAction(ev.detail.actionId);
  };

  /* ---------- captcha ---------- */
  function drawCaptcha(img, box) {
    box.textContent = '';
    let node;
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width || 160;
      c.height = img.naturalHeight || img.height || 56;
      c.getContext('2d').drawImage(img, 0, 0);
      c.className = 'h-14 w-auto rounded-lg border border-zinc-200 bg-white';
      node = c;
    } catch {
      node = document.createElement('img');
      node.src = img.src;
      node.className = 'h-14 w-auto rounded-lg border border-zinc-200 bg-white';
    }
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'pw-btn pw-btn-ghost !min-h-[2.75rem] !px-4 mt-3';
    refresh.textContent = tr('captcha.refresh');
    refresh.addEventListener('click', () => {
      const scope = img.closest('form') || document;
      const trigger = scope.querySelector('[onclick*="aptcha" i], a[href*="aptcha" i], img[onclick]') || img;
      trigger.click();
      setTimeout(() => drawCaptcha(img, box), 700);
    });
    box.append(node, refresh);
  }

  function setupCaptchas() {
    for (const form of model.forms) {
      const cap = form.captcha;
      if (!cap || !cap.fieldId) continue;
      const box = root.querySelector(`[data-pw-captcha="${cap.fieldId}"] [data-pw-captcha-image]`);
      if (!box) continue;
      const img = cap.imageSelector ? document.querySelector(cap.imageSelector) : null;
      if (img) {
        const go = () => drawCaptcha(img, box);
        if (img.complete) go();
        img.addEventListener('load', go);
      } else if (cap.widget) {
        box.textContent = '';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pw-btn pw-btn-primary';
        b.textContent = tr('captcha.solve');
        b.addEventListener('click', () => window.dispatchEvent(new CustomEvent('puryweb:show-original')));
        box.append(b);
      }
    }
  }

  /* ---------- wire up ---------- */
  root.addEventListener('input', onUi);
  root.addEventListener('change', onUi);
  window.addEventListener('puryweb:action', onAction);

  for (const [fid, entry] of fields) {
    const orig = origOf(entry);
    if (!orig) continue;
    remember(fid, orig);
    if (entry.f.kind === 'select' || entry.f.kind === 'select-multiple') {
      const ui = uiOf(fid);
      if (ui) {
        if (ui.options.length !== orig.options.length) rebuildSelect(ui, orig);
        else ui.dataset.pwSig = optionsSignature(orig);
      }
      const mo = new MutationObserver(() => schedulePull(fid));
      mo.observe(orig, { childList: true, subtree: true });
      state.observers.push(mo);
    }
  }
  setupCaptchas();
  state.timers.push(setInterval(poll, POLL_MS));

  const dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    state.observers.forEach((o) => o.disconnect());
    state.timers.forEach(clearInterval);
    state.pulls.forEach(clearTimeout);
    window.removeEventListener('puryweb:action', onAction);
    window.removeEventListener('puryweb:closed', dispose);
  };
  window.addEventListener('puryweb:closed', dispose);
  return true;
}
