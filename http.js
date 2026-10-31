// PuryWeb — background/ai/http.js
// fetch with timeout, error classification, and exponential-backoff retry.

export class AIError extends Error {
  constructor(code, message, { status = 0, retryAfter = 0, provider = '' } = {}) {
    super(message || code);
    this.name = 'AIError';
    this.code = code; // key | nokey | rate | billing | network | model | blocked | parse | generic
    this.status = status;
    this.retryAfter = retryAfter;
    this.provider = provider;
  }
}

const RETRYABLE = new Set(['rate', 'network']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function classify(status, data, retryAfterHeader) {
  const raw = data?.error?.message || data?.error?.status || data?.message || '';
  const msg = String(raw).slice(0, 300);
  const retryAfter = Math.min(30, parseFloat(retryAfterHeader) || 0);
  const opts = { status, retryAfter };
  if (status === 401 || status === 403) return new AIError('key', msg || 'Unauthorized', opts);
  if (status === 400 && /api[_ -]?key|x-api-key|credential/i.test(msg)) return new AIError('key', msg, opts);
  if (status === 429 && /insufficient_quota|billing|credit|exceeded your current quota/i.test(msg)) return new AIError('billing', msg, opts);
  if (status === 429) return new AIError('rate', msg || 'Rate limited', opts);
  if (status === 404 || (status === 400 && /model/i.test(msg))) return new AIError('model', msg, opts);
  if (status === 408 || status >= 500) return new AIError('network', msg || `HTTP ${status}`, opts);
  return new AIError('generic', msg || `HTTP ${status}`, opts);
}

export async function postJson(url, { headers = {}, body, timeoutMs = 28000, signal } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      throw new AIError('network', ctl.signal.aborted ? 'Request timed out' : String(e?.message || e));
    }
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) throw classify(res.status, data, res.headers.get('retry-after'));
    if (!data) throw new AIError('parse', 'Provider returned non-JSON');
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function withRetry(fn, { attempts = 3, base = 800, onRetry } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn(i);
    } catch (e) {
      if (!(e instanceof AIError) || !RETRYABLE.has(e.code) || i >= attempts - 1) throw e;
      const wait = Math.min(8000, Math.max(e.retryAfter * 1000, base * 2 ** i) + Math.random() * 250);
      onRetry?.(e, i + 1, wait);
      await sleep(wait);
    }
  }
}
