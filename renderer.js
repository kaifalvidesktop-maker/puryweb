// PuryWeb — content/renderer.js
// Renders the validated plan with OUR templates inside a Shadow DOM overlay (light, 18px+ type).
// Output HTML is built from escaped strings and then sanitized again (defense in depth).

import { RENDER_CSS } from './render-css.js';
import { t, setLang } from '../shared/i18n.js';
import { recycleSvg } from '../shared/icons.js';
import { pickTemplate } from '../templates/registry.js';
import { esc } from '../templates/blocks.js';
import { shuffleTokens, applyTokens } from './shuffle.js';

const HOST_ID = 'puryweb-view';
const PILL_ID = 'puryweb-pill';

const EXTRA_CSS = `
:host { all: initial; }
#scroll { position: absolute; inset: 0; overflow: auto; background: #FAFAFA; color: #18181b; -webkit-font-smoothing: antialiased;
  font-family: Inter, 'Noto Sans Bengali', 'Segoe UI', system-ui, -apple-system, sans-serif; scroll-behavior: smooth; }
#scroll :focus-visible { outline: 3px solid #7C3AED; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { #scroll { scroll-behavior: auto; } * { transition: none !important; animation: none !important; } }
@media print { #toolbar, #footer { display: none !important; } }
`;

const REMOVE_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'OBJECT', 'EMBED', 'BASE', 'TEMPLATE', 'NOSCRIPT', 'FRAME', 'FRAMESET']);
const YT_PREFIX = 'https://www.youtube-nocookie.com/embed/';

/** Strip anything that could execute: tags, on* handlers, javascript: URLs, foreign iframes. */
export function sanitize(root) {
  const walker = document.createTreeWalker(root, 1);
  const kill = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const tag = n.tagName.toUpperCase();
    if (REMOVE_TAGS.has(tag) || (tag === 'IFRAME' && !String(n.getAttribute('src') || '').startsWith(YT_PREFIX))) {
      kill.push(n);
      continue;
    }
    for (const a of Array.from(n.attributes)) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') n.removeAttribute(a.name);
      else if (['href', 'src', 'poster', 'action'].includes(name) && a.value && !/^(https?:\/\/|#)/i.test(a.value.trim())) n.removeAttribute(a.name);
    }
  }
  kill.forEach((n) => n.remove());
  return root;
}

/* ---------------- toolbar / chrome ---------------- */
function toolbarHtml(model, lang) {
  const host = esc(model.host);
  return `<header id="toolbar" class="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
  <div class="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
    <div class="flex min-w-0 items-center gap-3"><span class="inline-flex shrink-0" aria-hidden="true">${recycleSvg({ size: 34 })}</span>
      <div class="min-w-0"><div class="text-[18px] font-bold leading-tight tracking-tight text-zinc-900">PuryWeb</div><div class="truncate text-[14px] leading-tight text-zinc-500">${host}</div></div></div>
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button type="button" data-pw-font="-1" class="pw-btn pw-btn-ghost !min-h-[2.75rem] !px-3.5" aria-label="${esc(t('view.font.down', {}, lang))}" title="${esc(t('view.font.down', {}, lang))}">A−</button>
      <button type="button" data-pw-font="1" class="pw-btn pw-btn-ghost !min-h-[2.75rem] !px-3.5" aria-label="${esc(t('view.font.up', {}, lang))}" title="${esc(t('view.font.up', {}, lang))}">A+</button>
      <button type="button" data-pw-original class="pw-btn pw-btn-ghost !min-h-[2.75rem] !px-4">${esc(t('view.original', {}, lang))}</button>
      <button type="button" data-pw-close class="pw-btn pw-btn-ghost !min-h-[2.75rem] !px-3.5" aria-label="${esc(t('view.close', {}, lang))}" title="${esc(t('view.close', {}, lang))}">✕</button>
    </div>
  </div></header>`;
}

function footerHtml(lang, meta) {
  const used = meta && meta.provider ? `${esc(meta.provider)}${meta.cached ? ' · cache' : ''}` : '';
  return `<footer id="footer" class="border-t border-zinc-200 bg-white"><div class="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[16px] text-zinc-500">
  <span class="inline-flex items-center gap-2 font-medium text-zinc-700"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>${esc(t('trust.secure', {}, lang))}</span>
  <span>${esc(t('app.name', {}, lang))}${used ? ' · ' + used : ''}</span></div></footer>`;
}

/* ---------------- interaction: steps, validation, actions ---------------- */
function setStep(root, form, idx) {
  form.querySelectorAll('[data-pw-step]').forEach((p) => p.classList.toggle('hidden', Number(p.dataset.pwStep) !== idx));
  form.querySelectorAll('[data-pw-stepnav]').forEach((li) => {
    const i = Number(li.dataset.pwStepnav);
    const on = i <= idx;
    li.classList.toggle('text-zinc-900', on);
    li.classList.toggle('text-zinc-400', !on);
    const dot = li.firstElementChild;
    dot.classList.toggle('pw-grad', on);
    dot.classList.toggle('text-white', on);
    dot.classList.toggle('bg-zinc-100', !on);
    dot.classList.toggle('text-zinc-500', !on);
  });
  form.dataset.pwCurrent = String(idx);
  root.getElementById('scroll').scrollTo?.({ top: 0 });
}

function wrapValid(wrap) {
  const ctrls = Array.from(wrap.querySelectorAll('input,select,textarea'));
  if (!ctrls.length) return true;
  const first = ctrls[0];
  const type = (first.type || '').toLowerCase();
  if (type === 'radio' || type === 'checkbox') return ctrls.some((c) => c.checked);
  if (first.tagName === 'SELECT') {
    const sel = first;
    return sel.selectedIndex >= 0 && !sel.options[sel.selectedIndex].hasAttribute('data-pw-ph') && sel.value !== '';
  }
  if (type === 'file') return !!(first.files && first.files.length);
  return String(first.value || '').trim() !== '';
}

/** Validate required fields inside `scope`; marks and focuses the first problem. */
export function validateScope(scope, lang) {
  let firstBad = null;
  scope.querySelectorAll('[data-pw-wrap][data-pw-required]').forEach((wrap) => {
    wrap.querySelector('[data-pw-err]')?.remove();
    wrap.firstElementChild && wrap.classList.remove('rounded-2xl', 'ring-2', 'ring-red-400', 'p-3');
    if (wrapValid(wrap)) return;
    wrap.classList.add('rounded-2xl', 'ring-2', 'ring-red-400', 'p-3');
    const p = document.createElement('p');
    p.setAttribute('data-pw-err', '');
    p.setAttribute('role', 'alert');
    p.className = 'mt-2 text-[16px] font-medium text-red-600';
    p.textContent = t('form.fillthis', {}, lang);
    wrap.append(p);
    firstBad = firstBad || wrap;
  });
  if (firstBad) firstBad.querySelector('input,select,textarea')?.focus({ preventScroll: false });
  return !firstBad;
}

function flash(root, text) {
  root.querySelector('[data-pw-flash]')?.remove();
  const el = document.createElement('div');
  el.setAttribute('data-pw-flash', '');
  el.setAttribute('role', 'alert');
  el.className = 'fixed bottom-6 left-1/2 z-20 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[18px] leading-8 text-amber-900 shadow-xl';
  el.textContent = text;
  root.getElementById('scroll').append(el);
  setTimeout(() => el.remove(), 6000);
}

/* ---------------- public API ---------------- */
/**
 * @param {{plan:object, model:object, lang?:string, theme?:object, shuffle?:boolean, fallback?:boolean, meta?:object, features?:object}} p
 */
export async function render(p) {
  const { plan, model } = p;
  const lang = p.lang || model.meta.lang || 'bn';
  setLang(lang);
  document.getElementById(HOST_ID)?.remove();
  document.getElementById(PILL_ID)?.remove();

  const { cfg, render: build, widthClass } = pickTemplate(model.category.id);
  const html = build({ model, plan, t: (k, v) => t(k, v, lang), cfg });

  const banner = p.fallback
    ? `<div role="status" class="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[18px] leading-8 text-amber-900">${esc(t('done.fallback', {}, lang))}</div>`
    : '';
  const page = document.createElement('template');
  page.innerHTML = `<div id="scroll">${toolbarHtml(model, lang)}<main class="mx-auto ${widthClass} px-5 pb-24 pt-10 sm:pt-14">${banner}${html}</main>${footerHtml(lang, p.meta)}</div>`;
  sanitize(page.content);

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;';
  host.style.setProperty('--from', (p.theme && p.theme.from) || '#FF6B35');
  host.style.setProperty('--to', (p.theme && p.theme.to) || '#7C3AED');
  applyTokens(host, shuffleTokens({ enabled: p.shuffle !== false, radius: 18 }));
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = RENDER_CSS + EXTRA_CSS;
  root.append(style, page.content);

  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.append(host);

  let scale = 1;
  let pill = null;
  const scroll = root.getElementById('scroll');

  const close = () => {
    host.remove();
    pill?.remove();
    document.documentElement.style.overflow = prevOverflow;
    window.dispatchEvent(new CustomEvent('puryweb:closed'));
  };
  const showOriginal = () => {
    host.style.display = 'none';
    document.documentElement.style.overflow = prevOverflow;
    pill = document.createElement('div');
    pill.id = PILL_ID;
    pill.style.cssText = 'all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483645;';
    const pr = pill.attachShadow({ mode: 'open' });
    pr.innerHTML = `<style>button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;color:#fff;font:600 17px Inter,'Noto Sans Bengali',system-ui,sans-serif;background:linear-gradient(135deg,var(--from),var(--to));box-shadow:0 10px 30px rgba(10,10,11,.25)}button:focus-visible{outline:3px solid #fff;outline-offset:2px}</style><button type="button"></button>`;
    pill.style.setProperty('--from', host.style.getPropertyValue('--from'));
    pill.style.setProperty('--to', host.style.getPropertyValue('--to'));
    pr.querySelector('button').textContent = '♻ ' + t('view.back', {}, lang);
    pr.querySelector('button').addEventListener('click', () => {
      pill.remove();
      pill = null;
      host.style.display = '';
      document.documentElement.style.overflow = 'hidden';
    });
    document.documentElement.append(pill);
  };

  // Keep the host page's keyboard shortcuts away from our inputs.
  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  let bound = false;
  root.addEventListener('submit', (e) => e.preventDefault(), true);
  root.addEventListener('click', (e) => {
    const el = e.target.closest ? e.target.closest('button,[data-pw-action]') : null;
    if (!el) return;
    if (el.hasAttribute('data-pw-close')) return close();
    if (el.hasAttribute('data-pw-original')) return showOriginal();
    if (el.hasAttribute('data-pw-font')) {
      scale = Math.min(1.4, Math.max(0.9, Math.round((scale + Number(el.dataset.pwFont) * 0.1) * 10) / 10));
      scroll.style.zoom = String(scale);
      return;
    }
    const form = el.closest('[data-pw-form]');
    if (el.hasAttribute('data-pw-next') && form) {
      const cur = Number(form.dataset.pwCurrent || 0);
      if (validateScope(form.querySelector(`[data-pw-step="${cur}"]`), lang)) setStep(root, form, cur + 1);
      return;
    }
    if (el.hasAttribute('data-pw-back') && form) {
      setStep(root, form, Math.max(0, Number(form.dataset.pwCurrent || 0) - 1));
      return;
    }
    if (el.hasAttribute('data-pw-action')) {
      if (form && el.hasAttribute('data-pw-primary') && !validateScope(form, lang)) return;
      const ev = new CustomEvent('puryweb:action', {
        cancelable: true,
        detail: { actionId: el.getAttribute('data-pw-action'), formId: form ? form.dataset.pwForm : null, root, handled: false },
      });
      window.dispatchEvent(ev);
      if (!ev.detail.handled && !bound) flash(root, t('form.noproxy', {}, lang));
    }
  });

  window.dispatchEvent(new CustomEvent('puryweb:rendered', { detail: { root, model, plan } }));

  if (p.features && p.features.proxy) {
    try {
      const mod = await import(chrome.runtime.getURL('content/proxy-engine.js'));
      bound = !!(await mod.bind({ root, model, plan, lang }));
    } catch (e) {
      console.warn('[PuryWeb] proxy unavailable', e);
    }
  }
  scroll.focus?.({ preventScroll: true });
  return { close, root, host };
}
