// PuryWeb — templates/families.js
// Nine premium page layouts. Each takes the validated plan + extracted model and returns Tailwind HTML.
// Light, airy, 18px+ type, one primary action per view.

import { esc, safeUrl, TONES, renderBlock, renderHighlights, renderWarnings, renderSummary } from './blocks.js';
import { renderForm } from './forms.js';

const WIDTH = { narrow: 'max-w-[680px]', normal: 'max-w-[760px]', wide: 'max-w-[980px]', full: 'max-w-[1120px]' };

function blockMap(model) {
  return new Map(model.blocks.map((b) => [b.id, b]));
}

function makeCtx(args) {
  const { model, plan, t, cfg } = args;
  const forms = new Map(model.forms.map((f) => [f.id, f]));
  const ctx = { t, forms, cols: cfg.cols || 2, plan, model };
  ctx.renderFormCard = (f) => renderForm(f, plan, t);
  return ctx;
}

function sectionsHtml(args, ctx, { skip = () => false } = {}) {
  const { plan, model } = args;
  const map = blockMap(model);
  const hidden = new Set(plan.hide);
  return plan.sections
    .map((s) => {
      const inner = s.blockIds
        .filter((id) => !hidden.has(id) && !skip(map.get(id)))
        .map((id) => renderBlock(map.get(id), ctx))
        .join('');
      if (!inner.trim()) return '';
      const h = s.heading ? `<h2 class="mt-12 mb-4 text-[28px] font-bold tracking-tight text-zinc-900">${esc(s.heading)}</h2>` : '';
      return `<section>${h}${inner}</section>`;
    })
    .join('');
}

function hasInlineForm(model) {
  return model.blocks.some((b) => b.type === 'form');
}

function formsHtml(args, ctx) {
  const { model, plan, t } = args;
  if (hasInlineForm(model) && !model.forms.some((f) => f.wrapper)) return '';
  return model.forms.map((f) => renderForm(f, plan, t)).join('<div class="h-6"></div>');
}

function titleBlock(args, { size = 'text-[40px] sm:text-[46px]', byline = true } = {}) {
  const { plan, model, cfg } = args;
  const T = TONES[cfg.tone] || TONES.neutral;
  const m = model.meta;
  const meta = byline && (m.author || m.published)
    ? `<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[17px] text-zinc-500">${m.author ? `<span class="font-medium text-zinc-700">${esc(m.author)}</span>` : ''}${m.published ? `<time datetime="${esc(m.published)}">${esc(String(m.published).slice(0, 10))}</time>` : ''}<span class="rounded-full px-3 py-0.5 text-[14px] font-semibold ${T.chip}">${esc(model.category.label)}</span></div>`
    : `<div class="mt-4"><span class="rounded-full px-3 py-0.5 text-[14px] font-semibold ${T.chip}">${esc(model.category.label)}</span></div>`;
  return `<header class="pb-2"><div class="mb-5 h-1.5 w-16 rounded-full ${T.rule}"></div><h1 class="${size} font-bold leading-[1.15] tracking-tight text-zinc-900">${esc(plan.title)}</h1>${meta}</header>`;
}

function intro(args) {
  const { plan, cfg, t } = args;
  return renderSummary(plan.summary, cfg.tone) + renderHighlights(plan.highlights, cfg.tone) + renderWarnings(plan.warnings, t);
}

/* ---------------- families ---------------- */
export const FAMILIES = {
  article(args) {
    const ctx = makeCtx(args);
    return `${titleBlock(args)}${intro(args)}<div class="pw-prose">${sectionsHtml(args, ctx)}</div>${formsHtml(args, ctx)}`;
  },

  grid(args) {
    const ctx = makeCtx(args);
    return `${titleBlock(args, { size: 'text-[36px] sm:text-[42px]', byline: false })}${intro(args)}${sectionsHtml(args, ctx)}${formsHtml(args, ctx)}`;
  },

  video(args) {
    const ctx = makeCtx(args);
    const first = args.model.blocks.find((b) => b.type === 'video');
    const player = first && !args.plan.hide.includes(first.id) ? renderBlock(first, ctx) : '';
    const rest = sectionsHtml(args, ctx, { skip: (b) => b && first && b.id === first.id });
    return `${player}${titleBlock(args, { size: 'text-[32px] sm:text-[38px]', byline: false })}${intro(args)}${rest}`;
  },

  product(args) {
    const ctx = makeCtx(args);
    const { model, plan, t, cfg } = args;
    const images = model.blocks.filter((b) => b.type === 'image' && !plan.hide.includes(b.id)).slice(0, 4);
    const imgIds = new Set(images.map((i) => i.id));
    const gallery = images.length
      ? `<div class="grid gap-3 ${images.length > 1 ? 'grid-cols-2' : ''}">${images.map((i) => safeUrl(i.src) ? `<img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy" class="pw-card aspect-square w-full border border-zinc-200 bg-white object-contain p-3">` : '').join('')}</div>`
      : '';
    const primaryId = plan.primaryActionId || (model.forms[0] && model.forms[0].primaryActionId);
    const buy = primaryId
      ? `<div class="mt-8"><button type="button" class="pw-btn pw-btn-primary w-full" data-pw-action="${esc(primaryId)}" data-pw-primary>${esc(t('product.buy'))}</button></div>`
      : '';
    const body = sectionsHtml(args, ctx, { skip: (b) => b && imgIds.has(b.id) });
    return `<div class="grid gap-10 lg:grid-cols-[1fr_1fr]"><div>${gallery}</div><div>${titleBlock(args, { size: 'text-[34px]', byline: false })}${renderHighlights(plan.highlights, cfg.tone)}${buy}${renderSummary(plan.summary, cfg.tone)}${renderWarnings(plan.warnings, t)}</div></div><div class="mt-6">${body}</div>`;
  },

  form(args) {
    const ctx = makeCtx(args);
    const text = sectionsHtml(args, ctx, { skip: (b) => b && b.type === 'form' });
    return `${titleBlock(args, { size: 'text-[36px] sm:text-[42px]', byline: false })}${intro(args)}${text ? `<div class="mb-10">${text}</div>` : ''}${args.model.forms.map((f) => renderForm(f, args.plan, args.t)).join('<div class="h-6"></div>')}`;
  },

  login(args) {
    const { model, plan, t } = args;
    const f = model.forms[0];
    return `<div class="mx-auto max-w-[460px] pt-6">${titleBlock(args, { size: 'text-[32px]', byline: false })}<div class="mt-8">${f ? renderForm(f, plan, t) : ''}</div></div>`;
  },

  notice(args) {
    const ctx = makeCtx(args);
    const links = args.model.blocks.filter((b) => b.type === 'link-group' && !args.plan.hide.includes(b.id));
    const body = sectionsHtml(args, ctx, { skip: (b) => b && b.type === 'link-group' });
    const attach = links.length
      ? `<section class="mt-12"><h2 class="mb-4 text-[26px] font-bold text-zinc-900">${esc(args.t('notice.attachments'))}</h2>${links.map((b) => renderBlock(b, ctx)).join('')}</section>`
      : '';
    return `${titleBlock(args)}${intro(args)}<div class="pw-prose">${body}</div>${attach}`;
  },

  result(args) {
    const ctx = makeCtx(args);
    const { plan, cfg, t, model } = args;
    const big = plan.highlights.length
      ? `<div class="my-8 grid gap-4 sm:grid-cols-${Math.min(3, plan.highlights.length) === 1 ? '1' : '2'}">${plan.highlights.map((h) => `<div class="pw-card border border-zinc-200 p-7 text-center"><div class="text-[15px] font-semibold uppercase tracking-wider text-zinc-500">${esc(h.label)}</div><div class="pw-grad-text mt-2 text-[40px] font-extrabold leading-tight">${esc(h.value)}</div></div>`).join('')}</div>`
      : '';
    return `${titleBlock(args, { byline: false })}${renderSummary(plan.summary, cfg.tone)}${big}${renderWarnings(plan.warnings, t)}${model.forms.map((f) => renderForm(f, plan, t)).join('')}${sectionsHtml(args, ctx, { skip: (b) => b && b.type === 'form' })}`;
  },

  home(args) {
    const ctx = makeCtx(args);
    return `${titleBlock(args, { size: 'text-[36px] sm:text-[44px]', byline: false })}${intro(args)}${sectionsHtml(args, ctx)}${formsHtml(args, ctx)}`;
  },

  thread(args) {
    const ctx = makeCtx(args);
    return `${titleBlock(args, { size: 'text-[34px] sm:text-[40px]' })}${intro(args)}<div class="pw-prose">${sectionsHtml(args, ctx)}</div>${formsHtml(args, ctx)}`;
  },
};

export { WIDTH };
