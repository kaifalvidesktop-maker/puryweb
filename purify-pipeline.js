// PuryWeb — background/purify-pipeline.js
// One request from a page -> quota -> prompt -> AI -> validated plan (or graceful fallback).
// A failed AI call never costs the user a purify: the quota is refunded and the clean fallback plan is returned.

import { getSettings, listPrompts, recordPurify, getRulesFor } from '../shared/storage.js';
import { getStatus, consume, refund, complete } from './quota.js';
import { runAI } from './ai/ai-router.js';
import { buildPrompt, validatePlan, fallbackPlan } from '../prompts/prompt-builder.js';
import { t } from '../shared/i18n.js';

const CACHE_KEY = 'pw:plan-cache';
const CACHE_MAX = 12;
const CACHE_TTL = 15 * 60 * 1000;
const MAX_PAYLOAD = 80000;
const SECONDS_BY_KIND = { form: 120, checkout: 90, result: 60, notice: 60, product: 60, article: 45, feed: 40, listing: 40 };

const ERR_KEY = {
  key: 'err.key', nokey: 'err.nokey', rate: 'err.rate', network: 'err.network', parse: 'err.parse',
  billing: 'err.billing', model: 'err.model', blocked: 'err.blocked', generic: 'err.generic',
};

function hash(str) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0') + str.length.toString(16);
}

async function cacheGet(key) {
  try {
    const r = (await chrome.storage.session.get(CACHE_KEY))[CACHE_KEY];
    const hit = r?.items?.[key];
    return hit && Date.now() - hit.ts < CACHE_TTL ? hit : null;
  } catch {
    return null;
  }
}

async function cachePut(key, value) {
  try {
    const cur = (await chrome.storage.session.get(CACHE_KEY))[CACHE_KEY] || { order: [], items: {} };
    cur.items[key] = { ...value, ts: Date.now() };
    cur.order = [key, ...cur.order.filter((k) => k !== key)];
    for (const old of cur.order.splice(CACHE_MAX)) delete cur.items[old];
    await chrome.storage.session.set({ [CACHE_KEY]: cur });
  } catch {
    /* cache is best-effort */
  }
}

function validShape(m) {
  return m && typeof m === 'object' && m.model && Array.isArray(m.model.blocks) && Array.isArray(m.model.forms) &&
    m.ai && typeof m.ai === 'object' && m.model.category && typeof m.model.category.id === 'string';
}

/**
 * @param {{model:object, ai:object, intent?:string, promptId?:string, host?:string}} msg
 */
export async function purify(msg) {
  if (!validShape(msg)) return { ok: false, error: 'bad-request' };
  const { model, ai } = msg;
  if (JSON.stringify(ai).length > MAX_PAYLOAD) return { ok: false, error: 'too-large' };

  const settings = await getSettings();
  const lang = settings.lang;
  const host = String(msg.host || model.host || '').slice(0, 120);
  const [userPrompts, rules] = await Promise.all([listPrompts(), getRulesFor(host)]);
  const custom = msg.promptId ? userPrompts.find((p) => p.id === msg.promptId && !p.builtin && p.id !== model.category.id) : null;

  const prompt = buildPrompt({
    categoryId: model.category.id,
    payload: ai,
    intent: msg.intent || '',
    rules: rules.map((r) => r.text),
    userPrompts,
    customPrompt: custom || null,
  });

  const cacheId = hash(prompt.system + '\u0001' + prompt.user + '\u0001' + settings.provider + settings.models[settings.provider]);
  const cached = await cacheGet(cacheId);
  if (cached) {
    return { ok: true, plan: cached.plan, fallback: false, meta: { ...cached.meta, cached: true }, status: await getStatus() };
  }

  const reservation = await consume();
  if (!reservation.ok) return { ok: false, error: 'quota', status: reservation.status };
  const token = reservation.token;

  try {
    const result = await runAI({
      settings,
      system: prompt.system,
      user: prompt.user,
      validate: (text) => validatePlan(text, model),
    });
    await complete(token);
    const meta = { provider: result.provider, model: result.model, ms: result.ms, usage: result.usage, prompt: prompt.meta, cached: false };
    await cachePut(cacheId, { plan: result.value, meta });
    await recordPurify({ category: model.category.id, host, secondsSaved: SECONDS_BY_KIND[model.category.kind] || 45 });
    return { ok: true, plan: result.value, fallback: false, meta, status: await getStatus() };
  } catch (e) {
    const code = e?.code || 'generic';
    const status = await refund(token); // no charge for a failed purify
    return {
      ok: true,
      plan: fallbackPlan(model),
      fallback: true,
      error: code,
      errorMessage: t(ERR_KEY[code] || 'err.generic', {}, lang),
      needsKey: code === 'nokey' || code === 'key',
      meta: { attempts: e?.attempts || [], prompt: prompt.meta, cached: false },
      status,
    };
  }
}
