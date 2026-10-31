// PuryWeb — templates/forms.js
// Renders the extracted form model as a clean multi-step form.
// Every control carries data-pw-* ids so the Phase 7 headless proxy can mirror values into the ORIGINAL form
// and fire the ORIGINAL submit action.

import { esc } from './blocks.js';

const TEXT_TYPES = new Set(['text', 'email', 'tel', 'number', 'date', 'url', 'search', 'password', 'time', 'datetime-local', 'month', 'week']);
const MODE = { email: 'email', tel: 'tel', number: 'numeric', url: 'url' };

function labelOf(f, plan) {
  const o = plan.labels && plan.labels[f.id];
  return { label: (o && o.label) || f.label, hint: (o && o.hint) || f.hint };
}

function wrap(f, plan, control, t, { fieldset = false } = {}) {
  const { label, hint } = labelOf(f, plan);
  const req = f.required ? `<span class="ml-1 text-orange-600" aria-hidden="true">*</span><span class="sr-only"> ${esc(t('form.required'))}</span>` : '';
  const h = hint ? `<p id="pwh-${esc(f.id)}" class="mt-2 text-[16px] leading-7 text-zinc-500">${esc(hint)}</p>` : '';
  if (fieldset) {
    return `<fieldset class="space-y-3" data-pw-wrap="${esc(f.id)}"${f.required ? ' data-pw-required' : ''}><legend class="mb-1 text-[18px] font-semibold text-zinc-900">${esc(label)}${req}</legend>${control}${h}</fieldset>`;
  }
  return `<div data-pw-wrap="${esc(f.id)}"${f.required ? ' data-pw-required' : ''}><label for="pwf-${esc(f.id)}" class="mb-2 block text-[18px] font-semibold text-zinc-900">${esc(label)}${req}</label>${control}${h}</div>`;
}

function describedBy(f, plan) {
  return labelOf(f, plan).hint ? ` aria-describedby="pwh-${esc(f.id)}"` : '';
}

function renderField(f, plan, t) {
  const id = esc(f.id);
  const common = `id="pwf-${id}" data-pw-field="${id}"${f.required ? ' required aria-required="true"' : ''}${f.disabled ? ' disabled' : ''}${f.readonly ? ' readonly' : ''}${describedBy(f, plan)}`;

  if (f.captcha) {
    return wrap(f, plan, `<div class="space-y-3" data-pw-captcha="${id}"><div class="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-[16px] text-zinc-600" data-pw-captcha-image>${esc(t('form.captcha'))}</div><input class="pw-input" type="text" autocomplete="off" ${common}></div>`, t);
  }

  if (TEXT_TYPES.has(f.kind)) {
    const attrs = [
      `type="${esc(f.kind)}"`,
      f.value ? `value="${esc(f.value)}"` : '',
      f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
      f.maxlength ? `maxlength="${Number(f.maxlength) || 0}"` : '',
      f.pattern ? `pattern="${esc(f.pattern)}"` : '',
      f.min ? `min="${esc(f.min)}"` : '',
      f.max ? `max="${esc(f.max)}"` : '',
      MODE[f.kind] ? `inputmode="${MODE[f.kind]}"` : '',
      f.kind === 'password' ? 'autocomplete="current-password"' : '',
    ].filter(Boolean).join(' ');
    return wrap(f, plan, `<input class="pw-input" ${attrs} ${common}>`, t);
  }

  switch (f.kind) {
    case 'textarea':
      return wrap(f, plan, `<textarea class="pw-input min-h-[140px] resize-y leading-8" rows="4" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${common}>${esc(f.value || '')}</textarea>`, t);

    case 'select':
    case 'select-multiple': {
      const multi = f.kind === 'select-multiple';
      const opts = (f.options || [])
        .map((o, i) => `<option value="${i}"${o.placeholder ? ' data-pw-ph' : ''}${o.selected ? ' selected' : ''}${o.disabled ? ' disabled' : ''}>${esc(o.label)}</option>`)
        .join('');
      return wrap(f, plan, `<select class="pw-input appearance-auto" ${multi ? 'multiple size="6"' : ''} ${common}>${opts}</select>`, t);
    }

    case 'radio':
    case 'checkbox-group': {
      const type = f.kind === 'radio' ? 'radio' : 'checkbox';
      const opts = (f.options || [])
        .map((o, i) => `<label class="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[18px] text-zinc-800 hover:border-violet-300 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"><input class="h-5 w-5 accent-violet-600" type="${type}" name="pwg-${id}" value="${i}" data-pw-option="${esc(o.id)}" data-pw-field="${id}"${o.checked ? ' checked' : ''}${o.disabled || f.disabled ? ' disabled' : ''}><span>${esc(o.label)}</span></label>`)
        .join('');
      return wrap(f, plan, `<div class="grid gap-2.5 sm:grid-cols-2" role="${type === 'radio' ? 'radiogroup' : 'group'}">${opts}</div>`, t, { fieldset: true });
    }

    case 'checkbox': {
      const { label, hint } = labelOf(f, plan);
      const req = f.required ? '<span class="ml-1 text-orange-600" aria-hidden="true">*</span>' : '';
      return `<div data-pw-wrap="${id}"${f.required ? ' data-pw-required' : ''}><label class="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[18px] leading-8 text-zinc-800 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"><input class="mt-2 h-5 w-5 accent-violet-600" type="checkbox" ${common}${f.checked ? ' checked' : ''}><span>${esc(label)}${req}</span></label>${hint ? `<p class="mt-2 text-[16px] text-zinc-500">${esc(hint)}</p>` : ''}</div>`;
    }

    case 'file':
      return wrap(f, plan, `<input class="block w-full cursor-pointer rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-[17px] text-zinc-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-[16px] file:font-semibold file:text-white" type="file" ${common}>`, t);

    default:
      return wrap(f, plan, `<input class="pw-input" type="text" ${common}>`, t);
  }
}

/** Build step groups: plan.steps first, then any section-based grouping, never dropping a field. */
function stepGroups(form, plan) {
  const byId = new Map(form.fields.map((f) => [f.id, f]));
  const out = [];
  const used = new Set();
  for (const s of plan.steps || []) {
    const fields = s.fieldIds.map((id) => byId.get(id)).filter((f) => f && !used.has(f.id));
    fields.forEach((f) => used.add(f.id));
    if (fields.length) out.push({ title: s.title, fields });
  }
  const rest = form.fields.filter((f) => !used.has(f.id));
  if (rest.length) out.push({ title: out.length ? '' : form.title, fields: rest });
  return out;
}

function actionButtons(form, plan, t, isLast, hasPrev) {
  const primaryId = plan.primaryActionId && form.actions.some((a) => a.id === plan.primaryActionId) ? plan.primaryActionId : form.primaryActionId;
  const primary = form.actions.find((a) => a.id === primaryId);
  const others = form.actions.filter((a) => a.id !== primaryId && a.kind !== 'reset' && a.kind !== 'link').slice(0, 2);
  const back = hasPrev ? `<button type="button" class="pw-btn pw-btn-ghost" data-pw-back>${esc(t('form.back'))}</button>` : '';
  const sec = isLast
    ? others.map((a) => `<button type="button" class="pw-btn pw-btn-ghost" data-pw-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')
    : '';
  const main = isLast
    ? primary
      ? `<button type="button" class="pw-btn pw-btn-primary" data-pw-action="${esc(primary.id)}" data-pw-primary>${esc(primary.label)}</button>`
      : ''
    : `<button type="button" class="pw-btn pw-btn-primary" data-pw-next>${esc(t('form.next'))}</button>`;
  return `<div class="mt-10 flex flex-wrap items-center justify-end gap-3">${back}${sec}${main}</div>`;
}

export function renderForm(form, plan, t) {
  const steps = stepGroups(form, plan);
  if (!steps.length) return '';
  const total = steps.length;
  const nav = total > 1
    ? `<ol class="mb-8 flex flex-wrap items-center gap-3" aria-label="${esc(t('form.progress'))}">${steps.map((s, i) => `<li class="flex items-center gap-2 text-[16px] font-semibold ${i === 0 ? 'text-zinc-900' : 'text-zinc-400'}" data-pw-stepnav="${i}"><span class="inline-flex h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'pw-grad text-white' : 'bg-zinc-100 text-zinc-500'} text-[15px]">${i + 1}</span><span class="hidden sm:inline">${esc(s.title || t('form.step', { n: i + 1 }))}</span></li>`).join('')}</ol>`
    : '';
  const panels = steps
    .map((s, i) => `<section data-pw-step="${i}" class="${i === 0 ? '' : 'hidden'}" aria-label="${esc(s.title || t('form.step', { n: i + 1 }))}">${s.title && total > 1 ? `<h2 class="mb-6 text-[26px] font-bold tracking-tight text-zinc-900">${esc(s.title)}</h2>` : ''}<div class="space-y-7">${s.fields.map((f) => renderField(f, plan, t)).join('')}</div>${actionButtons(form, plan, t, i === total - 1, i > 0)}</section>`)
    .join('');
  return `<form class="pw-card border border-zinc-200 p-6 sm:p-9" data-pw-form="${esc(form.id)}" novalidate>${nav}${panels}</form>`;
}

export const renderFormCard = renderForm;
