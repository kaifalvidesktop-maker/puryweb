// PuryWeb — prompts/prompt-builder.js
// Final Prompt = [SYSTEM_CORE] + [Selected base prompt (or user override)] + [permanent rules]
//              + [USER REQUEST — highest priority] + [PAGE_DATA].
// Also validates the AI reply into a safe plan and builds a no-AI fallback plan.

import { SYSTEM_CORE, LIMITS } from './schema.js';
import { getBasePrompt } from './base-prompts.js';

const MAX_INTENT = 500;
const MAX_RULE = 240;

const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim();
const clip = (s, n) => {
  const t = stripTags(s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/** User text goes into the prompt as data: neutralize our own delimiters and cap length. */
export function sanitizeIntent(text, max = MAX_INTENT) {
  return String(text ?? '').replace(/<<<|>>>|```/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Merge a stored user prompt (same id = override of a built-in, or custom prompt) over the built-in.
 * If the user wrote a free-form `body`, it replaces the three structured fields.
 */
export function resolvePrompt(categoryId, userPrompts = []) {
  const user = userPrompts.find((p) => p.id === categoryId);
  const base = getBasePrompt(categoryId);
  if (!user) return { ...base, source: 'builtin' };
  return {
    id: base.id,
    name: user.name || base.name,
    remove: user.remove || base.remove,
    keep: user.keep || base.keep,
    design: user.design || base.design,
    body: user.body || '',
    source: 'override',
  };
}

function promptSection(p) {
  if (p.body) return `CATEGORY INSTRUCTIONS (${p.name}):\n${p.body}`;
  return `CATEGORY INSTRUCTIONS (${p.name}):\n${p.remove}\n${p.keep}\nDESIGN: ${p.design}`;
}

/**
 * @param {object} o
 * @param {string} o.categoryId
 * @param {object} o.payload   compact page data from compactForAI()
 * @param {string} [o.intent]  the user's dialogue-box text (highest priority)
 * @param {string[]} [o.rules] permanent rules matching this site
 * @param {object[]} [o.userPrompts] prompts saved in the Prompt Lab
 * @param {object} [o.customPrompt]  a specific custom prompt chosen by the user (overrides category)
 */
export function buildPrompt({ categoryId, payload, intent = '', rules = [], userPrompts = [], customPrompt = null }) {
  const prompt = customPrompt ? { ...customPrompt, source: 'custom' } : resolvePrompt(categoryId, userPrompts);
  const cleanIntent = sanitizeIntent(intent);
  const cleanRules = rules.map((r) => sanitizeIntent(r, MAX_RULE)).filter(Boolean).slice(0, 12);

  const parts = [SYSTEM_CORE, promptSection(prompt)];
  if (cleanRules.length) {
    parts.push('PERMANENT USER RULES (apply on every page unless the USER REQUEST says otherwise):\n' + cleanRules.map((r, i) => `${i + 1}. ${r}`).join('\n'));
  }
  const system = parts.join('\n\n');

  const user = [
    cleanIntent
      ? `USER REQUEST — HIGHEST PRIORITY. It overrides the category instructions and permanent rules whenever they conflict (but never the JSON-only output rule or the no-invention rule):\n<<<${cleanIntent}>>>`
      : 'USER REQUEST: none. Follow the category instructions.',
    'PAGE_DATA:',
    JSON.stringify(payload),
  ].join('\n\n');

  return { system, user, meta: { categoryId, promptId: prompt.id, source: prompt.source, hasIntent: !!cleanIntent, rules: cleanRules.length } };
}

/* ---------------- reply parsing & validation ---------------- */

/** Extract a JSON object from a model reply, tolerating fences and stray prose. */
export function parseJsonReply(text) {
  let s = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(s);
  } catch {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(s.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function idSets(model) {
  const blocks = new Set();
  const cards = new Set();
  for (const b of model.blocks) {
    blocks.add(b.id);
    if (b.type === 'cards') for (const c of b.items) cards.add(c.id);
  }
  const fields = new Set();
  const actions = new Set();
  for (const f of model.forms) {
    for (const x of f.fields) fields.add(x.id);
    for (const a of f.actions) actions.add(a.id);
  }
  return { blocks, cards, fields, actions };
}

const uniq = (arr) => Array.from(new Set(arr));
const asArr = (v) => (Array.isArray(v) ? v : []);

/**
 * Turn an untrusted AI reply into a safe, complete plan.
 * - unknown ids are dropped, strings are plain text and length-capped
 * - required fields / primary action / unmentioned blocks are never lost
 */
export function validatePlan(raw, model) {
  const obj = typeof raw === 'string' ? parseJsonReply(raw) : raw;
  if (!obj || typeof obj !== 'object') return null;
  const ids = idSets(model);
  const valid = (id) => ids.blocks.has(id) || ids.cards.has(id);
  const protectedFields = new Set(model.forms.flatMap((f) => f.fields.filter((x) => x.required).map((x) => x.id)));

  const hide = new Set(uniq(asArr(obj.hide).map(String)).filter(valid));
  const used = new Set();
  const sections = [];
  for (const s of asArr(obj.sections).slice(0, LIMITS.sections)) {
    if (!s || typeof s !== 'object') continue;
    const blockIds = uniq(asArr(s.blockIds).map(String)).filter((id) => ids.blocks.has(id) && !hide.has(id) && !used.has(id));
    const fieldIds = uniq(asArr(s.fieldIds).map(String)).filter((id) => ids.fields.has(id));
    blockIds.forEach((id) => used.add(id));
    if (!blockIds.length && !fieldIds.length) continue;
    sections.push({ heading: s.heading ? clip(s.heading, LIMITS.heading) : null, blockIds, fieldIds });
  }
  // Safety net: any block the AI neither used nor hid is kept, in original order.
  const rest = model.blocks.filter((b) => !used.has(b.id) && !hide.has(b.id)).map((b) => b.id);
  if (rest.length) sections.push({ heading: null, blockIds: rest, fieldIds: [] });

  const steps = [];
  const stepUsed = new Set();
  for (const st of asArr(obj.steps).slice(0, LIMITS.steps)) {
    const fieldIds = uniq(asArr(st && st.fieldIds).map(String)).filter((id) => ids.fields.has(id) && !stepUsed.has(id));
    fieldIds.forEach((id) => stepUsed.add(id));
    if (fieldIds.length) steps.push({ title: clip(st.title, LIMITS.heading) || '', fieldIds });
  }
  // Any form field the AI forgot goes into a final step — fields are never dropped.
  const missing = model.forms.flatMap((f) => f.fields.map((x) => x.id)).filter((id) => !stepUsed.has(id));
  if (missing.length) steps.push({ title: steps.length ? '' : 'Form', fieldIds: missing });

  const labels = {};
  if (obj.labels && typeof obj.labels === 'object') {
    for (const [id, v] of Object.entries(obj.labels).slice(0, 400)) {
      if (!ids.fields.has(id) || !v || typeof v !== 'object') continue;
      const label = clip(v.label, LIMITS.label);
      const hint = clip(v.hint, LIMITS.hint);
      if (label || hint) labels[id] = { ...(label ? { label } : {}), ...(hint ? { hint } : {}) };
    }
  }

  const highlights = asArr(obj.highlights).slice(0, LIMITS.highlights).map((h) => ({
    label: clip(h && h.label, LIMITS.highlight), value: clip(h && h.value, LIMITS.highlight * 2),
  })).filter((h) => h.label && h.value);

  let primaryActionId = obj.primaryActionId ? String(obj.primaryActionId) : null;
  if (!primaryActionId || !ids.actions.has(primaryActionId)) {
    primaryActionId = model.forms.map((f) => f.primaryActionId).find(Boolean) || null;
  }

  return {
    title: clip(obj.title, LIMITS.title) || model.meta.title,
    summary: clip(obj.summary, LIMITS.summary),
    sections,
    hide: Array.from(hide),
    highlights,
    labels,
    steps,
    primaryActionId,
    warnings: asArr(obj.warnings).slice(0, LIMITS.warnings).map((w) => clip(w, LIMITS.warning)).filter(Boolean),
    protectedFields: Array.from(protectedFields),
  };
}

/** Plan used when AI is unavailable: show everything, in order, cleanly. */
export function fallbackPlan(model) {
  const hide = [];
  const sections = [{ heading: null, blockIds: model.blocks.map((b) => b.id), fieldIds: [] }];
  const fieldIds = model.forms.flatMap((f) => f.fields.map((x) => x.id));
  return {
    title: model.meta.title,
    summary: '',
    sections,
    hide,
    highlights: [],
    labels: {},
    steps: fieldIds.length ? [{ title: '', fieldIds }] : [],
    primaryActionId: model.forms.map((f) => f.primaryActionId).find(Boolean) || null,
    warnings: [],
    protectedFields: [],
    fallback: true,
  };
}
