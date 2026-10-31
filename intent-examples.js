// PuryWeb — content/intent-examples.js
// Example requests shown as one-tap chips, chosen by the detected page kind.

const EX = {
  video: {
    bn: ['Shorts সরাও কিন্তু কমেন্ট রাখো', 'শুধু ভিডিও আর বর্ণনা দেখাও', 'রিকমেন্ডেড ভিডিও লুকাও'],
    en: ['Remove shorts but keep comments', 'Show only the video and description', 'Hide recommended videos'],
  },
  feed: {
    bn: ['বিজ্ঞাপন আর সাজেস্টেড পোস্ট সরাও', 'শুধু বন্ধুদের পোস্ট দেখাও', 'ছবি বড় করে দেখাও'],
    en: ['Remove ads and suggested posts', 'Show only posts from people I follow', 'Make images bigger'],
  },
  listing: {
    bn: ['বিজ্ঞাপন সরাও, শুধু আসল ফলাফল রাখো', 'প্রথম ১০টি সেরা ফলাফল দেখাও', 'লেখা বড় করো'],
    en: ['Remove ads, keep real results', 'Show the 10 best results first', 'Make text bigger'],
  },
  home: {
    bn: ['শুধু সবচেয়ে গুরুত্বপূর্ণ খবর দেখাও', 'মেনু ছোট করো', 'বিজ্ঞাপন সরাও'],
    en: ['Show only the most important items', 'Shorten the menu', 'Remove ads'],
  },
  article: {
    bn: ['শুধু মূল লেখা রাখো, বড় অক্ষরে', 'এক লাইনে সারসংক্ষেপ দাও', 'বিজ্ঞাপন আর পপআপ সরাও'],
    en: ['Keep only the article, large text', 'Add a one-line summary', 'Remove ads and popups'],
  },
  form: {
    bn: ['এই সরকারি ফর্মটা বড় করো', 'ঘরগুলো ধাপে ধাপে দেখাও', 'প্রতিটি ঘরের সহজ ব্যাখ্যা দাও'],
    en: ['Make this govt form bigger', 'Show the fields step by step', 'Explain each field simply'],
  },
  notice: {
    bn: ['তারিখ আর শেষ সময় সবার আগে দেখাও', 'সব PDF লিংক আলাদা করো', 'সহজ ভাষায় সারাংশ দাও'],
    en: ['Show dates and deadlines first', 'List all PDF attachments', 'Summarize in simple words'],
  },
  result: {
    bn: ['আমার ফলাফল বড় করে দেখাও', 'শুধু নম্বর আর গ্রেড রাখো', 'প্রিন্টের জন্য সাজাও'],
    en: ['Show my result large', 'Keep only marks and grade', 'Format for printing'],
  },
  product: {
    bn: ['দাম আর ডেলিভারি আগে দেখাও', 'ভুয়া কাউন্টডাউন সরাও', 'শুধু আসল রিভিউ রাখো'],
    en: ['Show price and delivery first', 'Remove fake countdown timers', 'Keep only genuine reviews'],
  },
  checkout: {
    bn: ['মোট খরচ আর ফি স্পষ্ট করো', 'অতিরিক্ত অফার লুকাও', 'ধাপে ধাপে দেখাও'],
    en: ['Make total cost and fees clear', 'Hide extra offers', 'Show it step by step'],
  },
  login: {
    bn: ['শুধু লগইন ঘর রাখো', 'লেখা বড় করো', 'বিজ্ঞাপন সরাও'],
    en: ['Keep only the login fields', 'Make text bigger', 'Remove ads'],
  },
  doc: {
    bn: ['কোড ঠিক রেখে শুধু মূল অংশ দেখাও', 'সাইডবার সরাও', 'গুরুত্বপূর্ণ সতর্কতা আগে দেখাও'],
    en: ['Keep the code, show only the core', 'Remove the sidebar', 'Show important warnings first'],
  },
  thread: {
    bn: ['সেরা উত্তরগুলো আগে দেখাও', 'অপ্রাসঙ্গিক মন্তব্য সরাও', 'শুধু সমাধান রাখো'],
    en: ['Show the best answers first', 'Remove off-topic comments', 'Keep only the solution'],
  },
  table: {
    bn: ['পুরোনো ডিজাইন সাজিয়ে পড়ার মতো করো', 'টেবিল বড় করো', 'অপ্রয়োজনীয় ছবি সরাও'],
    en: ['Reflow this old layout to be readable', 'Make tables bigger', 'Remove needless images'],
  },
  generic: {
    bn: ['বিজ্ঞাপন আর পপআপ সরাও', 'লেখা বড় করো', 'শুধু মূল কনটেন্ট দেখাও'],
    en: ['Remove ads and popups', 'Make text bigger', 'Show only the main content'],
  },
};

export function examplesFor(kind, lang) {
  const set = EX[kind] || EX.generic;
  return (set[lang] || set.en).slice(0, 3);
}
