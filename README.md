# base31.org
Google Analytics verification. The tag below is Google's own snippet, served
inline in the `<head>` from `app/layout.tsx` (the id lives in `lib/analytics.ts`)
first thing on every page, so it is part of the HTML Google is asked to verify
instead of being appended after the page has loaded. It runs on every visit —
before the cookie banner is answered and whatever the answer turns out to be —
because a tag that waits for a click is invisible to the check it exists for.
The banner still decides whether Microsoft Clarity records a session and whether
the ad network loads.

  add this code to the main page of base31:   
  <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-W6J79P13FT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-W6J79P13FT');
</script>  


   Below is the Google tag for this account. Copy and paste it in the code of every page of your website, immediately after the <head> element. Don’t add more than one Google tag to each page.  
     
  
A homepage/directory for `base31.org` that lists every subdomain site, plus
the sites themselves — all deployed together as one Vercel project.

## How it works

- `middleware.ts` looks at the request's `Host` header. If it's a subdomain
  of `base31.org` (e.g. `example.base31.org`), it rewrites the request to
  the matching folder under `public/sites/<subdomain>/`. If it's the bare
  domain (`base31.org` / `www.base31.org`), the request passes through
  normally and Next.js renders the homepage.
- The homepage (`app/page.tsx`) reads `config/sites.json` and lists every
  entry marked `"show": true` as a directory card.
- Each subdomain site is a **plain static site** (HTML/CSS/JS, no build
  step) living in its own folder under `public/sites/`. This keeps adding a
  new site as simple as dropping in a folder.

```
├── config/
│   ├── sites.json         ← the directory's data (edit this)
│   ├── blogs.json         ← SEO blog posts
│   ├── donations.json     ← donation board entries
│   ├── referrals.json     ← sponsored referral carousel
│   ├── cool-sites.json    ← "Other cool sites" strip
│   └── cool-apis.json     ← "Cool APIs" strip
├── public/
│   ├── site-icons/        ← one favicon per directory entry
│   └── sites/
│       └── example/       ← one subfolder per subdomain
│           └── index.html
├── middleware.ts           ← subdomain → folder routing
└── app/                    ← the homepage itself
```

## Adding a new site

1. Create a new folder: `public/sites/<subdomain>/` (e.g. `public/sites/blog/`).
2. Put a static `index.html` in it (plus any css/js/images it needs — link
   to them with relative paths, e.g. `<link href="style.css">`).
3. Add an entry to `config/sites.json`:

```json
{
  "name": "Blog",
  "subdomain": "blog",
  "url": "https://blog.base31.org",
  "tags": ["writing"],
  "description": "Long-form posts.",
  "show": true
}
```

4. Commit and push. Vercel builds and deploys automatically, and
   `blog.base31.org` starts working immediately (no separate deploy step
   needed) once the wildcard domain is set up — see below.

Set `"show": false` to keep a site live on its subdomain without listing it
on the homepage.

### A subdomain page's SEO checklist

`public/sites/share/` and `public/sites/appscreenshot/` are the two worked
examples of a full static page — copy their `<head>` when adding another. Each
one ships:

- a keyword-first `<title>`, a `<meta name="description">`, a `<link
  rel="canonical">` on its own subdomain, plus `robots`, `color-scheme`,
  `theme-color` and `application-name` tags.
- `og:*` and `twitter:*` tags. The social image points at the apex
  `https://base31.org/opengraph-image` (`app/opengraph-image.tsx`), because
  these folders hold no PNGs of their own.
- one `application/ld+json` `@graph` per page holding its `WebSite`, its
  `WebApplication` and — where the page shows a FAQ — an `FAQPage` whose
  `mainEntity` mirrors the visible `<details>` list. No node appears twice, and
  `publisher` / `isPartOf` reference the apex `https://base31.org/#organization`
  and `#website` ids from `components/structured-data.tsx`.
- its own `robots.txt` and `sitemap.xml`. The apex `app/robots.ts` and
  `app/sitemap.ts` only describe base31.org, and the middleware rewrites those
  paths on a subdomain to `<site>/robots.txt` / `<site>/sitemap.xml`.

Legal pages live on the apex, so a subdomain footer links out with absolute
URLs (`https://base31.org/terms`, `https://base31.org/privacy`) — `/terms` on
`example.base31.org` resolves under `public/sites/example/` and would 404.
`appscreenshot/index.html` also carries the Adcash auto-tag (zone
`iy7zk7mmw`, the same zone as `components/consent-aware-ads.tsx`) directly in
its `<head>`; the loader is `async`, so the page polls for `aclib` before
calling `runAutoTag`. Unlike the homepage it is ungated — that static page has
no cookie banner of its own.

## Referral carousel

The "Referrals worth a look" carousel sits just below the launch clock and is
labelled `ad`. It is driven by `config/referrals.json`:

```json
{
  "name": "Cloudflare",
  "url": "https://www.cloudflare.com/?ref=your-code",
  "description": "The edge network and DNS that keeps base31 fast.",
  "tag": "referral",
  "image": "https://example.com/custom-card.png",
  "show": true
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Shown on the card |
| `url` | yes | `https://` destination; put your referral/affiliate link here. Cards open in a new tab with `rel="noreferrer sponsored"` |
| `description` | yes | One sentence, at least 20 characters |
| `tag` | no | Small badge next to the name |
| `image` | no | Override the card image |
| `show` | no | `false` hides the entry |

If `image` is omitted the card shows a live screenshot of the destination
(WordPress mShots, no API key), falling back to the destination's own favicon
and then a lettered tile, so a blocked image never leaves an empty box. These
previews load whatever the visitor answered in the cookie banner — the card is
unusable without its picture, they set no cookies, and the privacy page says
so. Entries rotate
every 7 seconds (paused on hover or focus, and never auto-rotating when the
visitor prefers reduced motion), with arrows, dots, arrow-key and swipe
support.

Add entries to the array and the carousel picks them up — no code changes.
Run `npm run validate:content` to check `sites.json`, `blogs.json`,
`referrals.json` and `donations.json` (plus `cool-sites.json`,
`cool-apis.json` and `changelog.json`) in one go, and do it before pushing.

All the files under `config/` are imported straight into the build, so a file
that is not valid JSON stops the deploy before a single page renders, with an
unhelpful `Unexpected non-whitespace character` / `Expected ',' or ']'` from the
bundler. Two ways to do that by accident:

- An unescaped `"` inside a description or blog body string (`judging its
  "engagement" value` needs `\"`). This already took down one deploy.
- A new entry pasted **after** the array's closing `]` instead of before it,
  which leaves both the orphan object and a stray trailing comma.

## Sitemap, FAQ and on-page extras

- `app/sitemap.ts` is generated at build time from `lib/blogs.ts` (which reads
  `config/blogs.json` plus the editorial posts) and `config/sites.json`, so a
  new blog post or directory entry shows up in `/sitemap.xml` on the next
  deploy with nothing to update by hand. Sites with `"show": false` are  left out, and community uploads are not listed (they are only known at runtime).
- `/stats` and `/whats-new` are server-rendered inner pages. Neither uses
  `data-reveal`: the reveal observer lives in `app/page.tsx`, so a section
  marked for it on another route would stay at opacity 0. `/stats` reads
  `GET /stats` from the worker and caches for five minutes; `/whats-new`
  renders `config/changelog.json`. Both carry their own `openGraph` for the
  usual reason (see below).
- The changelog is newest-first, and its **top entry must match the `version`
  in `package.json`** — the footer prints that version and links it to
  `/whats-new`, and `/whats-new` opens by naming it. `npm run validate:content`
  fails if the two drift or if the list is out of order, so bump both in the
  same commit.
- Every published tool also has a guide at `/tools/<subdomain>`, generated
  from `lib/tool-pages.ts` plus its `config/sites.json` entry, with an index at
  `/tools`. The copy there is written fresh for search intent ("free qr code
  generator") rather than copied from the tool's own subdomain, so the two
  pages do not compete for the same query — each guide links out to the live
  tool, and the subdomain keeps its own canonical. A guide publishes one
  `@graph` with `WebPage`, `SoftwareApplication`, `BreadcrumbList` and
  `FAQPage`; it references the layout's `#website` and `#organization` by id
  instead of repeating them. `npm run validate:content` fails if a listed site
  has no guide, if a guide has no matching site, or if a guide's copy is thin
  (missing headline, an out-of-range meta description, fewer than two intro
  paragraphs, three features or two questions).
- There are three decorative sparkles, all Glitter Graphics GIFs with
  transparent backgrounds, served from this origin rather than hotlinked: a
  third-party image would be an unconsented request to someone else's CDN, and
  the file could be swapped upstream at any time. `public/header-sparkle.gif`
  (40×40) sits inside the wordmark link in the header; `public/footer-sparkle.gif`
  (64×64) sits in the bottom-of-page block, beside the sponsor line; and
  `public/about-sparkle.gif` sits at the top right of the "about the directory"
  heading, with its own credit link under the copy. All three are decorative
  (`alt=""`, the header one inside a link that already has a label), all three
  are hidden under `prefers-reduced-motion`, and the credit their source asks
  for is next to the copyright line in the footer.
- The bottom block is `components/footer-sponsor.tsx`, rendered at the end of
  `main` just above the footer. It exists as its own component so the bottom of
  the page can be edited without opening `app/page.tsx`, which is long enough
  that edits near its end are awkward.
- `/sponsor` documents the two paid slots (a referral carousel card and the
  support button), how to book one, and the house rules, and it doubles as the
  page-level disclosure for the sponsored cards. It is linked from the line
  under the referral carousel, from the bottom block, and from the footer. A
  directory listing is deliberately *not* for sale: publishing a community site
  is free, and that is stated on the page so nobody buys the wrong thing.
- `app/late.css` is imported last and holds small corrections to rules that
  already exist in `overrides.css`: same specificity, later file, so it wins.
  It is not the place for a component's main styling — that belongs in
  `overrides.css` or `inner-pages.css`.
- `app/inner-pages.css` styles those two routes and is imported after
  `overrides.css` in `app/layout.tsx`. `overrides.css` is deliberately left to
  the homepage: it is large enough that edits to it are no longer reliable.
- `components/faq.tsx` renders the FAQ above the footer together with its
  matching `FAQPage` structured data. Edit the `FAQS` array there and both the
  copy and the schema stay in sync. Every question is a native
  `<details>`/`<summary>` disclosure, so the list starts closed, toggles with
  no JavaScript, and keeps each answer in the served HTML — collapsing the
  list never hides the copy from a crawler, and the schema repeats it anyway.
- Structured data is split so no graph is emitted twice:
  `components/structured-data.tsx` is rendered once from the root layout and
  holds the page-agnostic `Organization` + `WebSite` nodes (the site's
  `publisher`), while `app/page.tsx` adds the directory's `ItemList`. Any new
  schema belongs to exactly one of those, not both.
- Setting `openGraph` in a page's `metadata` replaces the layout's object
  rather than merging it, so `/about`, `/privacy`, `/terms` and the blog repeat
  `siteName`, `locale` and a page-accurate `url` — otherwise `og:url` would
  point at the homepage while `canonical` said otherwise.
- Sections marked `data-reveal` fade in as they scroll into view. The gate is
  the `data-motion="enabled"` attribute that `app/layout.tsx` adds before first paint, so nothing is
  ever hidden for visitors without JavaScript, and it is skipped entirely for
  `prefers-reduced-motion`.
- The "has been revealed" marker is the `data-revealed` **attribute**, not a
  class. React rewrites `class` whenever a card's `className` prop changes —
  pinning a site adds `is-pinned` — which wiped the observer's class and left
  that card stuck at opacity 0 as a blank gap. Keep the marker off the
  `className` string.
- The homepage nudges visitors who move their pointer out of the top of the
  window with a "wait, don't go" dialog suggesting a site they have not seen.
  It is desktop-pointer only, waits 8 seconds, shows at most once per session,
  and never appears over another dialog.
- Every directory card leads with the site's own favicon. Kept sites serve it
  from this project at `public/site-icons/<subdomain>.svg` — same-origin, so it
  costs no third-party request — and `SiteIcon` in `app/page.tsx` falls back to
  a generated tile if that image is missing or blocked. A community upload has
  no icon here, so its card asks its own origin for `/favicon.ico`. Point an
  entry somewhere else with `"icon": "/path.svg"`. `npm run validate:content`
  fails if a site has no favicon file, so a new entry cannot ship without one.
  The generated tile is `SITE_GLYPHS` + a hashed HSL gradient, kept as the
  fallback; add a shape by appending to that array.
- Community uploads fresh within 14 days get a `new` badge.
- The "Featured sites" heading *is* the minimize control: the label is
  underlined and the chevron sits beside it with no box of its own, and both
  live inside the same `.sites-toggle` button, so clicking either the text or
  the arrow opens and closes the directory (filters, sort and every card)
  without clearing the visitor's search or tag. The panel is
  `<div id="sites-panel">` behind `aria-expanded`/`aria-controls`, hidden with
  the `hidden` attribute, and the arrow rotates to `-90deg` when collapsed.
- "Surprise me" in the hero opens a random entry — from the current filter
  results when a search is active, otherwise from the whole directory. It is
  styled as a green pill with a bolt badge (`.surprise-button` in
  `app/overrides.css`) rather than a plain text link, and its sheen/spin is
  disabled under `prefers-reduced-motion`.
- The hero search reaches both strips under the directory, not only the
directory itself: `searchCoolSites` in `lib/cool-sites.ts` and
`searchCoolApis` in `lib/cool-apis.ts` are the matchers those places share, so a
query that matches an off-directory pick opens the strip (if it was folded
away), filters its cards, changes its count to `n of <total>`, and is named in
the directory's empty state instead of dead-ending there.
- "Other cool sites" (`config/cool-sites.json`) and "Cool APIs"
  (`config/cool-apis.json`) are the same section twice: a foldable strip of
  small external cards, each one a name, a host and one line of why it is worth
  the trip. Both are rendered by `components/link-strip.tsx`, which owns the
  folding heading, the count, the search and the card markup; the two files
  beside it only supply their list and their dictionary strings, so the strips
  cannot drift apart. Entries are external URLs by design — the validator
  rejects anything pointing at a base31.org subdomain, which belongs in
  `sites.json` instead.
- A column of small lines down the right edge (`components/section-rail.tsx`)
is the section readout and the fast way between sections. It is always visible,
from the first screen on at every width: full size with sliding labels on a
wide monitor, shorter bars without labels below 1180px, and a slim strip of bars
below 820px.
The line for the section you are reading rotates flat-to-vertical and turns
green while its label slides out; clicking a line scrolls there and a wheel over
the rail steps one section at a time. That listener is attached by hand with
`{ passive: false }` because React registers `wheel` passively, so
`preventDefault` inside `onWheel` would be a no-op. The section list and its
labels live in `components/home-page.tsx`.
- The directory is filterable by tag (chips built from `config/sites.json`,
  most used first, capped at `MAX_TAG_CHIPS`) and sortable by **Most liked**,
  **Newest** or **A–Z**. Pinned sites stay on top in every mode, and a tag or
  sort choice narrows what "Surprise me" picks from.
- On a 1000px-and-wider screen the shell is 1080px and the directory is a
  two-column grid; the donation board and prose stay capped at a readable
  measure so the extra width goes to the cards.
- The **support button** at the foot of `main` (`.support-ad`) is the sponsored
  strip that pays for the page: an `ad` tag, "Want to support base31? Click this
  button to help", and an arrow, linking out with `rel="noreferrer sponsored"`.
  It sits directly under the referral carousel where it lived before, is a
  plain link, and therefore needs no consent gate. Its base rule is in
  `globals.css` (dashed frame); the solid material, hover lift and the tag/text/
  arrow pieces are in `app/overrides.css`.
- The hero search is one solid control (`.search-wrap` in `app/overrides.css`):
  a raised field, the glyph in its own tile, a green ring on focus, and a
  clear button that takes the place of the `/` hint once there is a query.
- Two display faces are loaded through `next/font/google` in `app/layout.tsx`,
  which self-hosts the files and exposes them as `--font-display` (Titan One,
  used for the names on the cards) and `--font-hand` (Gochi Hand, used for the
  header text: the wordmark and the homepage headline). Because next/font
  downloads them at build time, no page ever requests fonts.googleapis.com, and
  `app/late.css` holds the rules that apply them — the only place a face is
  named.
- `.section-divider` is the styled `<hr>` between the homepage's standalone
  blocks (supporters, launch clock, referrals): a hairline that fades at both
  edges with a diamond marker. It owns the gap on both sides through
  `.section-divider + *`, so the blocks keep their own top margins only when
  they are *not* following a divider — do not add spacing to those instead.
- Every full-width block (donation board, launch clock, referrals and "stay in
  the loop") shares one radius via the `--radius-card` token, so the page has a
  single card silhouette.
- The header is the app bar: `position: fixed` over a blurred, mostly opaque
  background. `body:has(.site-header) { padding-top: 64px }` (58px on narrow
  screens) gives the bar's height back to the flow, so nothing else moved when
  it left the flow — keep those two numbers in sync if the bar's height
  changes. The `:has()` scope matters: the blog, about, privacy and error pages
  render no header, and must not inherit its offset. Every `[id]` carries a
  matching `scroll-margin-top`, so in-page anchors still land below the bar.
- The header's right-hand slot holds `components/github-stats.tsx` — the GitHub
  mark, the repository's commit count and a small "commits" label, linking to
  the source. It replaced the Share button; the share sheet is still reachable
  with the `S` shortcut, which was never the button's own handler.
  - The count comes from the public GitHub API with no key: one commit per
    page, and the last page number in the `Link` response header is the total.
    It is cached in `localStorage` for an hour because the unauthenticated API
    allows only 60 requests per hour per IP. A refused request leaves the dash
    in place — the link still works, it just shows no number.
- The header markup lives in `components/site-header.tsx` so the homepage below
  the fold stays editable. The language switcher is no longer in it: the four
  locales sit in the footer on their own row, under the links and the contact
  details, and the footer band itself carries a solid `--surface` tint instead
  of the page background.
- The subscribe block (`components/directory-notifications.tsx`, `#updates`)
  is the last thing in `main`, directly above the footer and *below* the FAQ,
  so the page ends on the call to action. Its email field and the button beside
  it share the softer 14px rounding of the site's own input box
  (`.search-wrap`); everything else about the block is unchanged.
- `components/code-backdrop.tsx` is the typing-code wallpaper behind the page.
  It is server rendered and CSS-only: no JavaScript, no timer, one stepped
  width animation per line, staggered with negative delays so the lines never
  restart in sync. It is `aria-hidden`, ignores pointer events, and every line
  is measured in `ch` so it types exactly as wide as its own text.
- A directory card is one link (`.site-card-body` — the preview band, the
  centred title, the favicon + host row, the description and the tags). The pin
  and the two votes both stay outside that link: the pin floats at the card's
  top-right corner over the preview (`.favorite-button`, absolutely positioned,
  a translucent dark pill so the white heart reads on any screenshot in either
  theme) and the votes live in the `.site-card-foot` bar underneath. Keeping
  the buttons outside the link is what lets the whole information block be
  clickable without nesting interactive elements. Pinned cards get a green
  spine; `SiteIcon` is 38px (34px on phones).
- The site name is the card's title: centred on its own line, above
  `.site-card-strip` (a green gradient band that fades out at both ends and
  carries a soft glow) and the centred meta row holding the favicon, the host
  and the `↗` marker underneath it. That is why `.site-card-info` centres its
  children and the old `.site-card-ident` column is gone — the name is no
  longer part of the meta row. `SiteIcon` moved down into that row with it,
  and `.site-name` keeps `min-width: 0` so an overlong name still ellipsizes
  instead of pushing the card wider.
- The two thumbs are stacked in `.vote-stack` with the up vote above the down
  vote, so the pair reads as one control; the pin stays beside the stack,
  vertically centred by `.site-actions`. The footer bar now holds only the two
  votes, so it keeps a shallow `3px 15px 7px` padding that lifts the thumbs a
  little higher in the card; phones tighten it further through a
  `.site-card .site-card-foot` override (one extra class, so it wins whatever
  the source order).
- Every card opens with a screenshot of its destination — the WordPress mShots
  call the referral carousel uses, with thum.io (which the App Screenshot page
  already depends on) as a second try, so every kept site gets a preview with
  no image to maintain and no API key (see `SitePreview` in `app/page.tsx`). A gradient fades the shot into `--surface`, which is why the
  card's fill is a solid `--surface` and never changes on hover: a moving fill
  would leave a seam where the fade meets the body. The band keeps the site's
  hashed gradient underneath, so a slow or blocked screenshot still shows a
  deliberate tile instead of a grey box.
- Both the chips and the sort options are filled controls (solid fill, visible
  edge, shadow, and a pressed state) rather than outlines, and the card tags
  are filled chips in the same material. The active sort option is the raised
  key in a recessed rail.
- The footer's **Source code** button is the GitHub link, kept beside the plain
  footer links (`.footer-source`).
- Dark/light switching eases every surface at once. `switchTheme` in
  `app/page.tsx` adds `theme-fade` to `<html>`, flushes the layout, then flips
  the theme, and removes the class after 480ms, so the transition only covers
  the swap; the rule is inside `@media (prefers-reduced-motion:
  no-preference)` as well as guarded in JS. The class is removed on unmount
  too, because `<html>` outlives client-side navigation.

## Accessibility notes

- Dialogs (share, milestone, publish, exit nudge) move focus in when they open,
  keep Tab inside, and hand focus back to whatever opened them — see
  `useDialogFocus` in `app/page.tsx`.
- `.sr-only` is defined in `app/overrides.css`. `globals.css` is hand-written
  CSS with no Tailwind utilities layer, so every `sr-only` label in this
  project would otherwise print into the page.
- The search field is inside a `role="search"` landmark and names itself with
  `aria-label="Search all sites"`. It used to be wrapped in a `<label>` whose
  only text was the "/" shortcut hint, so the field was announced as "/".
- The search clear button is labelled "Clear the search" and hands focus back
  to the field, so clearing never drops keyboard users off the input. The
  browser's own clear glyph is suppressed in favour of it.
- The code backdrop is decorative, so it is `aria-hidden` and skipped entirely
  under `prefers-reduced-motion` rather than left as a column of carets. Vote
  and pin buttons stay outside the card's link, so no control is focused twice.
- The launch clock's ticking tiles are `aria-hidden`, with a static sentence
  for assistive tech instead — otherwise a screen reader chases a number that
  changes every second.
- Vote counts are `aria-hidden` too; the button's own label already carries the
  number, so they are not read twice.
- The FAQ's questions are `<summary>` elements rather than headings with click
  handlers, so Enter/Space opens them and the closed/open state is announced
  for free; the native marker is replaced by `.faq-chevron`, which is
  `aria-hidden` because the disclosure state already says the same thing.
- External links (directory cards, referral cards) carry a visually hidden
  "opens in a new tab" hint.
- Pin and vote buttons grow from 27px to 38–40px under `(pointer: coarse)`
  without changing their mouse appearance.
- A "Skip to the directory" link is the first focusable element on the page.
- `:focus-visible` gets a green ring; `globals.css` ships no focus rule at all.
- `--subtle` is overridden to `#8f8f8f` (dark) / `#6b6b6b` (light) because the
  original values sat just under 4.5:1 for the 9–10px labels.
- The custom cursor keeps the native caret over inputs and textareas.
- The Vibration API, confetti, flip clock, scroll reveals, the exit-intent
  nudge, the FAQ chevron flip, `scroll-behavior: smooth` and carousel
  auto-rotation are all skipped under `prefers-reduced-motion`, and the reveal
  gate (`html[data-motion="enabled"]`) is never applied without JavaScript.
- The blog ships an RSS feed at `/blog/feed.xml` and a JSON Feed 1.1 twin at
  `/blog/feed.json`, both generated from `lib/blogs.ts` and advertised with
  `<link rel="alternate">`. Posts also show a reading time and a "read next"
  list of the other posts.

## Cookies, ads and analytics

The Google tag runs on every visit and is deliberately not gated; everything
else waits for the visitor's answer, and that answer is the switch for session
recording and for ads. The tag is not gated because Google verifies the property
from the tag it is served — anything that waits for a click fails the check it
exists for. The other things that load either way are the destination preview
images on every directory card and in the referral carousel and each community
upload's own favicon — both decorative, both cookie-free:

| Component | Runs when |
| --- | --- |
| `app/layout.tsx` | The Google tag (gtag.js) for `G-W6J79P13FT`, in `<head>` on every page, on every visit — before the answer and whatever it is |
| `components/consent-aware-analytics.tsx` | Microsoft Clarity (`ylsxc7fokm`), only on `accepted` |
| `components/consent-aware-ads.tsx` | Adcash auto-tag (`iy7zk7mmw`), only on `accepted` |
| `public/sites/appscreenshot/index.html`, `public/sites/share/index.html` | Never gated: these static subdomain pages render outside Next.js and carry no cookie banner, so the same Adcash auto-tag sits directly in their `<head>` (the async loader is polled for `aclib` before the tag runs). |
| `components/referral-carousel.tsx` | Never gated: the destination preview image loads straight from the destination (or a screenshot service) because the card is unusable without it. It sets no cookies, the sponsored links stay inert until clicked, and the privacy page says so. |

The Adcash script loader (`https://acscdn.com/script/aclib.js`) is inserted only
after the visitor accepts, then runs the supplied auto-tag for zone
`iy7zk7mmw`. Denying or withdrawing consent prevents the loader from being
inserted (and removes its script element if consent changes after it loads).

Clarity is inserted into the page only on `accepted`, and its snippet appends its
loader under `microsoft-clarity-loader` so withdrawing the choice removes what the
page can remove. A library that already fetched stays loaded until the next page
load, which is what the privacy page says — so never claim a withdrawal unloads a
script that has already run. The Google tag is never removed: it is part of the
page, it runs either way, and `lib/analytics.ts` holds the one measurement id
that both the loader URL and the `config` call are built from.

`lib/consent.ts` holds the `base31-consent` key, a `useConsent()` hook and the
`base31-consent-change` event that keeps them in sync. `PrivacyConsent`
(`components/privacy-consent.tsx`) re-appears whenever the choice is cleared,
which is what the footer's **Cookie settings** button does — so a visitor can
withdraw or change consent later without clearing site data by hand.

> The `subdomain` value and the folder name under `public/sites/` must
> match exactly.

## One-time Vercel/domain setup

Wildcard subdomains on Vercel require your domain to use **Vercel's
nameservers** (this is required on every plan, including the free Hobby plan).
The wildcard certificate is proved with a DNS-01 challenge, so Vercel has to own
the zone to answer it. Nothing else here depends on the nameservers — only
`*.base31.org` does.

1. Push this repo to GitHub and import it as a new Vercel project.
2. In the project's **Settings → Domains**, add `base31.org`.
3. Since you bought the domain through Vercel, its nameservers are already
   Vercel's — nothing to change there.
4. Still in **Settings → Domains**, add a second domain: `*.base31.org`
   (the wildcard). Vercel will confirm it can issue certificates for it.
5. Push a commit — that's it. Any folder you add under `public/sites/` with
   a matching `config/sites.json` entry is live on its subdomain right
   away, no per-site deploy needed.

Run `npm run check:domain` after any DNS change. It resolves the nameservers,
the apex, `www`, one real directory subdomain and the mail records, and exits
non-zero while something required is missing.

### Do not move the nameservers away from Vercel

Pointing the domain at another DNS host — Cloudflare, for example, to use
**Cloudflare Email Routing** for an `@base31.org` inbox — moves the zone, and
the web records do not come with it. The domain then resolves to nothing:

- `base31.org`, `www.base31.org` and every `*.base31.org` answer NXDOMAIN, so
  the directory is unreachable however the last deploy went.
- Vercel lists `base31.org` and `*.base31.org` as **Invalid Configuration** and
  cannot issue the wildcard certificate while the zone is hosted elsewhere.
- A deployment that looks like it failed is usually this: the build is fine and
  the domain is what is broken. Check **Settings → Domains** before rebuilding.
- Record types do not carry over either. Resend's DKIM and `send` records, for
  instance, live in whatever zone held them before the switch.

Cloudflare Email Routing requires Cloudflare's nameservers, so it cannot be
combined with the wildcard. Pick one:

- **Keep the wildcard (recommended).** Set the nameservers back to
  `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Vercel's zone still holds the
  records added there — the apex, `www`, the wildcard, and the Resend ones from
  the section below — so they start resolving again as the change propagates
  (NS answers are cached for up to a day). Then get the `hello@base31.org`
  inbox from a provider that works through plain MX records: a mailbox host, or
  a forwarding service such as ImprovMX or ForwardEmail, with its MX and TXT
  records added in Vercel's DNS.
- **Keep Cloudflare's nameservers.** Recreate the web records in the Cloudflare
  DNS dashboard with **Proxy off** (grey cloud) on each one:

  | Type | Name | Value |
  | --- | --- | --- |
  | `A` | `@` | `76.76.21.21` |
  | `CNAME` | `www` | `cname.vercel-dns.com` |
  | `CNAME` | `*` | `cname.vercel-dns.com` |

  Leave the existing apex MX/TXT alone, since Cloudflare Email Routing needs
  them, and re-add Resend's records (`npm run check:mail` names the missing
  ones). The catch: Vercel still cannot verify `*.base31.org` without its own
  nameservers, so every subdomain has to be added in **Settings → Domains** by
  hand and a new folder under `public/sites/` is no longer live on its own.

## Local development

```bash
npm install
npm run dev
```

Subdomains don't resolve on `localhost` by default. To test one locally,
visit `http://example.localhost:3000` (the middleware treats `*.localhost`
the same way it treats `*.base31.org`).

Run `npm run check` before pushing: it validates the content files, typechecks,
and lints. Dependabot (`.github/dependabot.yml`) opens one grouped pull request
each week for minor and patch bumps and leaves major versions as their own PR,
so a red check on a dependency PR is worth reading before merging it.

## Counters and votes (Cloudflare Workers)

The directory's live view counter and the shared thumbs up/down totals are
served by a small Cloudflare Worker backed by Cloudflare KV, deployed from
`worker/` with Wrangler.

### Files

- `worker/src/index.ts` — the worker (routes below)
- `worker/wrangler.jsonc` — worker config; the KV namespace auto-provisions
  on first deploy and wrangler writes the generated ID back into this file

### Routes

| Route | Purpose |
| --- | --- |
| `GET /?key=<name>` | Increments the view counter, returns `{ "views": n }`; also bumps that day's bucket for the stats graph |
| `GET /stats?days=<n>` | Totals plus the daily view series that `/stats` renders (cached for five minutes) |
| `GET /votes?keys=a,b,c` | Reads totals without incrementing, returns `{ "votes": { a: { up, down }, … } }` |
| `POST /vote` | Body `{ key, from, to }` where each of `from`/`to` is `1`, `-1` or `0`; returns the key's new `{ key, up, down }` |
| `GET /sites` | Lists community-published sites, newest first |
| `POST /submit` | Body `{ title, description, tags, slug, files }`; publishes a site and returns it |
| `GET /s/<slug>/…` | Serves a published site (and its assets) from KV |

### Community sites

The last card in the directory is an upload form: a visitor sets a title,
description, tags, and web address, then picks their HTML/CSS/JS files (or a
whole folder). The homepage posts them to `POST /submit`, the worker stores
them in the same KV namespace, and the site is live at
`<worker>/s/<slug>/` — listed in the directory like any other entry and
votable under its slug.

- Metadata lives under `pub:<slug>`; each file body (base64) under
  `pubfile:<slug>:<path>`. Requests arriving at `/s/<slug>` are redirected to
  `/s/<slug>/` so relative asset links resolve correctly.
- Limits: 40 files, 2 MB per file, 8 MB per upload, `index.html` required
  (otherwise the first `.html` file becomes the entry point). Slugs are
  lowercase letters, numbers, and dashes, and must be unique.
- Cloudflare KV list is **eventually consistent**, so a freshly published site
  can take up to ~60s to appear in `GET /sites`. The homepage inserts the
  returned site into the list immediately so its author sees it right away.
- Every published site is also committed to the repository under
  `public/sites/<slug>/`, so an upload is backed by git and not only by KV. Set
  `GITHUB_TOKEN` as a Worker secret to switch it on; `GITHUB_REPO` and
  `GITHUB_BRANCH` override the defaults (`NOTAM-bobk/base31`, `main`). It is
  best-effort and runs in `waitUntil`, so a missing token, a wrong scope or a
  single failed file never becomes a failed upload. Nothing is written to
  `config/sites.json`, so a mirrored folder does not become a second directory
  entry and needs no tool guide.
- Uploads are open and unmoderated. User HTML runs on the worker's own origin
  (not `base31.org`), so it cannot reach the directory's cookies or storage,
  but it can call the worker's own API. If this ever needs locking down, set
  `COUNTER_SECRET` as a worker secret and/or move the publish endpoint behind
  auth.

### Stats

`/stats` on the site reads `GET /stats` on the worker, which reports the
directory's all-time views, a daily series for the visitor graph, vote totals,
published sites, subscriber counts, and the most liked entries. The daily
buckets are written under an `@day:<YYYY-MM-DD>` key: the `@` is outside the
characters `?key=` accepts, so a visitor can never aim the public counter at a
day bucket. They carry a 400-day lifetime, so the namespace stays bounded on
its own.

Two consequences worth knowing:

- History starts the day this shipped. The graph draws `0` for earlier days and
  says so on the page, and the all-time total is unaffected because it is a
  separate key (`base31-directory`).
- The feature is live only once the worker is redeployed (`npm run
  deploy:worker`). Until then `/stats` shows its "not available yet" state and
  nothing on the rest of the site changes.

Views are stored under the key itself (so existing counts keep working) and
votes under `votes:<key>:up` / `votes:<key>:down`. Votes are per browser:
the visitor's own choice lives in `localStorage` and the worker only keeps the
shared totals, so the same person cannot stack votes by reloading but also
cannot be counted twice across devices. The client sends both its previous and
its new choice, which keeps switching or clearing a vote from double-counting.

### Environment variables

| Key | Where | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Vercel / Keys tab | Token with **Workers Scripts: Edit** + **Workers KV Storage: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Vercel / Keys tab | Cloudflare account ID (dashboard sidebar) |
| `NEXT_PUBLIC_COUNTER_URL` | Vercel / Keys tab | Optional override for the deployed worker URL the homepage calls |
| `COUNTER_SECRET` | Worker secret (`wrangler secret put`) | Optional; when set, requests must send `x-counter-secret` |
| `RESEND_API_KEY` | Next.js hosting environment + Worker secret | Resend API credential used for bug reports, confirmations, and publication emails |
| `RESEND_FROM_EMAIL` | Next.js hosting environment + Worker secret | Sender address used by Resend; `base31 <onboarding@resend.dev>` until a domain is verified |
| `BUG_REPORT_TO` | Next.js hosting environment | Inbox that receives the bug and feature reports from the site form; defaults to `hello@base31.org`. Without a verified domain Resend only delivers to the account owner |
| `VAPID_PUBLIC_KEY` | Worker secret | Public VAPID key served to browsers for opt-in push notifications |
| `VAPID_PRIVATE_KEY` | Worker secret | Private VAPID key used to sign push notifications; never expose it to the browser |
| `VAPID_SUBJECT` | Worker secret | VAPID contact URI, for example a `mailto:` address |
| `GITHUB_TOKEN` | Worker secret | Optional; when set, each published community site is committed to `public/sites/<slug>/` on `GITHUB_BRANCH`. Needs **Contents: read and write** on `GITHUB_REPO` (fine-grained) or the `repo` scope |
| `GITHUB_REPO` | Worker secret | Optional; `owner/repo` to mirror uploads into, defaults to `NOTAM-bobk/base31` |
| `GITHUB_BRANCH` | Worker secret | Optional; branch the mirror commits to, defaults to `main` |

### Deploying

```bash
# authenticate non-interactively via env vars (or wrangler login)
export CLOUDFLARE_API_TOKEN=...   # token with Workers + KV edit permissions
export CLOUDFLARE_ACCOUNT_ID=...

npm run deploy:worker
```

Optional hardening:

```bash
cd worker && npx wrangler secret put COUNTER_SECRET
# requests must then send: x-counter-secret: <value>
```

The homepage reads the worker URL from `NEXT_PUBLIC_COUNTER_URL`, falling back
to the live `*.workers.dev` deployment when it is unset. Set the variable (and
redeploy) if you host the worker on a custom domain.

### Email and browser notifications

The directory already uses Resend for double-opt-in email updates and new-site
publication notices. The `/api/bug-report` Next.js route sends the optional
reply address, report text, and current page URL to `BUG_REPORT_TO`, which
defaults to `hello@base31.org`. Set
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `BUG_REPORT_TO` in the hosting
Settings → Environment before bug reports can be delivered. The sender must be
verified with Resend, and until an owned domain is verified the sender has to
be the shared test address `onboarding@resend.dev` — Resend rejects a
`gmail.com` (or any unowned domain) `from`, and the test sender only delivers
to the account owner's own address, so sending to anyone else fails with a
`403 validation_error`. The same limit applies to the Worker's double-opt-in
confirmation and publication emails: they cannot reach outside subscribers
until `RESEND_FROM_EMAIL` is an address on a verified domain (for example
`base31 <reports@base31.org>`), at which point `BUG_REPORT_TO` can be any
inbox (it ships pointed at `hello@base31.org`). `RESEND_FROM_EMAIL` accepts the `Display Name <address>` form. The
Worker also needs `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` set as Worker secrets for subscriptions and publication
notices. Configure push by generating a VAPID key pair and setting
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Worker secrets;
only the public key is returned to browsers. Push alerts are a separate,
visitor-controlled opt-in and do not depend on the cookie banner.

Do not commit credentials. Set Worker secrets with `wrangler secret put
<KEY>` from `worker/`; add the Next.js variables in the hosting environment
settings so they are available to the deployed app.

### Verify the sending domain in Resend

`base31.org` is not registered with Resend yet, so `RESEND_FROM_EMAIL` has to
stay on the shared `onboarding@resend.dev` test sender and mail only reaches
the account owner. Verify the domain once to send from `reports@base31.org`
(or any other local part) to any inbox:

1. Open [resend.com/domains](https://resend.com/domains), choose **Add
   Domain**, enter `base31.org`, and pick a region (the default is
   `us-east-1`). The stored `RESEND_API_KEY` is send-only — Resend answers
   `401 restricted_api_key` on `GET /domains` — so it cannot add or list
   domains. Use the dashboard, or swap in a full-access key for this step.
2. Resend lists the records for the domain. They are normally:
   - `MX` on `send` → `feedback-smtp.<region>.amazonses.com`, priority `10`
   - `TXT` on `send` → `v=spf1 include:amazonses.com ~all`
   - `TXT` (sometimes `CNAME`) on `resend._domainkey` → the DKIM value the
     dashboard shows
   - optionally `TXT` on `_dmarc` → `v=DMARC1; p=none;`

   Copy what Resend actually shows: the region changes the MX host.
3. Add the records at whichever host actually answers for the domain — see
   **Do not move the nameservers away from Vercel** above. While the
   nameservers are Vercel's that is Vercel → Domains → `base31.org` → DNS
   Records; while they are Cloudflare's it is the Cloudflare DNS dashboard. A
   record added to a zone that does not answer for the domain never resolves.
4. Once the records propagate, run `npm run check:mail` to confirm SPF, DKIM,
   and MX resolve, then press **Verify DNS Records** in Resend.
5. After verification, set `RESEND_FROM_EMAIL` to `base31 <reports@base31.org>`
   and point `BUG_REPORT_TO` at the inbox that should receive reports
   (`hello@base31.org` by default), both in the hosting environment and as
   Worker secrets.

`npm run check:mail` takes an optional domain argument and prints the
nameservers plus a pass/fail line per record, exiting non-zero while something
required is still missing.

> The vote routes only exist once the worker has been redeployed. Until then
the thumbs fall back to local-only voting — the counts show `–` and the click
still registers in `localStorage` without erroring.


<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ylsxc7fokm");
</script>
