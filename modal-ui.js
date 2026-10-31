// PuryWeb — content/modal-ui.js
// Shared dark modal shell (Shadow DOM, focus trap, keyboard isolation) + tiny DOM helper.
// Used by the intent dialogue box and the paywall.

import { shuffleTokens, applyTokens } from './shuffle.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Wrap trusted SVG markup (from shared/icons.js) in a span. */
export function svg(markup, cls = '') {
  const s = h('span', { class: 'ico ' + cls, 'aria-hidden': 'true' });
  s.innerHTML = markup;
  return s;
}

export const SHIELD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>';
export const CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const CHECK = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export const WARN = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>';

export const BASE_CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; }
.backdrop { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(10,10,11,.66); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  font-family: Inter, 'Noto Sans Bengali', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; animation: fade .18s ease both; }
.backdrop.out { animation: fadeout .16s ease both; }
.ring { width: min(600px, 100%); padding: 1.5px; border-radius: var(--radius, 20px);
  background: linear-gradient(135deg, var(--from, #FF6B35) 0%, var(--to, #7C3AED) 100%);
  box-shadow: 0 var(--sy, 24px) var(--sb, 64px) rgba(0,0,0,var(--sa, .5)); animation: pop .24s cubic-bezier(.2,.8,.2,1) both; }
.card { background: #141416; border-radius: calc(var(--radius, 20px) - 1.5px); padding: var(--pad, 28px);
  max-height: calc(100vh - 52px); overflow: auto; font-size: 18px; line-height: 1.6; display: flex; flex-direction: column; gap: var(--gap, 16px); }
.head { display: flex; align-items: flex-start; gap: 14px; }
.head .logo { flex: none; transition: transform .5s cubic-bezier(.4,0,.2,1); display: inline-flex; }
.head:hover .logo { transform: rotate(180deg); }
.titles { flex: 1; min-width: 0; }
h2 { font-size: 24px; line-height: 1.3; font-weight: 700; letter-spacing: -.01em; }
.sub { color: #A1A1AA; font-size: 16px; margin-top: 2px; }
.x { appearance: none; border: 0; background: transparent; color: #A1A1AA; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.x:hover { background: #1F1F23; color: #fff; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { appearance: none; border: 1px solid #27272A; background: #0A0A0B; color: #E4E4E7; font: inherit; font-size: 16px; line-height: 1.4;
  padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: border-color .15s, background .15s; text-align: left; }
button.chip:hover { border-color: var(--to, #7C3AED); background: #1A1A1F; }
.chip.info { cursor: default; color: #A1A1AA; font-size: 15px; padding: 4px 12px; }
.chip.accent { border-color: transparent; background: linear-gradient(135deg, var(--from, #FF6B35), var(--to, #7C3AED)); color: #fff; font-weight: 600; }
.label { color: #A1A1AA; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
textarea.input { width: 100%; resize: none; background: #0A0A0B; color: #fff; border: 1px solid #27272A; border-radius: 14px; padding: 16px 18px;
  font: inherit; font-size: 18px; line-height: 1.55; min-height: 104px; transition: border-color .15s, box-shadow .15s; }
textarea.input::placeholder { color: #71717A; }
textarea.input:focus { outline: none; border-color: var(--to, #7C3AED); box-shadow: 0 0 0 3px rgba(124,58,237,.28); }
.count { color: #71717A; font-size: 14px; text-align: right; margin-top: -8px; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.trust { display: inline-flex; align-items: center; gap: 8px; color: #A1A1AA; font-size: 15px; }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.hint { color: #71717A; font-size: 14px; }
.btn { appearance: none; border: 1px solid #27272A; background: #1A1A1F; color: #fff; font: inherit; font-size: 18px; font-weight: 600;
  padding: 13px 24px; border-radius: 12px; cursor: pointer; transition: transform .12s, filter .15s, border-color .15s; }
.btn:hover { border-color: #3F3F46; }
.btn:active { transform: scale(.98); }
.btn.primary { border-color: transparent; background: linear-gradient(135deg, var(--from, #FF6B35) 0%, var(--to, #7C3AED) 100%); }
.btn.primary:hover { filter: brightness(1.1); }
.btn.ghost { background: transparent; color: #A1A1AA; border-color: transparent; font-weight: 500; }
.btn.ghost:hover { color: #fff; }
.btn.block { width: 100%; }
.btn:focus-visible, .chip:focus-visible, .x:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.steps { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; margin: 8px 0; }
.steps li { display: flex; align-items: center; gap: 12px; color: #71717A; transition: color .2s; }
.steps li .dot { width: 12px; height: 12px; border-radius: 50%; background: #27272A; flex: none; }
.steps li.active { color: #fff; } .steps li.active .dot { background: linear-gradient(135deg, var(--from, #FF6B35), var(--to, #7C3AED)); box-shadow: 0 0 0 4px rgba(124,58,237,.25); }
.steps li.done { color: #A1A1AA; } .steps li.done .dot { background: #4ADE80; }
.center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 8px 0; }
.badge-ico { width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--from, #FF6B35), var(--to, #7C3AED)); }
.badge-ico.warn { background: linear-gradient(135deg, #F59E0B, #EA580C); }
.spin { display: inline-flex; animation: rot 1.1s cubic-bezier(.5,0,.5,1) infinite; }
.note { background: #1A1A1F; border: 1px solid #27272A; border-radius: 12px; padding: 12px 16px; font-size: 16px; color: #E4E4E7; width: 100%; text-align: left; }
.note.warn { border-color: #92400E; background: #1C1409; }
.perks { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; text-align: left; width: 100%; }
.perks li { display: flex; gap: 10px; align-items: flex-start; }
.perks li::before { content: ""; width: 10px; height: 10px; margin-top: 10px; border-radius: 50%; flex: none; background: linear-gradient(135deg, var(--from, #FF6B35), var(--to, #7C3AED)); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeout { to { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes rot { to { transform: rotate(360deg); } }
@media (max-width: 520px) { .card { padding: 20px; } h2 { font-size: 21px; } .btn { width: 100%; } .actions { width: 100%; } }
@media (prefers-reduced-motion: reduce) { .backdrop, .backdrop.out, .ring, .spin, .head .logo { animation: none !important; transition: none !important; } }
`;

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Creates the modal shell in a closed-off Shadow DOM.
 * Key events never reach the host page (YouTube/Facebook shortcuts would otherwise swallow typing).
 */
export function createShell({ id, theme = {}, shuffle = true, label = '' }) {
  document.getElementById(id)?.remove();
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
  host.style.setProperty('--from', theme.from || '#FF6B35');
  host.style.setProperty('--to', theme.to || '#7C3AED');
  applyTokens(host, shuffleTokens({ enabled: shuffle, radius: Number(theme.radius) > 0 ? Number(theme.radius) + 6 : 20 }));

  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = BASE_CSS;
  const backdrop = h('div', { class: 'backdrop' });
  const ring = h('div', { class: 'ring', role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
  const card = h('div', { class: 'card' });
  ring.append(card);
  backdrop.append(ring);
  root.append(style, backdrop);

  const prevFocus = document.activeElement;
  const listeners = [];
  let closed = false;

  const close = (reason = 'close') => {
    if (closed) return;
    closed = true;
    backdrop.classList.add('out');
    setTimeout(() => {
      host.remove();
      try {
        prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true });
      } catch {
        /* element gone */
      }
    }, 160);
    listeners.forEach((fn) => fn(reason));
  };

  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(root.querySelectorAll(FOCUSABLE));
    if (!items.length) return;
    const active = root.activeElement;
    const i = items.indexOf(active);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
    e.preventDefault();
    items[next].focus();
  });
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close('backdrop');
  });

  document.documentElement.append(host);
  return {
    host, root, card,
    close,
    onClose: (fn) => listeners.push(fn),
    focusFirst: () => {
      const first = root.querySelector('textarea, .btn.primary, button');
      first && first.focus({ preventScroll: true });
    },
  };
}

export function fmtDuration(ms, t) {
  const total = Math.max(0, Math.round(ms / 60000));
  return t('time.hm', { h: Math.floor(total / 60), m: total % 60 });
}
