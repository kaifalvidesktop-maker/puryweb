// PuryWeb — background/ai/ai-router.js
// Picks the preferred provider, falls back to any other provider that has a key,
// retries transient errors, and re-asks once if the reply is not a valid plan.

import { PROVIDERS } from '../../shared/storage.js';
import { AIError, withRetry } from './http.js';
import { callProvider } from './providers.js';

export function providerOrder(settings) {
  const pref = settings.provider;
  return [pref, ...PROVIDERS.filter((p) => p !== pref)].filter((p) => settings.apiKeys[p]);
}

const add = (a, b) => ({ in: (a.in || 0) + (b.in || 0), out: (a.out || 0) + (b.out || 0) });

/**
 * @param {{settings:object, system:string, user:string, validate:(text:string)=>any}} o
 * @returns {{value:any, provider:string, model:string, usage:{in:number,out:number}, ms:number, attempts:string[]}}
 */
export async function runAI({ settings, system, user, validate, signal }) {
  const order = providerOrder(settings);
  if (!order.length) throw new AIError('nokey', 'No API key configured');
  const t0 = Date.now();
  const attempts = [];
  let lastErr = null;

  for (const provider of order) {
    const key = settings.apiKeys[provider];
    const model = settings.models[provider];
    let usage = { in: 0, out: 0 };
    try {
      const first = await withRetry(() => callProvider({ provider, key, model, system, user, signal }));
      usage = add(usage, first.usage);
      let value = first.truncated ? null : validate(first.text);
      if (!value) {
        const again = await withRetry(() =>
          callProvider({ provider, key, model, system, user: user + '\n\nReturn ONLY the JSON object described in the schema.', temperature: 0, maxTokens: 8192, signal }));
        usage = add(usage, again.usage);
        value = validate(again.text);
        if (!value) throw new AIError('parse', 'Reply was not a valid plan', { provider });
      }
      attempts.push(`${provider}:ok`);
      return { value, provider, model, usage, ms: Date.now() - t0, attempts };
    } catch (e) {
      lastErr = e instanceof AIError ? e : new AIError('generic', String(e?.message || e), { provider });
      attempts.push(`${provider}:${lastErr.code}`);
      if (signal?.aborted) break;
    }
  }
  if (lastErr) lastErr.attempts = attempts;
  throw lastErr;
}

/** Cheap key check for the API Manager's "Test" button. */
export async function testKey(provider, key, model) {
  try {
    const out = await callProvider({
      provider, key, model, maxTokens: 64, temperature: 0,
      system: 'Reply with a JSON object only.',
      user: 'Return {"ok":true}',
    });
    return { ok: /ok/i.test(out.text) || out.text.length > 0, usage: out.usage };
  } catch (e) {
    return { ok: false, code: e.code || 'generic', message: String(e.message || '').slice(0, 160) };
  }
}
