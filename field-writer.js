// PuryWeb — content/field-writer.js
// Writes values into the ORIGINAL page controls the way a real user would, so every old script,
// framework (React/Angular/Vue/jQuery/ASP.NET) and validator still sees a legitimate change.
// Rules: use the native value setter, fire the full event sequence, click checkboxes/radios.

const win = (el) => el.ownerDocument.defaultView;

function protoOf(el) {
  const w = win(el);
  const tag = el.tagName.toUpperCase();
  return tag === 'SELECT' ? w.HTMLSelectElement.prototype : tag === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
}

/** Bypasses framework-patched `value` setters (React tracks the instance property). */
export function nativeSet(el, prop, value) {
  const desc = Object.getOwnPropertyDescriptor(protoOf(el), prop);
  if (desc && desc.set) desc.set.call(el, value);
  else el[prop] = value;
}

function fire(el, type, init = {}) {
  const w = win(el);
  let ev;
  try {
    if (type === 'input') ev = new w.InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: init.data ?? null });
    else if (type === 'keydown' || type === 'keyup') ev = new w.KeyboardEvent(type, { bubbles: true, composed: true, key: 'Unidentified', ...init });
    else if (type === 'focusout' || type === 'blur' || type === 'focus' || type === 'focusin') ev = new w.FocusEvent(type, { bubbles: type === 'focusout' || type === 'focusin', composed: true });
    else ev = new w.Event(type, { bubbles: true, composed: true });
  } catch {
    ev = new w.Event(type, { bubbles: true });
  }
  el.dispatchEvent(ev);
}

/* ---------------- dates ---------------- */
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** ISO yyyy-mm-dd -> the format a legacy text datepicker expects (guessed from placeholder/pattern/title). */
export function convertDate(value, el) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!iso || el.type === 'date') return value;
  const hint = [el.placeholder, el.getAttribute('pattern'), el.getAttribute('data-date-format'), el.title].filter(Boolean).join(' ');
  const m = /([dmy]{1,4})([/.-])([dmy]{1,4})\2([dmy]{1,4})/i.exec(hint);
  if (!m) return value;
  const [, y, mo, d] = iso;
  const part = (tok) => {
    const k = tok.toLowerCase();
    if (k[0] === 'd') return pad(d);
    if (k[0] === 'm') return pad(mo);
    return k.length <= 2 ? y.slice(2) : y;
  };
  return [part(m[1]), part(m[3]), part(m[4])].join(m[2]);
}

/** Legacy "dd/mm/yyyy" back to ISO for a native date input in the new UI; returns '' if unknown. */
export function toIso(value, el) {
  const v = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const hint = [el.placeholder, el.getAttribute('pattern'), el.title].filter(Boolean).join(' ');
  const m = /([dmy]{1,4})([/.-])([dmy]{1,4})\2([dmy]{1,4})/i.exec(hint);
  const parts = v.split(/[/.-]/);
  if (!m || parts.length !== 3) return '';
  const order = [m[1], m[3], m[4]].map((x) => x[0].toLowerCase());
  const o = {};
  order.forEach((k, i) => (o[k] = parts[i]));
  if (!o.d || !o.m || !o.y) return '';
  const yyyy = o.y.length === 2 ? '20' + o.y : o.y;
  return `${yyyy}-${pad(o.m)}-${pad(o.d)}`;
}

/* ---------------- writers ---------------- */
export function writeText(el, value) {
  const max = el.maxLength > 0 ? el.maxLength : 0;
  let v = String(value ?? '');
  if (max) v = v.slice(0, max);
  if (el.value === v) return false;
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* not focusable */
  }
  fire(el, 'keydown');
  nativeSet(el, 'value', v);
  fire(el, 'input', { data: v.slice(-1) });
  fire(el, 'keyup');
  return true;
}

/** Fires `change` + blur, the moment a user would leave the field. */
export function commit(el) {
  fire(el, 'change');
  fire(el, 'focusout');
  fire(el, 'blur');
  try {
    el.blur();
  } catch {
    /* ignore */
  }
}

export function writeChecked(el, desired) {
  if (!!el.checked === !!desired) return false;
  if (el.type === 'radio' && !desired) return false; // radios can only be switched on
  el.click(); // real click => onclick handlers, label toggles and change events all run
  return true;
}

/** Select by option index; returns true when the selection changed. */
export function writeSelectIndex(el, index) {
  if (!(index >= 0 && index < el.options.length)) return false;
  if (el.selectedIndex === index) return false;
  nativeSet(el, 'selectedIndex', index);
  fire(el, 'input');
  fire(el, 'change');
  return true;
}

export function writeSelectMultiple(el, indices) {
  const want = new Set(indices);
  let changed = false;
  Array.from(el.options).forEach((o, i) => {
    if (o.selected !== want.has(i)) {
      o.selected = want.has(i);
      changed = true;
    }
  });
  if (changed) {
    fire(el, 'input');
    fire(el, 'change');
  }
  return changed;
}

export function writeFiles(el, files) {
  if (typeof DataTransfer === 'undefined') return false;
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  el.files = dt.files;
  fire(el, 'input');
  fire(el, 'change');
  return true;
}

/* ---------------- readers (original -> UI) ---------------- */
export function readSignature(el) {
  const tag = el.tagName.toUpperCase();
  if (tag === 'SELECT') return 's:' + Array.from(el.options).map((o) => (o.selected ? '*' : '') + o.value + '|' + o.text).join('~');
  if (el.type === 'checkbox' || el.type === 'radio') return 'c:' + (el.checked ? 1 : 0);
  if (el.type === 'file') return 'f:' + (el.files ? el.files.length : 0);
  return 'v:' + el.value;
}

export function optionsSignature(el) {
  return Array.from(el.options).map((o) => o.value + '|' + o.text).join('~');
}
