// PuryWeb — shared/i18n.js
// Bangla-first dictionary with English fallback. No dependencies on chrome.* so it is safe anywhere.

export const DICT = {
  bn: {
    'app.name': 'PuryWeb',
    'app.tagline': 'ইন্টারনেট হোক পরিষ্কার, মনোযোগী, বিশ্বাসযোগ্য',
    'action.title': 'PuryWeb — এই পেজ পরিষ্কার করো',
    'action.title.left': 'PuryWeb — আজ আরও {n}টি বাকি',
    'action.title.unlimited': 'PuryWeb — আনলিমিটেড',
    'intent.title': 'এই পেজটা কেমন চাও?',
    'intent.placeholder': 'এই পেজটা কেমন চাও? লিখো... / How do you want this page?',
    'intent.hint': 'যেমন: "Shorts সরাও কিন্তু কমেন্ট রাখো"',
    'intent.submit': 'পরিষ্কার করো',
    'intent.skip': 'এমনিতেই করো',
    'intent.recent': 'সাম্প্রতিক',
    'intent.examples': 'উদাহরণ',
    'intent.detected': 'ধরন',
    'intent.shortcut': 'Ctrl + Enter',
    'busy.title': 'পরিষ্কার করছি…',
    'busy.read': 'পেজ পড়ছি',
    'busy.ai': 'AI পরিষ্কার করছে',
    'busy.build': 'সাজাচ্ছি',
    'done.title': 'প্রস্তুত!',
    'done.partial': 'আংশিক প্রস্তুত',
    'done.fallback': 'আসল পেজ পরিষ্কার করে দেখানো হচ্ছে, কোনো কোটা কাটা যায়নি।',
    'done.stats': '{sections}টি অংশ · {hidden}টি লুকানো · {fields}টি ঘর',
    'done.cached': 'আগের ফলাফল, কোনো খরচ নেই',
    'btn.close': 'বন্ধ করো',
    'btn.retry': 'আবার চেষ্টা',
    'btn.addkey': 'API Key যোগ করো',
    'btn.show': 'দেখো',
    'close.aria': 'বন্ধ',
    'time.hm': '{h} ঘণ্টা {m} মিনিট',
    'paywall.resets': 'ফ্রি সীমা ফিরবে',
    'paywall.perk1': 'আনলিমিটেড পেজ পরিষ্কার',
    'paywall.perk2': 'নিজের API Key দিয়ে খরচ কম',
    'paywall.perk3': 'সব ৩০ ধরনের পেজ ও নিজের Prompt',
    'quota.left': '{n}টি বাকি',
    'quota.unlimited': 'আনলিমিটেড',
    'quota.resets': 'আগামীকাল রিসেট হবে',
    'quota.today': 'আজকের ব্যবহার',
    'paywall.title': 'আজকের ফ্রি সীমা শেষ',
    'paywall.body': 'ফ্রি প্ল্যানে প্রতিদিন {limit}টি পেজ পরিষ্কার করা যায়। আনলিমিটেড ব্যবহার করতে আপগ্রেড করো — অথবা নিজের API Key যোগ করে খরচ বাঁচাও।',
    'paywall.cta': 'আনলিমিটেডে আপগ্রেড করো',
    'paywall.byok': 'নিজের API Key ব্যবহার করো',
    'paywall.later': 'কাল আবার আসব',
    'trust.secure': 'তোমার ডেটা নিরাপদ',
    'trust.detail': 'API Key শুধু তোমার ব্রাউজারে থাকে',
    'toast.ready': 'PuryWeb প্রস্তুত — আজ আরও {n}টি পরিষ্কার করা যাবে',
    'toast.ready.unlimited': 'PuryWeb প্রস্তুত — আনলিমিটেড',
    'toast.restricted': 'এই পেজে এক্সটেনশন চালানো যায় না',
    'toast.site.original': '{host} এখন থেকে আসল অবস্থায় থাকবে',
    'toast.site.purify': '{host} আবার পরিষ্কার করা যাবে',
    'menu.purify': 'এই পেজ পরিষ্কার করো',
    'menu.os': 'PuryWeb OS খোলো',
    'menu.site.toggle': 'এই সাইট আসল অবস্থায় রাখো / ফেরাও',
    'menu.analyze': 'পেজ বিশ্লেষণ (ডিবাগ)',
    'toast.category': 'ধরন: {cat} ({pct}%)',
    'err.generic': 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করো।',
    'err.network': 'ইন্টারনেট সংযোগে সমস্যা। একটু পরে চেষ্টা করো।',
    'err.key': 'API Key সঠিক নয় বা নেই। PuryWeb OS থেকে Key যোগ করো।',
    'err.rate': 'AI সার্ভার এখন ব্যস্ত। কয়েক সেকেন্ড পরে চেষ্টা করো।',
    'err.parse': 'AI-এর উত্তর বোঝা যায়নি। আসল পেজই দেখানো হচ্ছে।',
    'err.nokey': 'কোনো API Key নেই। PuryWeb OS-এ গিয়ে Key যোগ করো।',
    'err.billing': 'API অ্যাকাউন্টের ক্রেডিট বা কোটা শেষ। প্রোভাইডারের বিলিং দেখো।',
    'err.model': 'মডেলের নাম ঠিক নয়। PuryWeb OS-এ মডেল বদলাও।',
    'err.blocked': 'AI এই পেজটি প্রসেস করতে রাজি হয়নি। আসল পেজ দেখানো হচ্ছে।',
    'os.nav.dashboard': 'ড্যাশবোর্ড',
    'os.dashboard.title': 'ড্যাশবোর্ড',
    'os.dashboard.sub': 'তোমার PuryWeb এক নজরে',
    'os.plan': 'প্ল্যান',
    'os.plan.free': 'ফ্রি',
    'os.plan.paid': 'প্রো — আনলিমিটেড',
    'os.license.label': 'লাইসেন্স কী',
    'os.license.placeholder': 'PW-XXXX-XXXX-XXXX-XXXX',
    'os.license.activate': 'চালু করো',
    'os.license.deactivate': 'বন্ধ করো',
    'os.license.ok': 'লাইসেন্স চালু হয়েছে। ধন্যবাদ!',
    'os.license.invalid': 'লাইসেন্স কী সঠিক নয়।',
    'os.license.off': 'লাইসেন্স বন্ধ করা হয়েছে।',
    'os.stats.purified': 'পরিষ্কার করা পেজ',
    'os.stats.saved': 'বাঁচানো সময় (মিনিট)',
    'os.lang': 'ভাষা',
    'os.lang.switch': 'English',
  },
  en: {
    'app.name': 'PuryWeb',
    'app.tagline': 'A cleaner, more focused, more trustworthy internet',
    'action.title': 'PuryWeb — Purify this page',
    'action.title.left': 'PuryWeb — {n} left today',
    'action.title.unlimited': 'PuryWeb — Unlimited',
    'intent.title': 'How do you want this page?',
    'intent.placeholder': 'এই পেজটা কেমন চাও? লিখো... / How do you want this page?',
    'intent.hint': 'e.g. "Remove Shorts but keep comments"',
    'intent.submit': 'Purify',
    'intent.skip': 'Just purify',
    'intent.recent': 'Recent',
    'intent.examples': 'Examples',
    'intent.detected': 'Detected',
    'intent.shortcut': 'Ctrl + Enter',
    'busy.title': 'Purifying…',
    'busy.read': 'Reading the page',
    'busy.ai': 'AI is cleaning it',
    'busy.build': 'Putting it together',
    'done.title': 'Ready!',
    'done.partial': 'Partly ready',
    'done.fallback': 'Showing the original page, cleaned. No quota was used.',
    'done.stats': '{sections} sections · {hidden} hidden · {fields} fields',
    'done.cached': 'Earlier result, no cost',
    'btn.close': 'Close',
    'btn.retry': 'Try again',
    'btn.addkey': 'Add API key',
    'btn.show': 'Show it',
    'close.aria': 'Close',
    'time.hm': '{h}h {m}m',
    'paywall.resets': 'Free limit returns in',
    'paywall.perk1': 'Unlimited purifies',
    'paywall.perk2': 'Lower cost with your own API key',
    'paywall.perk3': 'All 30 page types and your own prompts',
    'quota.left': '{n} left',
    'quota.unlimited': 'Unlimited',
    'quota.resets': 'Resets tomorrow',
    'quota.today': "Today's usage",
    'paywall.title': "Today's free limit is used up",
    'paywall.body': 'The free plan purifies {limit} pages per day. Upgrade for unlimited use, or add your own API key to save cost.',
    'paywall.cta': 'Upgrade to Unlimited',
    'paywall.byok': 'Use my own API key',
    'paywall.later': "I'll come back tomorrow",
    'trust.secure': 'Your data is secure',
    'trust.detail': 'API keys never leave your browser',
    'toast.ready': 'PuryWeb is ready — {n} more purifies today',
    'toast.ready.unlimited': 'PuryWeb is ready — Unlimited',
    'toast.restricted': 'Extensions cannot run on this page',
    'toast.site.original': '{host} will now stay original',
    'toast.site.purify': '{host} can be purified again',
    'menu.purify': 'Purify this page',
    'menu.os': 'Open PuryWeb OS',
    'menu.site.toggle': 'Keep this site original / restore',
    'menu.analyze': 'Analyze page (debug)',
    'toast.category': 'Detected: {cat} ({pct}%)',
    'err.generic': 'Something went wrong. Please try again.',
    'err.network': 'Network problem. Please try again shortly.',
    'err.key': 'API key is missing or invalid. Add one in PuryWeb OS.',
    'err.rate': 'The AI server is busy. Try again in a few seconds.',
    'err.parse': "Couldn't understand the AI reply. Showing the original page.",
    'err.nokey': 'No API key yet. Add one in PuryWeb OS.',
    'err.billing': 'Your API account is out of credit or quota. Check provider billing.',
    'err.model': 'Model name is not valid. Change it in PuryWeb OS.',
    'err.blocked': 'The AI declined to process this page. Showing the original.',
    'os.nav.dashboard': 'Dashboard',
    'os.dashboard.title': 'Dashboard',
    'os.dashboard.sub': 'Your PuryWeb at a glance',
    'os.plan': 'Plan',
    'os.plan.free': 'Free',
    'os.plan.paid': 'Pro — Unlimited',
    'os.license.label': 'License key',
    'os.license.placeholder': 'PW-XXXX-XXXX-XXXX-XXXX',
    'os.license.activate': 'Activate',
    'os.license.deactivate': 'Deactivate',
    'os.license.ok': 'License activated. Thank you!',
    'os.license.invalid': 'That license key is not valid.',
    'os.license.off': 'License deactivated.',
    'os.stats.purified': 'Pages purified',
    'os.stats.saved': 'Time saved (min)',
    'os.lang': 'Language',
    'os.lang.switch': 'বাংলা',
  },
};

export const LANGS = Object.freeze(['bn', 'en']);
let current = 'bn';

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'bn';
  return current;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Format a number using the digits of the given language. */
export function num(n, lang = current) {
  const s = String(n);
  return lang === 'bn' ? s.replace(/\d/g, (d) => BN_DIGITS[+d]) : s;
}

/** Translate a key; {vars} are interpolated (numbers use language digits). */
export function t(key, vars = {}, lang = current) {
  const raw = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => {
    if (!(name in vars)) return m;
    const v = vars[name];
    return typeof v === 'number' ? num(v, lang) : String(v);
  });
}

/** Apply translations to [data-i18n], [data-i18n-ph] and [data-i18n-title] inside root. */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPh));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle));
  });
  document.documentElement.lang = current;
}

/** Minutes label helper for stats. */
export function minutes(seconds, lang = current) {
  return num(Math.round((Number(seconds) || 0) / 60), lang);
}
