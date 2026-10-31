// PuryWeb — prompts/base-prompts.js
// 30 category base prompts (+ generic fallback). Each states what to REMOVE, what to KEEP and
// DESIGN rules expressed as plan structure (sections / highlights / steps) — never as HTML.
// Users can edit, duplicate, delete these and add their own in the Prompt Lab (Phase 8).

const P = (id, name, remove, keep, design) => Object.freeze({ id, name, builtin: true, remove, keep, design });

export const BASE_PROMPTS = Object.freeze([
  P('youtube-watch', 'YouTube — Watch',
    'Hide: recommended/related videos, Shorts shelves, ads and sponsored cards, merch/ticket shelves, live chat replay, end-screen suggestions, "people also watched", subscribe nags.',
    'Keep: the video, title, channel name, views/date line, description, and comments (comments stay unless the user says otherwise).',
    'Order: video, title, channel facts as highlights, description section, comments section. Put the most useful description lines first (chapters, links). Two sections maximum plus comments.'),

  P('youtube-home', 'YouTube — Home',
    'Hide: Shorts shelves and any card tagged "short", ads, sponsored cards, news/trending shelves, clickbait duplicates, "mixes" the user did not ask for.',
    'Keep: genuine long-form video cards with title, channel, views and age. Keep the order the site gave.',
    'One section "For you". If the user asks for a topic, make one section per topic and group cards by their ids. Never hide more than half the cards unless asked.'),

  P('youtube-search', 'YouTube — Search results',
    'Hide: ads, Shorts shelves, "people also search", promoted playlists, duplicate reuploads of the same title.',
    'Keep: video and channel results that match the search, with title, channel and meta.',
    'Sections: "Best matches" (first 6-8 results) then "More results". Keep ranking order inside each section.'),

  P('youtube-shorts', 'YouTube — Shorts',
    'Hide: comment spam, ads, recommendation overlays, sound/effect clutter, follow nags.',
    'Keep: the short itself, its title/caption, creator, and the main comments.',
    'One section for the clip, one for comments. Offer a warning "Shorts are designed to be endless" only if the user asked for focus.'),

  P('facebook-feed', 'Facebook — Feed',
    'Hide: sponsored posts, "suggested for you", "people you may know", reels shelves, stories bar, marketplace/groups promos, engagement bait ("share if you agree").',
    'Keep: posts from friends, pages and groups the user follows, with author, time, text, and images.',
    'Single column "Your feed". One block group per post. Order newest first only if timestamps are present, otherwise keep original order.'),

  P('facebook-post', 'Facebook — Single post',
    'Hide: sponsored items, suggested posts, reaction/share prompts, sidebar contacts, chat heads.',
    'Keep: the post (author, time, text, media) and its comments.',
    'Sections: "Post" then "Comments". Keep comment order. Highlights: author and date.'),

  P('instagram-feed', 'Instagram',
    'Hide: ads, "suggested posts", reels carousels, notification nags, "open in app" banners.',
    'Keep: posts with image, caption, author, and comments if visible.',
    'Single column grid. One block group per post with caption directly under the image.'),

  P('twitter-feed', 'X / Twitter',
    'Hide: promoted posts, "who to follow", trending panels, premium upsells, engagement-bait replies, ratio-farming quote chains.',
    'Keep: posts from followed accounts and the focused thread, with author, text, media and time.',
    'Section "Timeline" or "Thread". Keep thread order strictly chronological.'),

  P('reddit-thread', 'Reddit — Thread',
    'Hide: ads, "popular communities", awards animations, app-install popups, joke chains that add no information, bot replies.',
    'Keep: the post, OP edits, top comments with their nesting, and links shared by commenters.',
    'Sections: "Post", "Top answers" (highest-value comments first), "Discussion". Highlights: subreddit and score if present.'),

  P('linkedin-feed', 'LinkedIn — Feed',
    'Hide: promoted posts, "recommended for you", game/puzzle widgets, premium upsells, engagement-bait ("agree?"), reposts without commentary.',
    'Keep: posts with substantive text, job posts the user follows, and messages notices.',
    'Single column. Each post: author headline as highlight, text, then media.'),

  P('gov-form', 'Government — Form',
    'Hide: marquee scrolls, banner ads, visitor counters, duplicate menus, social links, decorative images, unrelated news tickers. Never hide any form field or button.',
    'Keep: every form field, its instructions, validation notes, required markers, captcha, the declaration text and the original submit action.',
    'Group fields into 3-6 "steps" by their section meaning (personal info, address, education, documents, declaration). Rewrite unclear labels in plain language; mark required fields; add one-line hints for date and file formats. primaryActionId must be the original submit button. Never merge or drop fields.'),

  P('gov-notice', 'Government — Notice / Circular',
    'Hide: portal menus, scrolling tickers, flags and logos used as decoration, visitor counters, repeated header text.',
    'Keep: notice title, reference number, date, issuing office, body text, tables, attachments (PDF links), contact details, signature block.',
    'Highlights: Date, Reference No, Issued by, Deadline (only if present). Section "Notice" then "Attachments" listing every PDF/link. Put deadlines in highlights and add a warning when a deadline exists.'),

  P('gov-result', 'Result page',
    'Hide: ads, unrelated notices, marquee text, social links, repeated headers.',
    'Keep: the result lookup form, result tables, student/roll/registration details, grades/GPA/marks, remarks, print/download actions.',
    'Highlights: Name, Roll, Result/GPA. Keep tables whole and in order. If a lookup form exists, make it the first step and keep every field, including captcha.'),

  P('gov-portal-home', 'Government — Portal home',
    'Hide: scrolling tickers, banner carousels, visitor counters, duplicated menus, foreign-language duplicates, decorative photos.',
    'Keep: top services, notices and news, important links, search, contact/helpline, and the office name.',
    'Sections: "Popular services" (link groups), "Latest notices", "Contact". Collapse the long mega-menu into at most 3 link groups.'),

  P('news-article', 'News article',
    'Hide: ads, newsletter and subscribe popups, share bars, "related stories", "trending", comment widgets, paywall nags, live-blog tickers, auto-play video.',
    'Keep: headline, byline, dateline/time, standfirst, article body in full, images with captions, pull quotes, sources.',
    'Section order: headline context as highlights (Author, Published), body. Never shorten the body. Summary: one neutral sentence, no opinion.'),

  P('news-home', 'News homepage',
    'Hide: ads, sponsored stories, clickbait duplicates, horoscope/gossip shelves (unless asked), stock tickers, auto-play video, popups.',
    'Keep: top stories with headline, image and time; section names.',
    'Sections: "Top stories" (first 5), then one section per news section found. Keep headline text exactly.'),

  P('e-commerce-product', 'Product page',
    'Hide: popups, countdown pressure timers, fake "x people viewing" counters, sponsored products, upsell bundles, chat widgets, review-farm badges.',
    'Keep: product name, price (and old price/discount if shown), variants, stock status, delivery info, specs, key images, seller, real customer reviews and ratings.',
    'Highlights: Price, Rating, Delivery, Seller, Warranty (only those present). Sections: "Details", "Specifications", "Reviews". primaryActionId is the add-to-cart/buy action when it exists.'),

  P('e-commerce-listing', 'Product listing',
    'Hide: sponsored listings, banners, "frequently bought together", pop-up coupons, duplicate listings.',
    'Keep: product cards with title, price, rating, image, delivery note; filters and sorting if present.',
    'Section "Results". Keep order. Do not reorder by price unless the user asks. Highlights: number of results if shown.'),

  P('e-commerce-checkout', 'Cart & checkout',
    'Hide: upsells, cross-sell carousels, countdown pressure, promo popups. Never hide fields, totals, fees or terms.',
    'Keep: items, quantities, prices, shipping/billing fields, delivery options, payment choices, totals, fees, taxes, terms, the order button.',
    'Steps: Contact, Delivery, Payment, Review. Highlights: Total, Delivery fee. Add a warning for any extra fee or auto-selected add-on. primaryActionId is the final place-order action.'),

  P('blog-post', 'Blog post',
    'Hide: ads, subscribe popups, share bars, author-bio promos, related posts, sticky headers, cookie banners.',
    'Keep: title, author, date, reading body, code blocks, images with captions, footnotes, the comment section.',
    'Sections: body, then comments. Highlights: Author, Date, Reading time (only if present).'),

  P('old-table-site', 'Legacy table-layout site',
    'Hide: marquee/blink text, spacer images, decorative GIFs, hit counters, empty layout cells, repeated navigation rows.',
    'Keep: all real content: headings, text, data tables, forms, downloads, contact info.',
    'Rebuild the reading order top-to-bottom ignoring the old table layout. Group content under headings. Data tables stay as tables, layout cells become sections.'),

  P('wikipedia-article', 'Wiki article',
    'Hide: edit links, navboxes, maintenance banners, "see also" boxes unless asked, donation banners.',
    'Keep: lead, section headings and text, infobox facts, images with captions, references list link.',
    'Highlights from the infobox (up to 8). Sections follow the article headings exactly.'),

  P('documentation', 'Documentation page',
    'Hide: cookie banners, version upsells, feedback widgets, sidebar trees, "was this helpful", marketing banners.',
    'Keep: headings, explanations, code blocks (exact), tables, warnings and notes, prev/next links.',
    'Sections follow the page headings. Never alter code. Warnings array may repeat important caution/deprecation notes.'),

  P('forum-thread', 'Forum thread',
    'Hide: signatures, ads, avatars/badges clutter, "like" counters, off-topic chains, repeated quotes of whole posts.',
    'Keep: original question, accepted/best answers, code, links, moderator notes.',
    'Sections: "Question", "Best answers", "Discussion". Highlights: Solved/Accepted status when present.'),

  P('login-page', 'Login / sign-in',
    'Hide: promo banners, footers, social proof carousels, language/country clutter. Never hide fields.',
    'Keep: username/email and password fields, remember-me, forgot-password, sign-up link, social login choices, captcha, the login action.',
    'One step "Sign in". Labels short and clear. primaryActionId is the login action. Add a warning only if the page shows a security notice.'),

  P('search-results', 'Search results',
    'Hide: ads, sponsored results, "people also ask" fillers, AI-generated filler panels, shopping carousels, duplicate links.',
    'Keep: organic results with title, URL host and snippet; spelling suggestion; related searches (bottom).',
    'Section "Results" in original order. Highlights: result count if present.'),

  P('video-platform-other', 'Video platform',
    'Hide: autoplay next, recommendations, ads, promo banners, chat overlays, cookie banners.',
    'Keep: video, title, uploader, description, chapters, comments.',
    'Sections: video + facts, description, comments.'),

  P('recipe', 'Recipe',
    'Hide: life-story preamble, ads, pop-ups, "jump to recipe" fluff, related recipes, share bars.',
    'Keep: title, times, servings, ingredients (exact quantities), numbered method, notes, nutrition, photos.',
    'Highlights: Prep, Cook, Servings. Sections: "Ingredients" then "Method" then "Notes". Never change quantities.'),

  P('job-listing', 'Job listing',
    'Hide: ads, "similar jobs", company promo banners, recruiter spam, sign-up nags.',
    'Keep: job title, employer, location, type, salary, deadline, responsibilities, requirements, how to apply, apply action.',
    'Highlights: Employer, Location, Salary, Deadline. Sections: "Responsibilities", "Requirements", "How to apply". primaryActionId is the apply action.'),

  P('university-portal', 'University portal',
    'Hide: scrolling notices, banner ads, duplicate menus, social links, decorative photos. Never hide fields or buttons.',
    'Keep: student/course/admission forms, results and tables, notices with dates, deadlines, payment info, contact details.',
    'For forms use steps like gov-form. For tables keep them whole. Highlights for deadlines and fees. Add a warning when a deadline is near or fees are due.'),
]);

export const GENERIC_PROMPT = P('generic', 'Generic page',
  'Hide: ads, popups, cookie/consent banners, newsletter prompts, share bars, sidebars, related-content widgets, sticky bars, autoplay media.',
  'Keep: main heading, all main content in order, data tables, forms and their actions, important links and images with captions.',
  'Single reading column. Group content under the page\'s own headings. Add highlights only for facts that are clearly key (dates, prices, deadlines).');

const BY_ID = new Map([...BASE_PROMPTS, GENERIC_PROMPT].map((p) => [p.id, p]));

export const BASE_PROMPT_IDS = Object.freeze(BASE_PROMPTS.map((p) => p.id));
export const getBasePrompt = (id) => BY_ID.get(id) || GENERIC_PROMPT;
