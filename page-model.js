// PuryWeb — content/page-model.js
// One call: detect category -> extract model -> build the lean AI payload.

import { detectCategory } from './detector.js';
import { extractPage, compactForAI } from './extractor.js';

/**
 * @param {{doc?:Document, loc?:Location, forceId?:string|null, maxChars?:number}} opts
 */
export function analyze({ doc = document, loc = location, forceId = null, maxChars = 24000 } = {}) {
  const t0 = Date.now();
  const detection = detectCategory(doc, loc, { forceId });
  const model = extractPage(doc, loc, detection);
  const ai = compactForAI(model, maxChars);
  return {
    model,
    ai,
    detection: {
      id: detection.id,
      label: detection.label,
      kind: detection.kind,
      group: detection.group,
      confidence: detection.confidence,
      runnerUp: detection.runnerUp,
      scores: detection.scores,
    },
    ms: Date.now() - t0,
  };
}

/** Small summary that is safe/cheap to send through chrome.runtime messaging. */
export function summarize(result) {
  const { model, detection } = result;
  return {
    category: detection.id,
    label: detection.label,
    kind: detection.kind,
    confidence: detection.confidence,
    blocks: model.stats.blocks,
    forms: model.forms.length,
    fields: model.forms.reduce((n, f) => n + f.fields.length, 0),
    chars: model.stats.chars,
    truncated: model.stats.truncated,
    root: model.stats.root,
    by: model.stats.by,
    ms: result.ms,
  };
}
