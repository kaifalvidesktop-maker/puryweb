// PuryWeb — content/intent-modal.js
// The User Intent Dialogue Box: floating dark modal with an Orange/Violet gradient border.
// Whatever the user types is appended to the final prompt as HIGHEST PRIORITY (see prompt-builder.js).

import { t, setLang, num } from '../shared/i18n.js';
import { recycleSvg } from '../shared/icons.js';
import { createShell, h, svg, SHIELD, CLOSE, CHECK, WARN } from './modal-ui.js';
import { detectCategory } from './detector.js';
import { examplesFor } from './intent-examples.js';
import { purifyPage, openApiManager } from './purify-client.js';
import { open as openPaywall } from './paywall.js';

const MAX = 500;
const ask = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

function detect() {
  try {
    const d = detectCategory(document, location);
    return { id: d.id, label: d.label, kind: d.kind, confidence: d.confidence };
  } catch {
    return { id: 'generic', label: 'Page', kind: 'generic', confidence: 0 };
  }
}

async function tryRenderer(msg, payload) {
  if (!msg.features || !msg.features.renderer) return false;
  try {
    const mod = await import(chrome.runtime.getURL('content/renderer.js'));
    await mod.render(payload);
    return true;
  } catch (e) {
    console.warn('[PuryWeb] renderer failed', e);
    return false;
  }
}

export async function open(msg) {
  setLang(msg.lang || 'bn');
  const shell = createShell({ id: 'puryweb-intent', theme: msg.theme, shuffle: msg.shuffle !== false, label: t('intent.title') });
  const { card, close } = shell;
  const det = detect();
  const recentRes = await ask({ type: 'PW_GET_INTENTS' });
  const recent = ((recentRes && recentRes.items) || []).slice(0, 3);
  let status = msg.status;
  let busy = false;

  /* ---------- shared pieces ---------- */
  const header = (sub) =>
    h('div', { class: 'head' },
      svg(recycleSvg({ size: 40 }), 'logo'),
      h('div', { class: 'titles' }, h('h2', { text: t('intent.title') }), sub ? h('div', { class: 'sub', text: sub }) : null),
      h('button', { class: 'x', type: 'button', 'aria-label': t('close.aria'), onclick: () => close() }, svg(CLOSE)));

  const trust = () => h('span', { class: 'trust' }, svg(SHIELD), h('span', { text: t('trust.secure') }));

  const quotaText = () => (status && status.unlimited ? t('quota.unlimited') : status ? t('quota.left', { n: status.remaining }) : '');

  /* ---------- view: input ---------- */
  function viewInput(prefill = '') {
    card.textContent = '';
    const ta = h('textarea', {
      class: 'input', rows: 3, maxlength: MAX, placeholder: t('intent.placeholder'), 'aria-label': t('intent.title'),
    });
    ta.value = prefill;
    const count = h('div', { class: 'count', text: '' });
    const upd = () => (count.textContent = `${num(ta.value.length)} / ${num(MAX)}`);
    ta.addEventListener('input', upd);
    upd();

    const go = () => submit(ta.value.trim());
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    });

    const fill = (text) => {
      ta.value = text.slice(0, MAX);
      upd();
      ta.focus();
    };
    const chip = (text) => h('button', { class: 'chip', type: 'button', onclick: () => fill(text), text });
    const examples = examplesFor(det.kind, msg.lang || 'bn');
    const recents = recent.filter((r) => !examples.includes(r));

    const meta = h('div', { class: 'chips' },
      h('span', { class: 'chip info', text: `${t('intent.detected')}: ${det.label}` }),
      quotaText() ? h('span', { class: 'chip info', text: quotaText() }) : null);

    card.append(
      header(null),
      meta,
      ta,
      count,
      h('div', { class: 'label', text: t('intent.examples') }),
      h('div', { class: 'chips' }, examples.map(chip)),
      recents.length ? h('div', { class: 'label', text: t('intent.recent') }) : null,
      recents.length ? h('div', { class: 'chips' }, recents.map(chip)) : null,
      h('div', { class: 'foot' },
        trust(),
        h('div', { class: 'actions' },
          h('span', { class: 'hint', text: t('intent.shortcut') }),
          h('button', { class: 'btn primary', type: 'button', onclick: go, text: t('intent.submit') }))));
    shell.focusFirst();
    ta.focus();
  }

  /* ---------- view: busy ---------- */
  function viewBusy(step) {
    card.textContent = '';
    const names = ['busy.read', 'busy.ai', 'busy.build'];
    const items = names.map((k, i) =>
      h('li', { class: i < step ? 'done' : i === step ? 'active' : '' }, h('span', { class: 'dot' }), h('span', { text: t(k) })));
    card.append(
      h('div', { class: 'center' }, h('span', { class: 'spin' }, svg(recycleSvg({ size: 56 }))), h('h2', { text: t('busy.title') })),
      h('ol', { class: 'steps', 'aria-live': 'polite' }, items),
      h('div', { class: 'foot' }, trust(), h('button', { class: 'btn ghost', type: 'button', onclick: () => close(), text: t('btn.close') })));
  }

  /* ---------- view: result ---------- */
  function viewDone(res, intent) {
    card.textContent = '';
    const plan = res.plan;
    const fields = (plan.steps || []).reduce((n, s) => n + s.fieldIds.length, 0);
    const stats = t('done.stats', { sections: plan.sections.length, hidden: plan.hide.length, fields });
    const note = [];
    if (res.fallback) {
      note.push(h('div', { class: 'note warn', role: 'alert', text: res.errorMessage || t('err.generic') }));
      note.push(h('div', { class: 'sub', text: t('done.fallback') }));
    } else {
      if (plan.title) note.push(h('div', { class: 'note', text: plan.title }));
      note.push(h('div', { class: 'sub', text: stats }));
      if (res.meta && res.meta.cached) note.push(h('div', { class: 'sub', text: t('done.cached') }));
    }
    const actions = [];
    if (res.fallback && res.needsKey) {
      actions.push(h('button', { class: 'btn primary', type: 'button', onclick: () => { openApiManager(); close(); }, text: t('btn.addkey') }));
    } else if (res.fallback) {
      actions.push(h('button', { class: 'btn primary', type: 'button', onclick: () => viewInput(intent), text: t('btn.retry') }));
    } else {
      actions.push(h('button', { class: 'btn primary', type: 'button', onclick: () => close(), text: t('btn.show') }));
    }
    card.append(
      h('div', { class: 'center' },
        h('span', { class: 'badge-ico' + (res.fallback ? ' warn' : '') }, svg(res.fallback ? WARN : CHECK)),
        h('h2', { text: res.fallback ? t('done.partial') : t('done.title') }),
        note),
      h('div', { class: 'foot' }, trust(), h('div', { class: 'actions' }, actions)));
    shell.card.querySelector('.btn.primary')?.focus();
  }

  /* ---------- view: error ---------- */
  function viewError(text, intent) {
    card.textContent = '';
    card.append(
      h('div', { class: 'center' },
        h('span', { class: 'badge-ico warn' }, svg(WARN)),
        h('h2', { text: t('err.generic') }),
        h('div', { class: 'note warn', role: 'alert', text })),
      h('div', { class: 'foot' }, trust(),
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => close(), text: t('btn.close') }),
          h('button', { class: 'btn primary', type: 'button', onclick: () => viewInput(intent), text: t('btn.retry') }))));
    shell.card.querySelector('.btn.primary')?.focus();
  }

  /* ---------- flow ---------- */
  async function submit(intent) {
    if (busy) return;
    busy = true;
    if (intent) ask({ type: 'PW_SAVE_INTENT', text: intent });
    viewBusy(0);
    await new Promise((r) => setTimeout(r, 30)); // let the busy view paint before the heavy DOM scan
    let res;
    try {
      viewBusy(1);
      res = await purifyPage({ intent });
    } catch (e) {
      busy = false;
      return viewError(String((e && e.message) || e), intent);
    }
    busy = false;

    if (!res || res.ok === false) {
      if (res && res.error === 'quota') {
        close();
        return openPaywall({ ...msg, status: res.status });
      }
      return viewError((res && (res.errorMessage || res.error)) || t('err.generic'), intent);
    }
    status = res.status || status;
    viewBusy(2);
    const payload = { plan: res.plan, model: res.model, fallback: !!res.fallback, meta: res.meta || {}, intent };
    window.__PW_LAST__ = payload;
    window.dispatchEvent(new CustomEvent('puryweb:plan-ready', { detail: payload }));
    if (!res.fallback && (await tryRenderer(msg, payload))) return close('rendered');
    viewDone(res, intent);
  }

  viewInput();
  return { close };
}
