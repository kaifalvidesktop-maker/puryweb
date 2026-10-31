// PuryWeb — content/purify-client.js
// Content-side entry used by the intent modal (Phase 5): analyze the page, ask the service worker to purify.

import { analyze } from './page-model.js';

/**
 * @param {{intent?:string, promptId?:string, forceId?:string}} opts
 * @returns {Promise<{ok:boolean, plan?:object, model?:object, fallback?:boolean, error?:string, errorMessage?:string, needsKey?:boolean, status?:object, meta?:object}>}
 */
export async function purifyPage({ intent = '', promptId = '', forceId = null } = {}) {
  const result = analyze({ forceId });
  let res;
  try {
    res = await chrome.runtime.sendMessage({
      type: 'PW_PURIFY',
      model: result.model,
      ai: result.ai,
      intent,
      promptId,
      host: result.model.host,
    });
  } catch (e) {
    return { ok: false, error: 'messaging', errorMessage: String((e && e.message) || e) };
  }
  if (!res) return { ok: false, error: 'no-response' };
  return { ...res, model: result.model, detection: result.detection };
}

export function openApiManager() {
  return chrome.runtime.sendMessage({ type: 'PW_OPEN_OS', hash: 'api' });
}
