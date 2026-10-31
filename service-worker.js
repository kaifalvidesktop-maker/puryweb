// PuryWeb — background/service-worker.js
// Entry point: toolbar click -> intent dialogue / paywall, quota messaging, badge, menus, alarms.

import {
  initStorage, getSettings, patchSettings, publicSettings, recordPurify, getRulesFor, onChange, storageGet, storageSet,
} from '../shared/storage.js';
import { getStatus, consume, refund, complete, FREE_DAILY_LIMIT, nextMidnight } from './quota.js';
import { setActionIcon, spinIcon } from './icon-render.js';
import { recycleSvg } from '../shared/icons.js';
import { t } from '../shared/i18n.js';
import { purify } from './purify-pipeline.js';
import { testKey } from './ai/ai-router.js';

// Intent modal + paywall ship in Phase 5; flip `renderer` when content/renderer.js ships (Phase 6).
const FEATURES = { intentModal: true, paywallModal: true, renderer: true, proxy: true };

const OS_URL = chrome.runtime.getURL('os/os.html');
const RESTRICTED = /^(chrome|chrome-extension|edge|about|devtools|view-source|chrome-search|chrome-untrusted):/i;
const STORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

const isRestricted = (url) => !url || RESTRICTED.test(url) || STORE.test(url);

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/* ---------------- OS page ---------------- */
async function openOS(hash = '') {
  const target = OS_URL + (hash ? '#' + hash : '');
  const tabs = await chrome.tabs.query({ url: OS_URL + '*' });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { url: target, active: true });
    if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: target });
  }
}

/* ---------------- badge ---------------- */
async function refreshBadge() {
  const [s, settings] = await Promise.all([getStatus(), getSettings()]);
  await chrome.action.setBadgeText({ text: s.unlimited ? '∞' : String(s.remaining) });
  await chrome.action.setBadgeBackgroundColor({ color: s.exhausted ? '#52525B' : '#FF6B35' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  const title = s.unlimited
    ? t('action.title.unlimited', {}, settings.lang)
    : t('action.title.left', { n: s.remaining }, settings.lang);
  await chrome.action.setTitle({ title });
}

function scheduleMidnight() {
  chrome.alarms.create('pw-midnight', { when: nextMidnight() + 1000 });
}

/* ---------------- tab messaging ---------------- */
async function sendToTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/bridge.js'] });
    return chrome.tabs.sendMessage(tabId, msg);
  }
}

async function toast(tabId, message) {
  try {
    await sendToTab(tabId, { type: 'PW_TOAST', message, iconSvg: recycleSvg({ size: 28 }) });
  } catch {
    /* page not reachable — ignore */
  }
}

/* ---------------- toolbar click ---------------- */
async function onActionClick(tab) {
  spinIcon().catch(() => {});
  try {
    const settings = await getSettings();
    if (!tab?.id || isRestricted(tab.url)) {
      await openOS('dashboard');
      return;
    }
    const status = await getStatus();
    const type = status.exhausted ? 'PW_OPEN_PAYWALL' : 'PW_OPEN_INTENT';
    const message = status.exhausted
      ? t('paywall.title', {}, settings.lang)
      : status.unlimited
        ? t('toast.ready.unlimited', {}, settings.lang)
        : t('toast.ready', { n: status.remaining }, settings.lang);
    await sendToTab(tab.id, {
      type,
      status,
      message,
      lang: settings.lang,
      features: FEATURES,
      theme: settings.theme,
      shuffle: settings.shuffle,
      freeLimit: FREE_DAILY_LIMIT,
      iconSvg: recycleSvg({ size: 28 }),
      page: { url: tab.url, host: hostOf(tab.url), title: tab.title || '' },
    });
  } catch (e) {
    console.warn('[PuryWeb] action click failed', e);
    await openOS('dashboard');
  }
}

chrome.action.onClicked.addListener(onActionClick);

/* ---------------- context menus ---------------- */
function buildMenus(lang) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'pw-purify', title: t('menu.purify', {}, lang), contexts: ['page', 'action'] });
    chrome.contextMenus.create({ id: 'pw-os', title: t('menu.os', {}, lang), contexts: ['page', 'action'] });
    chrome.contextMenus.create({ id: 'pw-site', title: t('menu.site.toggle', {}, lang), contexts: ['page'] });
    chrome.contextMenus.create({ id: 'pw-analyze', title: t('menu.analyze', {}, lang), contexts: ['page'] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'pw-purify') return onActionClick(tab);
  if (info.menuItemId === 'pw-os') return openOS('dashboard');
  if (info.menuItemId === 'pw-analyze' && tab?.id && !isRestricted(tab.url)) {
    const settings = await getSettings();
    try {
      const r = await sendToTab(tab.id, { type: 'PW_ANALYZE' });
      const msg = r && r.ok
        ? t('toast.category', { cat: r.summary.label, pct: Math.round(r.summary.confidence * 100) }, settings.lang)
        : t('err.generic', {}, settings.lang);
      await toast(tab.id, msg);
    } catch (e) {
      await toast(tab.id, t('err.generic', {}, settings.lang));
    }
    return;
  }
  if (info.menuItemId === 'pw-site' && tab?.id && !isRestricted(tab.url)) {
    const host = hostOf(tab.url);
    const settings = await getSettings();
    const off = settings.disabledSites.includes(host);
    const next = off ? settings.disabledSites.filter((h) => h !== host) : [...settings.disabledSites, host];
    await patchSettings({ disabledSites: next });
    await toast(tab.id, t(off ? 'toast.site.purify' : 'toast.site.original', { host }, settings.lang));
  }
});

/* ---------------- messages from content scripts / pages ---------------- */
const handlers = {
  async PW_GET_SETTINGS() {
    return { ok: true, settings: publicSettings(await getSettings()) };
  },
  async PW_QUOTA_STATUS() {
    return { ok: true, status: await getStatus() };
  },
  async PW_QUOTA_CONSUME() {
    const r = await consume();
    refreshBadge().catch(() => {});
    return r;
  },
  async PW_QUOTA_REFUND(m) {
    const status = await refund(String(m.token || ''));
    refreshBadge().catch(() => {});
    return { ok: true, status };
  },
  async PW_QUOTA_COMPLETE(m) {
    return { ok: true, status: await complete(String(m.token || '')) };
  },
  async PW_RECORD_PURIFY(m) {
    const stats = await recordPurify({
      category: String(m.category || 'unknown').slice(0, 40),
      host: String(m.host || '').slice(0, 120),
      secondsSaved: Number(m.secondsSaved) || 45,
    });
    return { ok: true, purified: stats.purified };
  },
  async PW_GET_RULES(m) {
    const rules = await getRulesFor(String(m.host || ''));
    return { ok: true, rules: rules.map((r) => r.text) };
  },
  async PW_GET_INTENTS() {
    return { ok: true, items: await storageGet('local', 'intents', []) };
  },
  async PW_SAVE_INTENT(m) {
    const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return { ok: true };
    const list = (await storageGet('local', 'intents', [])).filter((x) => x !== text);
    await storageSet('local', 'intents', [text, ...list].slice(0, 8));
    return { ok: true };
  },
  async PW_RESUME_SAVE(m, sender) {
    if (!sender.tab || !m.record || JSON.stringify(m.record).length > 150000) return { ok: false };
    await chrome.storage.session.set({ ['pw:resume:' + sender.tab.id]: { ...m.record, ts: Date.now() } });
    return { ok: true };
  },
  async PW_RESUME_TAKE(m, sender) {
    if (!sender.tab) return { ok: false };
    const key = 'pw:resume:' + sender.tab.id;
    const rec = (await chrome.storage.session.get(key))[key];
    if (!rec) return { ok: true, record: null };
    await chrome.storage.session.remove(key);
    if (Date.now() - rec.ts > 20000 || rec.path !== String(m.path || '')) return { ok: true, record: null };
    const s = await getSettings();
    return { ok: true, record: rec, ctx: { lang: s.lang, theme: s.theme, shuffle: s.shuffle, features: FEATURES, fallback: false, meta: {} } };
  },
  async PW_POSTBACK(m, sender) {
    if (!sender.tab) return { ok: false, ran: false };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: (target, arg) => {
        if (typeof window.__doPostBack !== 'function') return false;
        window.__doPostBack(target, arg);
        return true;
      },
      args: [String(m.target || '').slice(0, 300), String(m.arg || '').slice(0, 300)],
    });
    return { ok: true, ran: !!(res && res.result) };
  },
  async PW_PURIFY(m) {
    const r = await purify(m);
    refreshBadge().catch(() => {});
    return r;
  },
  async PW_TEST_KEY(m, sender) {
    if (!sender.url || !sender.url.startsWith(chrome.runtime.getURL(''))) return { ok: false, error: 'forbidden' };
    return testKey(String(m.provider), String(m.key || ''), String(m.model || ''));
  },
  async PW_OPEN_OS(m) {
    await openOS(String(m.hash || '').replace(/[^\w-]/g, ''));
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return false;
  const fn = handlers[msg.type];
  if (!fn) return false;
  fn(msg, sender)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true; // async response
});

/* ---------------- lifecycle ---------------- */
async function bootstrap() {
  const settings = await initStorage();
  await setActionIcon(0).catch(() => {});
  await refreshBadge().catch(() => {});
  buildMenus(settings.lang);
  scheduleMidnight();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await bootstrap();
  if (details.reason === 'install') await openOS('welcome');
});

chrome.runtime.onStartup.addListener(bootstrap);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pw-midnight') {
    refreshBadge().catch(() => {});
    scheduleMidnight();
  }
});

onChange(async ({ key }) => {
  if (key === 'settings' || key === 'quota') {
    refreshBadge().catch(() => {});
  }
  if (key === 'settings') {
    const s = await getSettings();
    buildMenus(s.lang);
  }
});

// Service workers are re-created on demand: make the toolbar state correct on every wake-up.
setActionIcon(0).catch(() => {});
refreshBadge().catch(() => {});
