# base31.org

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
│   └── referrals.json     ← sponsored referral carousel
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
`referrals.json` and `donations.json` in one go, and do it before pushing.

All four files under `config/` are imported straight into the build, so a file
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
  deploy with nothing to update by hand. Sites with `"show": false` are left
  out, and community uploads are not listed (they are only known at runtime).
- `components/faq.tsx` renders the FAQ above the footer together with its
  matching `FAQPage` structured data. Edit the `FAQS` array there and both the
  copy and the schema stay in sync.
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
- A directory card is one link (`.site-card-body` — the preview band, icon,
  name, host, description and tags) plus a `.site-card-foot` bar holding the
  pin and the two votes. Keeping the buttons outside the link is what lets the
  whole information block be clickable without nesting interactive elements.
  Pinned cards get a green spine; `SiteIcon` is 38px (34px on phones).
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
  nudge, `scroll-behavior: smooth` and carousel auto-rotation are all skipped
  under `prefers-reduced-motion`, and the reveal gate (`html[data-motion="enabled"]`) is never
  applied without JavaScript.
- The blog ships an RSS feed at `/blog/feed.xml` and a JSON Feed 1.1 twin at
  `/blog/feed.json`, both generated from `lib/blogs.ts` and advertised with
  `<link rel="alternate">`. Posts also show a reading time and a "read next"
  list of the other posts.

## Cookies, ads and analytics

No analytics, ad script or ad cookie loads until the visitor answers the
banner, and the answer is the single switch for all of it. The only things that
load either way are the destination preview images on every directory card and
in the referral carousel and each community upload's own favicon — both decorative, both cookie-free:

| Component | Runs when |
| --- | --- |
| `components/consent-aware-analytics.tsx` | Microsoft Clarity (`ylsxc7fokm`) and Google Analytics 4 (`G-Y5N2FYK786`), only on `accepted` |
| `components/consent-aware-ads.tsx` | Adcash auto-tag (`iy7zk7mmw`), only on `accepted` |
| `components/referral-carousel.tsx` | Never gated: the destination preview image loads straight from the destination (or a screenshot service) because the card is unusable without it. It sets no cookies, the sponsored links stay inert until clicked, and the privacy page says so. |

The Adcash script loader (`https://acscdn.com/script/aclib.js`) is inserted only
after the visitor accepts, then runs the supplied auto-tag for zone
`iy7zk7mmw`. Denying or withdrawing consent prevents the loader from being
inserted (and removes its script element if consent changes after it loads).

Clarity and Google Analytics work the same way and are declared in one
component: each snippet appends its own loader tag with an id
(`microsoft-clarity-loader`, `google-analytics-loader`) so withdrawing the
choice removes what the page can remove. A library that already fetched stays
loaded until the next page load, which is what the privacy page says — so
never claim a withdrawal unloads a script that has already run.

`lib/consent.ts` holds the `base31-consent` key, a `useConsent()` hook and the
`base31-consent-change` event that keeps them in sync. `PrivacyConsent`
(`components/privacy-consent.tsx`) re-appears whenever the choice is cleared,
which is what the footer's **Cookie settings** button does — so a visitor can
withdraw or change consent later without clearing site data by hand.

> The `subdomain` value and the folder name under `public/sites/` must
> match exactly.

## One-time Vercel/domain setup

Wildcard subdomains on Vercel require your domain to use **Vercel's
nameservers** (this is required on every plan, including the free Hobby
plan — it's how Vercel issues a certificate for each subdomain on the fly).

1. Push this repo to GitHub and import it as a new Vercel project.
2. In the project's **Settings → Domains**, add `base31.org`.
3. Since you bought the domain through Vercel, its nameservers are already
   Vercel's — nothing to change there.
4. Still in **Settings → Domains**, add a second domain: `*.base31.org`
   (the wildcard). Vercel will confirm it can issue certificates for it.
5. Push a commit — that's it. Any folder you add under `public/sites/` with
   a matching `config/sites.json` entry is live on its subdomain right
   away, no per-site deploy needed.

## Local development

```bash
npm install
npm run dev
```

Subdomains don't resolve on `localhost` by default. To test one locally,
visit `http://example.localhost:3000` (the middleware treats `*.localhost`
the same way it treats `*.base31.org`).## Counters and votes (Cloudflare Workers)

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
| `GET /?key=<name>` | Increments the view counter, returns `{ "views": n }` |
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
- Uploads are open and unmoderated. User HTML runs on the worker's own origin
  (not `base31.org`), so it cannot reach the directory's cookies or storage,
  but it can call the worker's own API. If this ever needs locking down, set
  `COUNTER_SECRET` as a worker secret and/or move the publish endpoint behind
  auth.

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
| `RESEND_FROM_EMAIL` | Next.js hosting environment + Worker secret | Verified sender address used by Resend for reports and directory emails |
| `BUG_REPORT_TO` | Next.js hosting environment | Inbox that receives the bug-report form submissions |
| `VAPID_PUBLIC_KEY` | Worker secret | Public VAPID key served to browsers for opt-in push notifications |
| `VAPID_PRIVATE_KEY` | Worker secret | Private VAPID key used to sign push notifications; never expose it to the browser |
| `VAPID_SUBJECT` | Worker secret | VAPID contact URI, for example a `mailto:` address |

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
reply address, report text, and current page URL to `BUG_REPORT_TO`. Set
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `BUG_REPORT_TO` in the hosting
Settings → Environment before bug reports can be delivered. The sender must be
verified with Resend. The Worker also needs `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` set as Worker secrets for subscriptions and publication
notices. Configure push by generating a VAPID key pair and setting
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Worker secrets;
only the public key is returned to browsers. Push alerts are a separate,
visitor-controlled opt-in and do not depend on the cookie banner.

Do not commit credentials. Set Worker secrets with `wrangler secret put
<KEY>` from `worker/`; add the Next.js variables in the hosting environment
settings so they are available to the deployed app.

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
