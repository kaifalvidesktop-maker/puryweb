// PuryWeb — templates/blocks.js
// Pre-made premium Tailwind markup for every block type. The AI never touches this layer (Design Quality Lock).
// Every dynamic value is HTML-escaped; URLs are limited to http(s).

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

export const TONES = {
  warm: {
    chip: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    tile: 'border-orange-200 bg-orange-50/60',
    rule: 'bg-orange-500',
    soft: 'bg-orange-50',
  },
  cool: {
    chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    tile: 'border-violet-200 bg-violet-50/60',
    rule: 'bg-violet-600',
    soft: 'bg-violet-50',
  },
  neutral: {
    chip: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
    tile: 'border-zinc-200 bg-zinc-50',
    rule: 'bg-zinc-800',
    soft: 'bg-zinc-50',
  },
};

const YT_EMBED = /^[\w-]{6,15}$/;

function link(href, text, cls = '') {
  const u = safeUrl(href);
  return u
    ? `<a class="${cls}" href="${esc(u)}" rel="noopener noreferrer">${esc(text)}</a>`
    : `<span class="${cls}">${esc(text)}</span>`;
}

function cell(c) {
  return typeof c === 'string' ? esc(c) : link(c.href, c.text, 'text-violet-700 underline underline-offset-4');
}

const R = {
  heading(b) {
    const lvl = b.level <= 2 ? 2 : b.level === 3 ? 3 : 4;
    const cls = { 2: 'text-[28px] mt-12 mb-4 font-bold tracking-tight text-zinc-900', 3: 'text-[23px] mt-9 mb-3 font-semibold text-zinc-900', 4: 'text-[20px] mt-7 mb-2 font-semibold text-zinc-800' }[lvl];
    return `<h${lvl} class="${cls}">${esc(b.text)}</h${lvl}>`;
  },

  paragraph(b) {
    const links = (b.links || []).filter((l) => safeUrl(l.href));
    const chips = links.length
      ? `<div class="mt-3 flex flex-wrap gap-2">${links.slice(0, 6).map((l) => link(l.href, l.text, 'inline-flex items-center rounded-full bg-violet-50 px-3 py-1.5 text-[16px] font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100')).join('')}</div>`
      : '';
    return `<div class="my-5"><p class="text-[19px] leading-9 text-zinc-700">${esc(b.text)}</p>${chips}</div>`;
  },

  list(b) {
    const tag = b.ordered ? 'ol' : 'ul';
    const marker = b.ordered ? 'list-decimal' : 'list-disc';
    const items = b.items
      .map((i) => `<li class="${i.level ? 'ml-6 ' : ''}pl-1 text-[19px] leading-8 text-zinc-700">${i.href ? link(i.href, i.text, 'text-violet-700 underline underline-offset-4') : esc(i.text)}</li>`)
      .join('');
    return `<${tag} class="my-5 ${marker} space-y-2 pl-6 marker:text-orange-500">${items}</${tag}>`;
  },

  'link-group'(b) {
    const title = b.title ? `<h3 class="mb-3 text-[20px] font-semibold text-zinc-900">${esc(b.title)}</h3>` : '';
    const links = b.links
      .filter((l) => safeUrl(l.href))
      .map((l) => `<a href="${esc(l.href)}" rel="noopener noreferrer" class="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[18px] font-medium text-zinc-800 hover:border-violet-300 hover:bg-violet-50/50"><span>${esc(l.text)}</span><span class="text-zinc-400 group-hover:text-violet-600" aria-hidden="true">→</span></a>`)
      .join('');
    return `<section class="my-8">${title}<div class="grid gap-3 sm:grid-cols-2">${links}</div></section>`;
  },

  table(b) {
    const head = b.headers && b.headers.length
      ? `<thead class="bg-zinc-50"><tr>${b.headers.map((h) => `<th scope="col" class="whitespace-nowrap px-4 py-3 text-left text-[15px] font-semibold uppercase tracking-wide text-zinc-500">${esc(h)}</th>`).join('')}</tr></thead>`
      : '';
    const rows = b.rows
      .map((r) => `<tr class="odd:bg-white even:bg-zinc-50/60">${r.map((c) => `<td class="px-4 py-3.5 align-top text-[18px] text-zinc-800">${cell(c)}</td>`).join('')}</tr>`)
      .join('');
    const cap = b.caption ? `<caption class="px-4 py-3 text-left text-[16px] font-medium text-zinc-500">${esc(b.caption)}</caption>` : '';
    return `<div class="pw-card my-7 overflow-x-auto border border-zinc-200"><table class="min-w-full divide-y divide-zinc-200">${cap}${head}<tbody class="divide-y divide-zinc-100">${rows}</tbody></table></div>`;
  },

  image(b) {
    const u = safeUrl(b.src);
    if (!u) return '';
    const cap = b.caption ? `<figcaption class="mt-3 text-[16px] leading-7 text-zinc-500">${esc(b.caption)}</figcaption>` : '';
    return `<figure class="my-8"><img src="${esc(u)}" alt="${esc(b.alt)}" loading="lazy" decoding="async" class="pw-card h-auto max-h-[560px] w-full object-cover">${cap}</figure>`;
  },

  quote(b) {
    return `<blockquote class="my-7 border-l-4 border-orange-400 bg-orange-50/40 py-3 pl-5 pr-4 text-[20px] italic leading-9 text-zinc-700">${esc(b.text)}</blockquote>`;
  },

  code(b) {
    return `<pre class="my-6 overflow-x-auto rounded-2xl bg-zinc-900 p-5 text-[16px] leading-7 text-zinc-100"><code>${esc(b.text)}</code></pre>`;
  },

  video(b) {
    if (b.platform === 'youtube' && YT_EMBED.test(b.videoId || '')) {
      return `<div class="pw-card my-6 aspect-video w-full overflow-hidden bg-black"><iframe class="h-full w-full" src="https://www.youtube-nocookie.com/embed/${esc(b.videoId)}" title="${esc(b.title || 'Video')}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    }
    const u = safeUrl(b.src);
    if (!u) return '';
    if (b.embed) return `<div class="my-6">${link(u, b.title || u, 'text-[18px] font-medium text-violet-700 underline underline-offset-4')}</div>`;
    return `<video class="pw-card my-6 aspect-video w-full bg-black" controls preload="metadata" src="${esc(u)}"${safeUrl(b.poster) ? ` poster="${esc(b.poster)}"` : ''}></video>`;
  },

  kv(b) {
    const rows = b.items
      .map((i) => `<div class="grid gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-6"><dt class="text-[16px] font-medium text-zinc-500">${esc(i.k)}</dt><dd class="text-[19px] text-zinc-900">${esc(i.v)}</dd></div>`)
      .join('');
    return `<dl class="pw-card my-7 divide-y divide-zinc-100 border border-zinc-200 px-5">${rows}</dl>`;
  },

  cards(b, ctx) {
    const cols = ctx.cols === 1 ? '' : ctx.cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';
    const cards = b.items
      .map((c) => {
        const u = safeUrl(c.href);
        const img = safeUrl(c.image)
          ? `<div class="aspect-video w-full overflow-hidden bg-zinc-100"><img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"></div>`
          : '';
        const meta = (c.meta || []).map((m) => `<span>${esc(m)}</span>`).join('<span class="text-zinc-300" aria-hidden="true">·</span>');
        const price = c.price ? `<div class="mt-2 text-[22px] font-bold text-zinc-900">${esc(c.price)}</div>` : '';
        const channel = c.channel ? `<div class="mt-1 text-[16px] font-medium text-zinc-600">${esc(c.channel)}</div>` : '';
        const tag = c.tag ? `<span class="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[13px] font-semibold uppercase text-zinc-500">${esc(c.tag)}</span>` : '';
        const body = `${img}<div class="p-5"><h3 class="text-[20px] font-semibold leading-snug text-zinc-900">${esc(c.title)}${tag}</h3>${channel}${price}<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-zinc-500">${meta}</div></div>`;
        return u
          ? `<a href="${esc(u)}" rel="noopener noreferrer" class="pw-card group block overflow-hidden border border-zinc-200 transition hover:border-violet-300 hover:shadow-lg">${body}</a>`
          : `<div class="pw-card group block overflow-hidden border border-zinc-200">${body}</div>`;
      })
      .join('');
    return `<div class="my-8 grid gap-5 ${cols}">${cards}</div>`;
  },

  comments(b, ctx) {
    const items = b.items
      .map((c) => `<li class="py-5"><div class="flex flex-wrap items-center gap-x-3 text-[16px]"><span class="font-semibold text-zinc-900">${esc(c.author || ctx.t('comments.anon'))}</span>${c.time ? `<span class="text-zinc-400">${esc(c.time)}</span>` : ''}${c.likes ? `<span class="text-zinc-500">♥ ${esc(c.likes)}</span>` : ''}</div><p class="mt-1.5 text-[19px] leading-8 text-zinc-700">${esc(c.text)}</p></li>`)
      .join('');
    return `<section class="my-10"><h2 class="mb-2 text-[24px] font-bold text-zinc-900">${esc(ctx.t('comments.title'))}</h2><ul class="divide-y divide-zinc-100">${items}</ul></section>`;
  },

  form(b, ctx) {
    const f = ctx.forms.get(b.formId);
    return f ? ctx.renderFormCard(f) : '';
  },
};

export function renderBlock(block, ctx) {
  const fn = R[block.type];
  if (!fn) return '';
  try {
    return fn(block, ctx);
  } catch (e) {
    return '';
  }
}

/** Key-fact tiles built from plan.highlights. */
export function renderHighlights(items, tone) {
  if (!items || !items.length) return '';
  const T = TONES[tone] || TONES.neutral;
  const tiles = items
    .map((h) => `<div class="pw-card border ${T.tile} p-5"><div class="text-[14px] font-semibold uppercase tracking-wider text-zinc-500">${esc(h.label)}</div><div class="mt-1.5 text-[24px] font-bold leading-tight text-zinc-900">${esc(h.value)}</div></div>`)
    .join('');
  const lg = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[Math.min(4, Math.max(2, items.length))];
  return `<div class="my-8 grid gap-4 sm:grid-cols-2 ${lg}">${tiles}</div>`;
}

export function renderWarnings(items, t) {
  if (!items || !items.length) return '';
  const list = items.map((w) => `<li class="flex gap-3"><span class="mt-1 text-amber-600" aria-hidden="true">▲</span><span>${esc(w)}</span></li>`).join('');
  return `<div role="note" class="my-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[18px] leading-8 text-amber-900"><div class="mb-2 text-[15px] font-bold uppercase tracking-wide">${esc(t('view.warnings'))}</div><ul class="space-y-2">${list}</ul></div>`;
}

export function renderSummary(text, tone) {
  if (!text) return '';
  const T = TONES[tone] || TONES.neutral;
  return `<p class="my-6 rounded-2xl ${T.soft} px-6 py-5 text-[21px] font-medium leading-9 text-zinc-800">${esc(text)}</p>`;
}
