// PuryWeb — content/paywall.js
// Bengali paywall (dark): shown when the 3 free purifies of the day are used up.

import { t, setLang, num } from '../shared/i18n.js';
import { recycleSvg } from '../shared/icons.js';
import { createShell, h, svg, SHIELD, CLOSE, fmtDuration } from './modal-ui.js';

const openOS = (hash) => chrome.runtime.sendMessage({ type: 'PW_OPEN_OS', hash }).catch(() => null);

export async function open(msg) {
  setLang(msg.lang || 'bn');
  const shell = createShell({ id: 'puryweb-paywall', theme: msg.theme, shuffle: msg.shuffle !== false, label: t('paywall.title') });
  const { card, close } = shell;
  const status = msg.status || {};
  const limit = status.limit || msg.freeLimit || 3;
  const wait = status.resetsAt ? fmtDuration(Math.max(0, status.resetsAt - Date.now()), t) : '';

  card.append(
    h('div', { class: 'head' },
      svg(recycleSvg({ size: 40 }), 'logo'),
      h('div', { class: 'titles' },
        h('h2', { text: t('paywall.title') }),
        wait ? h('div', { class: 'sub', text: `${t('paywall.resets')} · ${wait}` }) : null),
      h('button', { class: 'x', type: 'button', 'aria-label': t('close.aria'), onclick: () => close() }, svg(CLOSE))),
    h('p', { text: t('paywall.body', { limit }) }),
    h('ul', { class: 'perks' }, ['paywall.perk1', 'paywall.perk2', 'paywall.perk3'].map((k) => h('li', { text: t(k) }))),
    h('div', { class: 'chips' },
      h('span', { class: 'chip info', text: `${t('quota.today')}: ${num(status.used ?? limit)} / ${num(limit)}` })),
    h('button', { class: 'btn primary block', type: 'button', onclick: () => { openOS('upgrade'); close(); }, text: t('paywall.cta') }),
    h('div', { class: 'foot' },
      h('span', { class: 'trust' }, svg(SHIELD), h('span', { text: t('trust.secure') })),
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { openOS('api'); close(); }, text: t('paywall.byok') }),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => close(), text: t('paywall.later') }))));
  shell.card.querySelector('.btn.primary').focus();
  return { close };
}
