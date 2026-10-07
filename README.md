<div align="center">

# base31.org
### A small directory for a very big web.

Useful browser tools, playful websites, public APIs, creative apps, and AI picks—curated together, searchable in one place.

[Visit the directory](https://base31.org) · [Explore the tools](https://base31.org/tools) · [What's new](https://base31.org/whats-new) · [Report an issue](https://github.com/NOTAM-bobk/base31/issues)

![CI](https://github.com/NOTAM-bobk/base31/actions/workflows/ci.yml/badge.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-111111?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)

</div>

---

## What is this app?

**base31 is both a discovery directory and a collection of independent web tools.** The Next.js app serves the directory, editorial pages, and SEO guides. Plain HTML/CSS/JavaScript tools live in this same repository and are served on their own `*.base31.org` subdomains. A separate Cloudflare Worker handles shared counters, votes, community publishing, and notification subscriptions.

### What visitors can do

- Search **Featured sites, Other cool sites, Cool APIs, Cool apps, and Cool AIs** by name, URL, description, category, or tags.
- Use `#utility` or `tag:no-key` for an exact tag; combine words such as `#utility image` to narrow results. Normal browsing starts with nine cards per section; search shows every match.
- Discover a rotating **Editor's picks** shortlist, browse categories, pin featured sites, sort them, or open a random matching pick.
- Read detail pages at `/sites/<slug>` with related picks, recorded addition/review dates, voting, canonical metadata, and structured data. Deeper tool guides live at `/tools/<subdomain>`.
- Vote on featured and external picks, fire the ones worth a boost, publish a community static site, or opt into email/push updates.
- Join the public community discussion below About: start a conversation or reply to another visitor without creating an account.
- Browse in English, Spanish, French, or Portuguese, with dark/light themes and reduced-motion support.

The homepage hero shows views, distinct linked destinations, and **estimated** source lines. Unique visitor reporting remains on `/stats`.

## Quick start

Use Node.js 22.13+ and **npm** (discussion regression tests use built-in SQLite). Install from the lockfile:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. A static tool can be tested at `http://example.localhost:3000` when your browser resolves `*.localhost`; middleware maps its host to `public/sites/example/`.

```bash
npm run check             # content validation + directory/discussion tests + TypeScript
npm run build             # production build, also run by GitHub CI
npm start                 # serve a completed production build
```

In Freebuff, use the managed Preview controls instead of starting a second server. Installation is `npm ci`, build is `npm run build`; the managed dev command must bind to `0.0.0.0` and use its assigned port. Secrets belong in **Settings → Environment**, never in Git.

> The default counter URL points at the live Worker. Override `NEXT_PUBLIC_COUNTER_URL` with a development Worker before testing writes such as votes or publishing. Missing email or push credentials do not prevent directory browsing.

## Repository map

```text
app/                      Next.js routes, metadata, feeds, and styles
  sites/[slug]/           Curated listing detail pages
  tools/                  Tool index and search-oriented guides
  api/bug-report/         Server-side email report endpoint
components/               Homepage, shared strips, carousel, votes, and UI
config/                   Editable JSON content
lib/                      Search, directory indexing, guides, translations
public/
  site-icons/             Local featured-site favicons
  sites/<subdomain>/      Static tools: index.html + relative assets
scripts/                  Validation, regression tests, DNS/link checks
worker/
  src/index.ts            Cloudflare API and community-site serving
  wrangler.jsonc          Worker name and existing KV binding
middleware.ts             Host-based subdomain → static folder rewrite
.github/workflows/ci.yml   Validation, tests, typecheck, production build
```

## Edit the directory without touching UI code

| File | Controls |
| --- | --- |
| `config/sites.json` | Featured subdomain tools and profiles; `show: false` hides a listing, not its static site |
| `config/cool-sites.json` | External websites |
| `config/cool-apis.json` | External API resources |
| `config/cool-apps.json` | Browser apps |
| `config/cool-ais.json` | Web AI assistants, research tools, creative services |
| `config/editors-picks.json` | Ordered editorial carousel selections and notes |
| `config/blogs.json` | Config-driven blog posts; additional editorial posts are supplied by `lib/blogs.ts` |
| `config/referrals.json` | Sponsored referral carousel, separate from editorial picks |
| `config/donations.json` | Supporter board entries |
| `config/changelog.json` | Newest-first release history; top version must equal `package.json` |

### Add an external pick

Append an object **inside** the matching JSON array:

```json
{
  "name": "Example App",
  "url": "https://example.com/",
  "category": "Utilities",
  "tags": ["utility", "no-key"],
  "description": "One specific sentence explaining why someone should open this app.",
  "addedAt": "2026-10-01"
}
```

Use HTTPS, a useful description, and lowercase single-word or hyphenated tags. Match an existing category when appropriate. External collections must not contain base31 subdomains. Avoid duplicate URLs, including variants that differ only by a trailing slash.

`lib/directory.ts` creates stable detail slugs and namespaced URL vote keys. Changing a listing's name can change its external detail slug; changing its URL can change its vote identity. Check links and editor's picks when either changes. Legacy slash-only duplicates share a single detail route.

### Choose editor's picks

Edit `config/editors-picks.json`. Selections may come from **any curated collection**; use the slug from the listing's `/sites/<slug>` URL:

```json
[
  {
    "slug": "apis-open-meteo",
    "note": "Build something with real weather data—without hunting down an API key."
  },
  {
    "slug": "imagecompressor",
    "note": "Smaller images, no upload. A practical tool that respects your files."
  }
]
```

Array order is rotation order. Remove a selection to remove its slide; an empty array hides the carousel. Each note needs at least 20 characters. `npm run check` catches unknown or repeated slugs. These picks are **not sponsored**—paid placements belong in `referrals.json` instead.

The carousel advances every seven seconds with quiet, non-interactive progress marks. It pauses on hover and stops automatic rotation after focus, touch, or manual browsing. There are no visible pause or slide-switch buttons; use arrow keys while focused or swipe on mobile to browse. Reduced-motion visitors navigate manually. On phones the card stacks its copy and full-width link without the large decorative number.

The donation page lives in `public/sites/donation/index.html`. Its support links and DonateAction schema point to `https://fundrazr.com/62nDBa`; payment options and campaign terms are handled there. Keep that destination in sync when changing campaigns. The page uses local CSS, native FAQ disclosures, and system light/dark preferences, without payment forms or third-party script dependencies.

### Add a featured static tool

1. Create `public/sites/<subdomain>/index.html` and relative CSS/JS/assets.
2. Add `public/site-icons/<subdomain>.svg` (or set a local `icon` path).
3. Add the featured entry to `config/sites.json`:

```json
{
  "name": "Example",
  "subdomain": "example",
  "url": "https://example.base31.org",
  "tags": ["utility"],
  "description": "A clear explanation of the tool and what it helps visitors do.",
  "show": true,
  "language": "en",
  "addedAt": "2026-10-01"
}
```

4. Add a matching guide to `lib/tool-pages.ts` before making it visible. Validation checks guide coverage and copy requirements.
5. Run `npm run check`, review the subdomain and detail page, then ship through your normal repository workflow.

Keep folder and `subdomain` names identical. Use relative assets inside static tools. Link legal pages with absolute apex URLs (`https://base31.org/privacy`), since `/privacy` on a tool subdomain would resolve inside that tool's folder.

### Derived indexes

Three routes are generated from the config files rather than hand-maintained:

| Route | Built from |
| --- | --- |
| `/recently-added` (and `tags.base31.org` siblings) | Every entry's `addedAt` or a community upload's `createdAt` |
| `/tags` and `/tags/<tag>` | Every tag on every entry, aggregated in `lib/tags.ts` |
| `/quality-report` | `lastChecked` dates plus the Worker's `/quality` health checks |

Add an `addedAt` date and the entry appears on `/recently-added`; add a tag and it gets a `/tags/<slug>` page. Nothing needs to be registered anywhere else. An entry with neither `addedAt` nor `createdAt` is deliberately absent from `/recently-added` rather than guessed at.

`middleware.ts` maps `tags.base31.org` to the `/tags` routes instead of a static folder; the bare host is the tag index and `tags.base31.org/<tag>` is that tag's page. `tags` is therefore reserved and must not be used as a tool subdomain.

### Pages and navigation

The site has two faces, and both render the same component (`components/home-page.tsx`) with a `mode` prop:

| Route | Mode | What it is |
| --- | --- | --- |
| `/` (and `/es`, `/fr`, `/pt`) | `home` | The landing page: the hero and its Explore control, the section keys, the editor's picks, the Top 10, the website of the week, the submission form, the tag shelf and the site web, then About the directory, the support hub, the community board, the FAQ, the launch clock and the signup. |
| `/explore` | `explore` | The directory: the search field, the tag filters and sort, the featured sites, the five off-directory strips and the URL request form. |
| `/explore/<section>` | — | One section on a page of its own: every card in it, its own search field and filter chips, and the same vote ranking. See “Sections have pages too”. |

They share one implementation on purpose. The directory's query, filters, sort, pins, votes, upload form and polling effects are one state machine, and the phone's drawer searches straight into `/explore`, so two components would mean two of everything. Moving a list from one half to the other means moving markup between the `{isExplore && <>…</>}` and `{!isExplore && <>…</>}` blocks in that file; nothing else has to change, and the section order the regression tests pin stays in one readable place.

The landing page's browsing half is a way **in**, not a second copy of the directory. Its section keys are ordinary links to `/explore#<section-id>`, so a bare `#sites` would scroll nowhere from the homepage; its editor's-picks carousel is the same `components/editors-picks.tsx` component; and "Browse by tag" links the 18 most-used tags straight to their `/tags/<slug>` pages. The editor's picks belong to the landing page alone — `/explore` is there to be searched, and a carousel above the search field put an editorial slide between the visitor and the list.

The prose half of the landing page runs About the directory, then the support hub directly under it, then the community board, the FAQ and the launch clock. About and Support are one pair — who this is, and how it stays free — so nothing sits between them; the countdown closes the prose rather than interrupting the questions. The Top 10 (`components/top-ten.tsx`) ranks the directory's live up/down totals with the same `compareVotes` rule the strips and `/stats` use — **community votes, not page views**. There is no per-day vote history to rank by, so the heading follows the streaming-service convention it is imitating while the caption under it says plainly what the numbers are, an entry nobody has voted on prints `no votes yet` rather than a score, and a board at zero is labelled as such instead of being padded with an invented order. Ranking a real "today" would mean the Worker recording votes by day; the fires below are the one thing here that does carry a clock of its own.

The board also carries the fire. Every card and every detail page has a fire button (`FireButton` in `components/site-votes.tsx`) beside its thumbs, and a fire is worth ten votes for the twenty-four hours it is live: `totalVotes` in `lib/vote-ranking.ts` adds `FIRE_VOTE_WEIGHT` for each active fire, so one fire lifts a pick through the same `compareVotes` rule the board, the `/explore` sort and the `/stats` top list all share. A visitor may fire a given pick once a day — the button is disabled for the rest of that window, and the visitor's own stamps are kept in `base31-fires` in their browser (`lib/fires.ts`). A fire stops counting by itself a day after it was cast, because the Worker stores the timestamps and drops the expired ones as it reads them; nothing has to be swept up and no vote total is ever rewritten. On the Top 10 the fire is only a marker: a row that has been fired today prints the emoji next to its name and carries no control of its own.

The landing page's editorial spotlight is the website of the week (`components/website-of-the-week.tsx`), between the Top 10 and the submission form. It prints the newest entry from `config/websites-of-the-week.json` via `lib/websites-of-the-week.ts` — tagline and story included — and links to the archive on `/websites-of-the-week`. Both surfaces read the same newest-first list, so the two can never lead with a different week, and the section renders nothing at all rather than an empty frame if the list is somehow empty. Adding one is prepending an entry to that config; the date, a tagline and a story long enough for `npm run validate:content` are the whole registration.

The foot of the landing page's browsing half is the site web (`components/site-web.tsx`): every collection as a hub with all of its picks hanging off it, drawn as one branching picture under the tag shelf, with a hairline rule between the two. The map is the page's own floor rather than another panel: nothing draws a border, a surface or a shadow around it, and the only thing behind the canvas is a soft glow that fades into the band. Hovering, tapping or tabbing a node lights its whole branch and dims the rest, and every node is a real link — a hub opens `/explore/<id>`, a pick opens `/sites/<slug>` — so the picture is a usable index of the directory before any JavaScript has run. It is built from `lib/sections.ts` and `lib/directory.ts`, the same registry and derived entry list every other surface reads, so adding an entry to a config file puts it in the web on the next publish with no edit in the component. The geometry is worked out once at module scope from a hash of each slug rather than from `Math.random()` or the clock, which is what lets the server and the browser draw the same picture; the styling and the idle animation live in `app/late.css` under their own heading, and the animation only runs while `<html>` carries `data-motion="enabled"`, so reduced-motion visitors get a still map. The map's own controls are part of the picture: the node under the pointer is named on the canvas where the pointer already is, `Wander the web` lights one pick drawn from the platform's entropy source — the one random number in the component, taken at the press rather than at module scope, so the layout stays a pure function of the slugs — and the line under the canvas offers the visit it has just named. The bar beside the button counts the picks this visitor has met, kept in `base31-web-met` in their own browser with a reset beside it, because a keepsake nobody can clear is a nag.

The URL request form (`components/url-request.tsx`) is on **both** faces: between the Top 10 and the tag shelf on the landing page, and at the bottom of `/explore` after the five strips. Both copies post to the same Worker route, and the hero's own “Submit a URL” button anchors to the copy the visitor is already looking at rather than sending them to the other page.

On a phone the header carries a nav button (`components/site-header.tsx`, hidden above 819px) that opens `components/nav-drawer.tsx`: a panel that slides in from the right over a scrim. It holds the search field and two lists — "Explore:", one link per section written as `/explore#<section-id>`, and a shorter "More on base31". Those are ordinary anchors, so the browser loads the page and scrolls to the section itself, and three things dismiss the panel: a tap on the scrim beside it (which only reaches the scrim because the full-screen overlay wrapped around the panel takes no pointer events of its own — see the drawer block in `app/directory.css`), Escape, and the panel's own close button. **Section ids are therefore an interface**: the drawer, the section rail and every shared `/explore#…` link break if one is renamed. `npm run test:directory` checks that each hash the drawer offers is an id a section actually owns — and, since the same ids are the slugs of the section pages, that the registry below describes every one of them.

The search is a plain `GET` form to `/explore` — the query travels in the URL, so it works before hydration and produces a shareable link — and once React is running it answers in the panel as well. The homepage hands the drawer a slim index of every pick (`drawerSearchIndex` in `components/home-page.tsx`), and the panel lists the strongest six matches by the same `searchScore` the directory's "Best matches" block uses, each row opening that pick's `/sites/<slug>` page, with a final row that hands the query to `/explore?q=…`. Neither list is a wall of links either: each group carries its own text control (`Close` / `Open`) that folds it away.

### Sections have pages too

Every collection on `/explore` is described once, in `lib/sections.ts`: its id (which is both the anchor on `/explore` and the slug of its page), its heading, the line that describes it, the unit its count reads in, the field its filter chips narrow, and the whole list of cards. `app/explore/[section]/page.tsx` builds one page per entry and `app/sitemap.ts` one URL per entry, so a collection gets its page, its canonical metadata and its sitemap line from the same registration. The two key rows and the phone drawer still carry their own rows — each also needs its own count text and its own href shape — and `npm run test:directory` is what keeps the two honest: every hash the drawer offers must be an id a section owns, and every one of those ids must be an entry in the registry. Each section page carries the whole collection with its own search field, its own chips and the shared vote ranking, and `/explore` offers the way there from the foot of every strip's lede.

A search answers with the best matches first: `components/best-matches.tsx` ranks every collection by `searchScore` in `lib/search.ts` (a name beats a tag, a tag beats the description) and prints the strongest six above the lists. Below it, **only the sections that hold a match are rendered at all** — heading, divider and closed note included — so a question is answered by a short page instead of six headings and five "nothing here" lines. Which sections those are is `sectionsWithMatches` in `lib/sections.ts`, a rule the tests run rather than read.

### Record dates honestly

`addedAt` and `lastChecked` are optional `YYYY-MM-DD` dates. Set an addition date when the entry is actually added, and only update review dates after an editorial check—not because an automated crawler received a response.

| Badge | Meaning |
| --- | --- |
| Recently added | Recorded addition within 30 days |
| Fresh | Recorded review within 30 days |
| Previously reviewed | Recorded review between 30 and 90 days old |
| Review due | Review more than 90 days old |
| Not yet reviewed | No recorded review date |

Dates are rendered as semantic timestamps. Review badges are **not uptime guarantees**. Unknown history should remain unknown.

## Keys and environment configuration

The directory and public GitHub statistics do **not** need a GitHub API key. Publication-update email, optional upload mirroring, and push notifications require their own credentials, and all three live in the Worker.

### Next.js hosting environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_COUNTER_URL` | Optional Worker override | Public base URL; defaults to the existing live Worker. Build-time variable—redeploy after changing it. Never put a secret in a `NEXT_PUBLIC_` variable. |
| `ADMIN_PANEL_PASSWORD` | `/admin/community-sites` | The password the moderation page asks for; it must match the Worker's `COUNTER_SECRET` |

A bug or feature report needs **no** credential on this side: the route queues it with the Worker, so the Resend variables that used to deliver it are no longer part of the Next.js environment. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` remain Worker secrets, where they send publication updates.

### Cloudflare Worker secrets and bindings

| Name | Purpose |
| --- | --- |
| `VIEW_COUNTER` | Existing KV namespace binding in `worker/wrangler.jsonc`; **preserve its ID** to retain counters, votes, uploads, and subscriptions |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Publication-update emails; signup saves immediately without sending a confirmation email. Configure delivery separately from Next.js |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Opt-in browser push; only the public key is returned to browsers |
| `GITHUB_TOKEN` | Optional repository mirroring of community uploads; a runtime Worker credential with repository Contents read/write permission |
| `GITHUB_REPO`, `GITHUB_BRANCH` | Optional mirror destination; defaults are `NOTAM-bobk/base31` and `main` |
| `COUNTER_SECRET` | Optional Worker request gate requiring `x-counter-secret`; the public browser client does not send this header, so enabling it requires an architectural change such as a server-side proxy |

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are **deployment-tool credentials**, not browser configuration. Set them only in a trusted deployment environment. Add Worker secrets using Wrangler's secret commands from `worker/`. Do not commit any token, private VAPID key, or local environment file.

Freebuff's managed GitHub App credentials authenticate workspace Git/gh operations. They are **not** the optional Worker upload-mirroring token and are not expected in your environment files.

Resend's test sender has recipient restrictions. For real subscriber delivery, verify an owned sending domain, add the DNS records Resend supplies at the active DNS host, and configure a verified `RESEND_FROM_EMAIL` in **both** runtimes. `npm run check:mail` checks the mail DNS records; it does not prove message delivery.

## How the services fit together

### Cloudflare Worker API

| Endpoint | Purpose |
| --- | --- |
| `GET /?key=<name>` | Increment view counter; return views and unique estimate |
| `GET /stats?days=<n>` | Aggregates and daily series used by `/stats` |
| `GET /votes?keys=a,b,c` | Read shared up/down totals with each key's live fire count |
| `POST /vote` | `{ key, from, to }`, where choices are `-1`, `0`, or `1` |
| `POST /fire` | `{ key }`; record one fire and return that key's totals and fire count |
| `GET /sites` | List community-published sites |
| `GET /quality` | Public health-check report: last check time and failure count per community site, behind `/quality-report` |
| `POST /submit` | Publish static files with title, description, tags, and slug |
| `POST /report` | File a bug report or feature idea; saved to KV and listed in the admin inbox, never emailed |
| `GET /s/<slug>/…` | Serve a community site's files from KV |
| `GET /discussion?before=<id>` | Newest 20 threads and up to 100 replies each; `nextCursor` for older pages |
| `POST /discussion` | `{ name, body, replyTo? }`; returns the stored message |
| `POST /discussion/moderate` | `{ id }` plus `x-discussion-secret`; replace a message with a removal notice |

`POST /subscribe` saves an active email immediately; success is returned only after storage succeeds, with no confirmation email or Resend requirement. Existing confirmation links still work for older pending records. Subscriber emails are listed in the existing `/admin/community-sites` inbox through `/api/admin` and the protected Worker `/admin/data` endpoint. Existing `ADMIN_PANEL_PASSWORD` (Next.js) and `COUNTER_SECRET` (Worker) credentials must match; no new password is required. Unsubscribe tokens are never returned. KV lists are eventually consistent, so new emails may take about a minute to appear. Older pending signups are not automatically activated.

URL suggestions use the existing `/request-url` Worker endpoint and private moderation queue. The form is on the landing page and at the bottom of `/explore`; both post to the same route. They are reviewed, not automatically published. Bug reports and feature ideas filed from the community panel travel the same way through `POST /report`: the Next.js route checks the visitor's own throttle and forwards the report (with the visitor's address in `x-report-origin`, since the call is server-to-server) to the Worker, which stores it under `request:report:` and lists it in the same inbox. Nothing is emailed, so a mail-provider outage cannot lose a report. See `worker/src/index.ts` for legacy confirmation, unsubscribe, and push routes. Single-step signup records form consent but does not verify email ownership; operators should monitor for abusive or unwanted subscriptions.

Community uploads are served on the Worker origin, separate from the directory. Limits are 40 files, 2 MB per file, and 8 MB per upload. KV listings are eventually consistent, so new entries may take about a minute to appear elsewhere. Optional GitHub mirroring is best-effort; it does not automatically add an entry to curated `sites.json`.

**Operational limitations:** votes and fires rely on browser-local choices and client-supplied requests, not verified identities; they are not abuse-proof, not synchronized across devices, and a visitor who clears their browser storage can fire again. KV totals are not transactional, and a key's fires are a short list of timestamps read, pruned and written back on every fire — fine at this traffic, not a guarantee under heavy concurrency. Community uploads are public and unmoderated. Unique visitor estimates use hashed IP/browser signals, so shared networks can undercount and changes in browser signals can overcount; hashing is not a promise that data is impossible to re-identify. Review these tradeoffs before operating at larger scale.

### Community discussion

The board sits below About the directory and the support hub, and shares one `DiscussionRoom` Durable Object in the **existing Worker**. SQLite storage keeps writes and rate-limit checks atomic, without changing the counter KV namespace or requiring a manually created D1 database. `worker/wrangler.jsonc` declares the `DISCUSSION` binding and its `discussion-v1` SQLite migration. Preserve that migration and the object name to retain messages.

**Activation:** deploy the Worker separately with `npm run deploy:worker` from a trusted environment authenticated to Cloudflare. Deployment credentials are `CLOUDFLARE_API_TOKEN` (Workers/Durable Objects deployment permissions) and `CLOUDFLARE_ACCOUNT_ID`, not browser keys. The binding is provisioned by the migration. Pushing to Vercel alone does not activate chat routes; before deployment the UI shows an honest unavailable state. No additional public URL is needed unless overriding `NEXT_PUBLIC_COUNTER_URL`.

Posting uses a display name (1–32 characters), plain-text body (1–2,000 characters), and optional numeric parent message ID. Replies to replies stay in their original thread with an explicit parent label. A thread holds at most 100 replies; start another once full. Request bodies are bounded at 12 KB. HTML is rendered as text, not markup or clickable links. Network-based limits allow one message every 15 seconds and 50 per UTC day. The Worker replaces client-supplied visitor signals with a daily hash of Cloudflare's connecting IP; raw IPs are not stored in discussion tables. Old rate-limit records are cleaned on subsequent posts.

The board polls every minute only while the tab is visible; it is not WebSocket realtime. Drafts survive failed submissions but not page reloads. Only the display name is saved locally. Messages/names are public and names are **not verified identities**. Rate limits are basic protection, not a substitute for active moderation, CAPTCHA or authentication at higher traffic.

Each message shows a small avatar built by the DiceBear API from the display name (style `bottts`, seed = the name). It is deterministic, so the same name always draws the same picture, and nothing is stored or uploaded. The request is made by the visitor's browser to `api.dicebear.com` and carries the name in its URL — it is a third-party request, not a local one. The avatar is decorative and hidden from assistive technology; the message header is what names the author.

To moderate, configure `DISCUSSION_MODERATOR_SECRET` as a Worker secret and send an authenticated `POST /discussion/moderate` with `{ "id": 123 }` and the matching `x-discussion-secret` header from trusted tooling. Never expose this key in frontend configuration. Removal clears the author's name/body and leaves a tombstone so replies stay understandable; removing a root closes its thread to further replies. Visitors can report messages to `hello@base31.org`. There is no automatic moderation or self-service delete identity. Review reports and usage regularly.

`npm run test:discussion` exercises the actual SQL against in-memory SQLite: messages, nested replies, concurrent rate limits, pagination, validation and moderation. It does not contact or write to the live Worker. Local tests and frontend CI do not prove the Worker has been deployed.

### GitHub statistics: free, approximate, resilient

- Header commits use GitHub's public REST commit endpoint and pagination headers, cached in the browser for one hour.
- Public unauthenticated requests have rate limits (normally 60/hour/IP). Without a successful fetch the header shows a dash, never a made-up number.
- The hero used to print an **estimated source size** from `/repos/…/languages`. It does not any more: the figure and its fetch are gone rather than kept as a third number that could only ever be an estimate. The hero now prints two figures — views and the sites it links to.

## Deployment and domains

The `Auto release` workflow in `.github/workflows/auto-release.yml` runs after successful CI on a push to `main`. It publishes `v<package.json version>` at the checked commit, using the newest matching entry in `config/changelog.json` for its title and notes. It skips existing releases and builds overtaken by a newer push, rejects conflicting tags, and never publishes from pull-request CI. Bump the package and lockfile versions and add the matching changelog entry to prepare a new release. The workflow uses GitHub's built-in token with Contents write permission; no additional secret is needed. Repository policy must allow that permission. It creates a GitHub release, not a production deployment.

Site detail pages separate the preview and collection facts from voting and sharing, with section shortcuts above and related picks below. On a phone the columns become a single reading flow. The section rail supports taps and arrow keys as before; holding a line for 280 milliseconds starts a drag that scrubs through every section, including those outside the clipped rail. Releasing or cancelling the pointer ends the gesture.

The existing setup deploys Next.js to **Vercel** on repository pushes. CI runs `npm ci`, content validation, external-link checks, directory regression tests, TypeScript, and a production build. The Worker is a **separate deployment**:

```bash
npm run deploy:worker
```

Only run deployment commands when intentionally changing the live service. A frontend deployment does not deploy Worker code or copy hosting secrets into Worker secrets.

For wildcard tool routing, configure the apex and `*.base31.org` in Vercel. Vercel's wildcard certificate setup normally requires Vercel nameservers. If the DNS zone is hosted elsewhere, check current provider requirements and configure explicit subdomains/certificates as needed rather than assuming the wildcard works.

**Before changing nameservers:** export/recreate web, mail, verification, and DKIM records at the new authoritative host. A successful application build does not prove DNS or TLS works. Run `npm run check:domain` after DNS changes and check the hosting dashboard's domain status. Do not change the KV namespace ID during redeployment.

### Weekly AI blog post

`.github/workflows/weekly-blog.yml` runs every Monday at 13:00 UTC and can also be started by hand from the Actions tab. It runs `scripts/generate-weekly-blog.mjs`, which asks a model for one post about the open web, accepts it only when it satisfies the same rules `scripts/validate-content.mjs` enforces, prepends it to `config/blogs.json`, then lets the workflow commit and push the result. A post already dated that day is skipped, so reruns are safe and a week is never doubled up.

The model is **Cloudflare Workers AI** through its OpenAI-compatible endpoint. It is free on Cloudflare's free plan (10,000 Neurons a day), and this repository already holds Cloudflare credentials for the Worker deploy. GitHub's own Models API, which once made this possible with no key at all, was retired on 30 July 2026.

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Already set for the Worker deploy; reused here |
| `CLOUDFLARE_AI_TOKEN` | Cloudflare API token with **Account → Workers AI → Read**. Falls back to `CLOUDFLARE_API_TOKEN` when unset |

Set the repository **variable** `AI_BLOG_MODEL` to pick a different Workers AI text model; the default is `@cf/meta/llama-3.1-8b-instruct`. With no token the job prints a note and commits nothing, so it never fails just for being unconfigured. If `main` is protected and requires pull requests, retarget the job at a branch instead of pushing directly. Generated posts are unedited model output — read them as you would any other submission before treating them as published editorial.

## Maintenance checklist

### Every content or UI change

1. Edit valid JSON—no trailing commas, escaped quotes inside strings, no objects after the closing `]`.
2. Check date accuracy, URL/tag consistency, guide coverage, editor's pick references, and resulting detail slugs. No pick may appear in two collections: `npm run validate:content` compares the external lists by their address (a trailing slash does not make a second entry) and fails a URL that two of them both claim.
3. Run `npm run check`. Run `node scripts/check-cool-sites.mjs` for outbound links; failures are soft warnings because some providers block automated requests.
4. Inspect desktop/mobile, dark/light, keyboard focus, reduced motion, empty searches, category filters, and unknown detail URLs.
5. For a release, bump `package.json` and prepend the matching version to `config/changelog.json` together.
6. Review the diff, commit only relevant files, and confirm CI after pushing.

### Periodically

- Review aging picks; update `lastChecked` only after actually checking the destination.
- Rotate the editorial shortlist and remove broken/retired services.
- Read Dependabot PR checks before merging; major Next.js upgrades need deliberate testing.
- Review community uploads, rate limits, Worker KV usage, email/push failures, and abuse reports.
- Read the weekly AI-generated blog posts and edit or remove anything that does not sound like base31.
- Audit analytics/ads and privacy copy together; keep consent behavior consistent with what the site discloses.

### Styling and accessibility conventions

Use the existing CSS tokens for both themes. Styles load `globals.css` → `overrides.css` → `inner-pages.css` → `late.css` → `directory.css` → `about-links.css` → `subsite.css`. `directory.css` owns the editorial shortlist, the landing page's panels (editor's picks, Top 10, the website of the week), refreshed directory cards, the mobile drawer and the phone-only pass at its foot (touch targets, 16px form fields, `100dvh` page heights and the safe-area insets); `subsite.css` loads last and owns the pages outside the homepage — the path band at the top of every subsite (`base31.org / Tags / discovery`) with its grey gradient, the `--page-band` grey every subsite sits on, the Best matches block and the per-section explorer. No Tailwind or additional React installation is needed.

Every page outside the homepage wears the same grey the landing page's sections do: `subsite.css` sets `background: var(--page-band)` on `body:has(main:not(.home-main))`. It is set on `<body>` rather than on `main` because `main` is the centered reading column — painting that would leave the gutters on the old colour and draw a visible box down the window — and `:has()` names the one exception (the homepage, whose `.page-band` gradient has to start at `--background`) in a single place instead of on every subsite route.

The site web's rules sit at the foot of `late.css` under their own heading rather than in `directory.css`, because it is a drawn, animated map and not another variation on a card: the file ends with its palette, its hover, focus, label and wander states and the idle keyframes, all of which stay off under `prefers-reduced-motion`. Nothing in that block draws a panel, so the `.site-web` rule carries no border, no surface and no shadow — only a radial glow behind the canvas — and the `.section-divider + .site-web` rule beside it exists because the homepage's hairline above the map cannot own the air under it: `margin` is a shorthand, and the map's own rule would reset `margin-top` to zero.

Featured cards place color-coded tags along the bottom of the preview image. `tagTone` in `lib/directory.ts` maps semantic tag families to mint, sky, amber, or coral, with a stable fallback for custom tags. Text labels remain visible, so meaning never depends on color alone. Ratings sit above the Details link in the card footer. The homepage uses coordinated sky, amber and coral accents alongside emerald, with theme-specific contrast values.

Keep pin, vote, and detail controls **outside** outbound card links. New controls need accessible names, visible keyboard focus, and touch-friendly targets. Carousel rotation and decorative motion respect reduced motion. The page scrollbar is visually hidden where supported, but wheel/touch/keyboard scrolling remains enabled; forced-colors users retain native scrollbar chrome.

Homepage reveal state uses `data-revealed`, not a React-managed class, and the observer tracks shown card IDs rather than just list length. Don't use the homepage's reveal gate on standalone routes without an observer, or their content can remain invisible.

## SEO, privacy, and third-party requests

Curated detail pages and tool guides ship canonical/social metadata and JSON-LD. `app/sitemap.ts` includes curated details and guides; community uploads aren't build-time sitemap entries. Static tools need their own title, description, canonical, social tags, `robots.txt`, and `sitemap.xml`—copy a maintained tool's structure and adapt the content. Never invent ratings, prices, or review dates.

The FAQ also answers the questions people arrive with from somewhere else: the useless web, and where to find it. Those answers are printed on the page and repeated in the section's `FAQPage` structured data, a visually-hidden block under the questions says the same ground again in the words people actually search with, `public/llms.txt` carries a section on the useless web and the other gloriously pointless corners of the web, and the root metadata keywords name the phrase. All three say only what the visible answers already say, so no claim exists in the hidden copy alone.

The root layout includes Google Analytics and Umami on every visit. Clarity and homepage ad scripts are consent-gated; some static tools have separate consent implementations or ungated scripts. Screenshot previews request third-party services (WordPress mShots/thum.io), community favicon requests reach their own origins, and community discussion avatars are requested from the DiceBear API with the display name as their seed. Don't describe third-party requests as entirely local or automatically anonymous. See `app/privacy`, `lib/consent.ts`, and the consent-aware components before changing tracking behavior.

Sponsored referrals must remain visibly disclosed and use sponsored link attributes. Editor's picks must remain distinct from those paid slots.

## Troubleshooting

| Symptom | Start here |
| --- | --- |
| Invalid JSON breaks a deploy | `npm run validate:content`; inspect the changed config array |
| Unknown editor's pick disappears | `npm run test:directory`; verify the current `/sites/<slug>` |
| Commit count is a dash | GitHub reachability/rate limits; no API key is required |
| Votes or uploads fail | Check the configured Worker URL and deployed routes; don't test writes against production unintentionally |
| A filed report never reaches the inbox | The Worker's `/report` route is deployed and `/api/admin` can reach the Worker's `/admin/data`; no email provider is involved |
| Subscriber emails fail | Worker's own email secrets and provider logs |
| Directory works but a tool 404s | Matching static folder/subdomain, middleware, hosting domain and DNS |
| Counters unexpectedly reset | Verify `VIEW_COUNTER` still points at the original KV namespace |
| Build passes but the site is unreachable | Hosting domain validation, authoritative DNS, and TLS—not another build |

For contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md). For shipped release notes, see [the changelog](https://base31.org/whats-new).
