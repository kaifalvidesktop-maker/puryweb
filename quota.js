// PuryWeb — background/quota.js
// Free: 3 purifies/day (local day). Paid: unlimited. Failed AI calls are refunded.
// NOTE: client-side license check is a soft gate (checksum only); real enforcement needs a server.

import { storageGet, storageSet, getSettings, patchSettings, withLock, localDay, rid } from '../shared/storage.js';

export const FREE_DAILY_LIMIT = 3;
const KEY = 'quota';
const PENDING_TTL = 10 * 60 * 1000;

export function nextMidnight(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

async function load() {
  const q = await storageGet('local', KEY, null);
  const day = localDay();
  if (!q || q.day !== day) return { day, used: 0, pending: {} };
  return { day, used: q.used || 0, pending: q.pending || {} };
}

function compute(settings, q) {
  const unlimited = settings.plan === 'paid';
  const remaining = unlimited ? null : Math.max(0, FREE_DAILY_LIMIT - q.used);
  return {
    plan: settings.plan,
    unlimited,
    limit: unlimited ? null : FREE_DAILY_LIMIT,
    used: q.used,
    remaining,
    exhausted: !unlimited && remaining <= 0,
    day: q.day,
    resetsAt: nextMidnight(),
  };
}

export async function getStatus() {
  const [settings, q] = await Promise.all([getSettings(), load()]);
  return compute(settings, q);
}

function prune(q) {
  const now = Date.now();
  for (const [tok, ts] of Object.entries(q.pending)) {
    if (now - ts > PENDING_TTL) delete q.pending[tok];
  }
}

/** Reserve one purify. Returns { ok, token, status }. */
export function consume() {
  return withLock('quota', async () => {
    const [settings, q] = await Promise.all([getSettings(), load()]);
    const before = compute(settings, q);
    if (before.exhausted) return { ok: false, token: null, status: before };
    prune(q);
    const token = rid();
    q.pending[token] = Date.now();
    q.used += 1;
    await storageSet('local', KEY, q);
    return { ok: true, token, status: compute(settings, q) };
  });
}

/** Give the purify back (AI/network failure). Only valid for a live token from today. */
export function refund(token) {
  return withLock('quota', async () => {
    const [settings, q] = await Promise.all([getSettings(), load()]);
    if (token && q.pending[token]) {
      delete q.pending[token];
      q.used = Math.max(0, q.used - 1);
      await storageSet('local', KEY, q);
    }
    return compute(settings, q);
  });
}

/** Mark a purify as successful so it can no longer be refunded. */
export function complete(token) {
  return withLock('quota', async () => {
    const [settings, q] = await Promise.all([getSettings(), load()]);
    if (token && q.pending[token]) {
      delete q.pending[token];
      await storageSet('local', KEY, q);
    }
    return compute(settings, q);
  });
}

/* ---------------- license (PW-XXXX-XXXX-XXXX-CCCC) ---------------- */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LICENSE_RE = /^PW-([A-HJ-NP-Z2-9]{4})-([A-HJ-NP-Z2-9]{4})-([A-HJ-NP-Z2-9]{4})-([A-HJ-NP-Z2-9]{4})$/;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function checksum(body) {
  let h = fnv1a('puryweb:' + body);
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ALPHA[h & 31];
    h >>>= 5;
  }
  return out;
}

export function normalizeLicense(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '').trim();
}

export function validateLicense(key) {
  const m = LICENSE_RE.exec(normalizeLicense(key));
  return !!m && checksum(m[1] + m[2] + m[3]) === m[4];
}

/** Vendor helper: generate a valid key (run from the OS page console or a build script). */
export function generateLicense() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = Array.from(bytes, (b) => ALPHA[b & 31]).join('');
  return `PW-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${checksum(body)}`;
}

export async function activateLicense(key) {
  const k = normalizeLicense(key);
  if (!validateLicense(k)) return { ok: false, reason: 'invalid' };
  await patchSettings({ plan: 'paid', license: k });
  return { ok: true };
}

export async function deactivateLicense() {
  await patchSettings({ plan: 'free', license: '' });
  return { ok: true };
}
