// PuryWeb — shared/storage.js
// Typed, namespaced wrapper over chrome.storage (sync: settings/rules/prompts, local: quota/stats).

export const NS = 'pw:';
const ITEM_LIMIT = 7600; // chrome.storage.sync allows 8192 bytes per item
export const PROVIDERS = Object.freeze(['gemini', 'openai', 'claude']);

export const DEFAULT_SETTINGS = {
  schema: 1,
  lang: 'bn',
  plan: 'free',
  license: '',
  provider: 'gemini',
  models: { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', claude: 'claude-sonnet-4-5' },
  apiKeys: { gemini: '', openai: '', claude: '' },
  shuffle: true,
  trustBadge: true,
  fontScale: 1,
  disabledSites: [],
  theme: { from: '#FF6B35', to: '#7C3AED', base: '#0A0A0B', card: '#141416', border: '#27272A', radius: 14 },
};

export class StorageError extends Error {
  constructor(message, code = 'storage') {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

const clone = (v) => (v === undefined ? v : structuredClone(v));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;

export function rid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deepMerge(base, patch) {
  const out = clone(base);
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

/* ---------- serialized read-modify-write (per context) ---------- */
const locks = new Map();
export function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const run = prev.then(fn);
  locks.set(name, run.catch(() => {}));
  return run;
}

/* ---------- raw access ---------- */
const sizeOf = (key, value) => new TextEncoder().encode(JSON.stringify(value) ?? '').length + NS.length + key.length;

export async function storageGet(area, key, fallback) {
  const k = NS + key;
  const r = await chrome.storage[area].get(k);
  return r[k] === undefined ? clone(fallback) : r[k];
}

export async function storageSet(area, key, value) {
  const size = sizeOf(key, value);
  if (area === 'sync' && size > ITEM_LIMIT) {
    throw new StorageError(`"${key}" is ${size}B, limit is ${ITEM_LIMIT}B`, 'too-large');
  }
  try {
    await chrome.storage[area].set({ [NS + key]: value });
  } catch (e) {
    const msg = e?.message || 'write failed';
    throw new StorageError(msg, /quota/i.test(msg) ? 'quota' : 'write');
  }
}

export async function storageRemove(area, key) {
  await chrome.storage[area].remove(NS + key);
}

/* ---------- settings ---------- */
function validateSettings(s) {
  const d = DEFAULT_SETTINGS;
  const out = clone(s);
  if (!['bn', 'en'].includes(out.lang)) out.lang = d.lang;
  if (!['free', 'paid'].includes(out.plan)) out.plan = d.plan;
  if (!PROVIDERS.includes(out.provider)) out.provider = d.provider;
  out.shuffle = !!out.shuffle;
  out.trustBadge = !!out.trustBadge;
  out.fontScale = Math.min(1.5, Math.max(0.9, Number(out.fontScale) || 1));
  out.license = String(out.license || '').slice(0, 40);
  for (const p of PROVIDERS) {
    out.apiKeys[p] = String(out.apiKeys[p] ?? '').trim().slice(0, 256);
    out.models[p] = String(out.models[p] || d.models[p]).trim().slice(0, 80);
  }
  for (const k of ['from', 'to', 'base', 'card', 'border']) {
    if (!HEX.test(out.theme[k])) out.theme[k] = d.theme[k];
  }
  out.theme.radius = Math.min(32, Math.max(0, Number(out.theme.radius) || d.theme.radius));
  const seen = new Set();
  out.disabledSites = (Array.isArray(out.disabledSites) ? out.disabledSites : [])
    .map((h) => String(h).toLowerCase().trim())
    .filter((h) => h && !seen.has(h) && seen.add(h))
    .slice(0, 120);
  return out;
}

export async function getSettings() {
  const stored = await storageGet('sync', 'settings', {});
  return validateSettings(deepMerge(DEFAULT_SETTINGS, stored));
}

export function patchSettings(patch) {
  return withLock('settings', async () => {
    const next = validateSettings(deepMerge(await getSettings(), patch));
    await storageSet('sync', 'settings', next);
    return next;
  });
}

export async function initStorage() {
  const raw = await storageGet('sync', 'settings', null);
  if (raw === null) {
    await storageSet('sync', 'settings', validateSettings(clone(DEFAULT_SETTINGS)));
  }
  const stats = await storageGet('local', 'stats', null);
  if (stats === null) await storageSet('local', 'stats', { ...EMPTY_STATS, firstUse: Date.now() });
  return getSettings();
}

/** Settings safe to hand to web-page contexts: never contains API keys or the license. */
export function publicSettings(s) {
  return {
    lang: s.lang,
    plan: s.plan,
    provider: s.provider,
    models: s.models,
    shuffle: s.shuffle,
    trustBadge: s.trustBadge,
    fontScale: s.fontScale,
    theme: s.theme,
    disabledSites: s.disabledSites,
    hasKey: Object.fromEntries(PROVIDERS.map((p) => [p, !!s.apiKeys[p]])),
  };
}

/* ---------- prompts (user prompts + overrides of built-in ids) ---------- */
const PID = /^[a-z0-9_-]{2,48}$/i;
const MAX_PROMPTS = 100;

function cleanPrompt(p) {
  const name = String(p?.name || '').trim().slice(0, 80);
  if (!name) throw new StorageError('Prompt name is required', 'invalid');
  const str = (v, n) => String(v ?? '').slice(0, n);
  return {
    id: PID.test(p.id || '') ? p.id : 'u_' + rid(),
    name,
    category: str(p.category, 40).trim() || 'custom',
    remove: str(p.remove, 1500),
    keep: str(p.keep, 1500),
    design: str(p.design, 1500),
    body: str(p.body, 4000),
    baseId: str(p.baseId, 48),
    createdAt: p.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

export async function listPrompts() {
  const idx = await storageGet('sync', 'p:index', []);
  if (!idx.length) return [];
  const r = await chrome.storage.sync.get(idx.map((i) => NS + 'p:' + i));
  return idx.map((i) => r[NS + 'p:' + i]).filter(Boolean);
}

export function savePrompt(p) {
  return withLock('prompts', async () => {
    const clean = cleanPrompt(p);
    const idx = await storageGet('sync', 'p:index', []);
    if (!idx.includes(clean.id)) {
      if (idx.length >= MAX_PROMPTS) throw new StorageError(`Max ${MAX_PROMPTS} prompts`, 'limit');
      idx.push(clean.id);
    }
    await storageSet('sync', 'p:' + clean.id, clean);
    await storageSet('sync', 'p:index', idx);
    return clean;
  });
}

export function duplicatePrompt(p, suffix = ' (copy)') {
  return savePrompt({ ...p, id: '', baseId: p.id || '', name: String(p.name || 'Prompt').slice(0, 70) + suffix, createdAt: Date.now() });
}

export function deletePrompt(id) {
  return withLock('prompts', async () => {
    const idx = (await storageGet('sync', 'p:index', [])).filter((i) => i !== id);
    await storageRemove('sync', 'p:' + id);
    await storageSet('sync', 'p:index', idx);
    return true;
  });
}

/* ---------- permanent rules ---------- */
const MAX_RULES = 80;

export function normHost(h) {
  const s = String(h || '*').trim().toLowerCase();
  if (!s || s === '*') return '*';
  return s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split('/')[0];
}

export const listRules = () => storageGet('sync', 'rules', []);

export function addRule({ text, host = '*', enabled = true }) {
  return withLock('rules', async () => {
    const rules = await listRules();
    const t = String(text || '').trim().slice(0, 240);
    if (!t) throw new StorageError('Rule text is required', 'invalid');
    if (rules.length >= MAX_RULES) throw new StorageError(`Max ${MAX_RULES} rules`, 'limit');
    const rule = { id: 'r_' + rid(), text: t, host: normHost(host), enabled: !!enabled, createdAt: Date.now() };
    rules.push(rule);
    await storageSet('sync', 'rules', rules);
    return rule;
  });
}

export function updateRule(id, patch) {
  return withLock('rules', async () => {
    const rules = await listRules();
    const i = rules.findIndex((r) => r.id === id);
    if (i < 0) throw new StorageError('Rule not found', 'missing');
    const r = { ...rules[i] };
    if ('text' in patch) r.text = String(patch.text || '').trim().slice(0, 240) || r.text;
    if ('host' in patch) r.host = normHost(patch.host);
    if ('enabled' in patch) r.enabled = !!patch.enabled;
    rules[i] = r;
    await storageSet('sync', 'rules', rules);
    return r;
  });
}

export function removeRule(id) {
  return withLock('rules', async () => {
    const rules = (await listRules()).filter((r) => r.id !== id);
    await storageSet('sync', 'rules', rules);
    return true;
  });
}

export async function getRulesFor(host) {
  const h = normHost(host);
  return (await listRules()).filter(
    (r) => r.enabled && (r.host === '*' || h === r.host || h.endsWith('.' + r.host))
  );
}

/* ---------- stats ---------- */
const EMPTY_STATS = { purified: 0, secondsSaved: 0, byCategory: {}, byHost: {}, daily: {}, firstUse: 0 };

export async function getStats() {
  return deepMerge(EMPTY_STATS, await storageGet('local', 'stats', {}));
}

export function recordPurify({ category = 'unknown', host = '', secondsSaved = 45 } = {}) {
  return withLock('stats', async () => {
    const s = await getStats();
    const day = localDay();
    s.purified += 1;
    s.secondsSaved += Math.max(0, Math.min(600, Number(secondsSaved) || 0));
    s.byCategory[category] = (s.byCategory[category] || 0) + 1;
    if (host) s.byHost[normHost(host)] = (s.byHost[normHost(host)] || 0) + 1;
    s.daily[day] = (s.daily[day] || 0) + 1;
    s.firstUse = s.firstUse || Date.now();
    const days = Object.keys(s.daily).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 60))) delete s.daily[d];
    const hosts = Object.entries(s.byHost).sort((a, b) => b[1] - a[1]);
    s.byHost = Object.fromEntries(hosts.slice(0, 50));
    await storageSet('local', 'stats', s);
    return s;
  });
}

export async function resetStats() {
  await storageSet('local', 'stats', { ...EMPTY_STATS, firstUse: Date.now() });
}

/* ---------- change feed ---------- */
export function onChange(cb) {
  const fn = (changes, area) => {
    for (const [k, v] of Object.entries(changes)) {
      if (k.startsWith(NS)) cb({ key: k.slice(NS.length), area, newValue: v.newValue, oldValue: v.oldValue });
    }
  };
  chrome.storage.onChanged.addListener(fn);
  return () => chrome.storage.onChanged.removeListener(fn);
}

/* ---------- backup ---------- */
export async function exportAll({ includeSecrets = false } = {}) {
  const settings = await getSettings();
  if (!includeSecrets) {
    delete settings.apiKeys;
    delete settings.license;
  }
  return {
    app: 'puryweb',
    schema: 1,
    exportedAt: new Date().toISOString(),
    settings,
    rules: await listRules(),
    prompts: await listPrompts(),
    stats: await getStats(),
  };
}

export async function importAll(data) {
  if (!isObj(data) || data.app !== 'puryweb') throw new StorageError('Not a PuryWeb backup', 'invalid');
  const out = { settings: false, rules: 0, prompts: 0 };
  if (isObj(data.settings)) {
    const incoming = { ...data.settings };
    delete incoming.plan; // plan is only changed by license activation
    delete incoming.license;
    await patchSettings(incoming);
    out.settings = true;
  }
  if (Array.isArray(data.rules)) {
    const rules = data.rules.slice(0, MAX_RULES).map((r) => ({
      id: 'r_' + rid(),
      text: String(r.text || '').trim().slice(0, 240),
      host: normHost(r.host),
      enabled: r.enabled !== false,
      createdAt: Date.now(),
    })).filter((r) => r.text);
    await storageSet('sync', 'rules', rules);
    out.rules = rules.length;
  }
  if (Array.isArray(data.prompts)) {
    for (const p of data.prompts.slice(0, MAX_PROMPTS)) {
      try {
        await savePrompt(p);
        out.prompts += 1;
      } catch (e) {
        if (e?.code === 'limit') break;
      }
    }
  }
  return out;
}
