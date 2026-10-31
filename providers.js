// PuryWeb — background/ai/providers.js
// Thin adapters for Gemini, OpenAI and Claude. Keys never leave the service worker.

import { AIError, postJson } from './http.js';

export const MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4.1'],
  claude: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-haiku-5-5', 'claude-sonnet-5-5'],
};

const adapters = {
  gemini: {
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: (key) => ({ 'x-goog-api-key': key }),
    body: ({ model, system, user, maxTokens, temperature }) => {
      const gen = { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' };
      if (/flash/i.test(model)) gen.thinkingConfig = { thinkingBudget: 0 }; // cheaper + faster for extraction work
      return {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: gen,
      };
    },
    parse: (d) => {
      if (d.promptFeedback?.blockReason) throw new AIError('blocked', 'Blocked: ' + d.promptFeedback.blockReason);
      const c = d.candidates?.[0];
      if (!c) throw new AIError('blocked', 'No candidates');
      if (c.finishReason === 'SAFETY' || c.finishReason === 'PROHIBITED_CONTENT') throw new AIError('blocked', c.finishReason);
      const text = (c.content?.parts || []).map((p) => p.text || '').join('');
      return {
        text,
        truncated: c.finishReason === 'MAX_TOKENS',
        usage: { in: d.usageMetadata?.promptTokenCount || 0, out: d.usageMetadata?.candidatesTokenCount || 0 },
      };
    },
  },

  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: ({ model, system, user, maxTokens, temperature }) => {
      const b = {
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
        max_completion_tokens: maxTokens,
      };
      if (!/^(o\d|gpt-5)/i.test(model)) b.temperature = temperature; // reasoning models only accept the default
      return b;
    },
    parse: (d) => {
      const m = d.choices?.[0]?.message;
      if (m?.refusal) throw new AIError('blocked', String(m.refusal).slice(0, 200));
      return {
        text: m?.content || '',
        truncated: d.choices?.[0]?.finish_reason === 'length',
        usage: { in: d.usage?.prompt_tokens || 0, out: d.usage?.completion_tokens || 0 },
      };
    },
  },

  claude: {
    url: () => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: ({ model, system, user, maxTokens, temperature }) => ({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    parse: (d) => {
      if (d.stop_reason === 'refusal') throw new AIError('blocked', 'Model refused');
      const text = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return {
        text,
        truncated: d.stop_reason === 'max_tokens',
        usage: { in: d.usage?.input_tokens || 0, out: d.usage?.output_tokens || 0 },
      };
    },
  },
};

export async function callProvider({ provider, key, model, system, user, maxTokens = 6144, temperature = 0.2, signal }) {
  const a = adapters[provider];
  if (!a) throw new AIError('generic', `Unknown provider: ${provider}`);
  if (!key) throw new AIError('nokey', `No ${provider} key`, { provider });
  try {
    const data = await postJson(a.url(model), { headers: a.headers(key), body: a.body({ model, system, user, maxTokens, temperature }), signal });
    return a.parse(data);
  } catch (e) {
    if (e instanceof AIError) e.provider = provider;
    throw e;
  }
}
