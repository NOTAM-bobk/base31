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
- Vote on featured and external picks, publish a community static site, or opt into email/push updates.
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

The directory and public GitHub statistics do **not** need a GitHub API key. Email delivery, optional upload mirroring, and push notifications require their own credentials.

### Next.js hosting environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_COUNTER_URL` | Optional Worker override | Public base URL; defaults to the existing live Worker. Build-time variable—redeploy after changing it. Never put a secret in a `NEXT_PUBLIC_` variable. |
| `RESEND_API_KEY` | Bug/feature report email | Server-only Resend credential |
| `RESEND_FROM_EMAIL` | Bug/feature report email | Verified sender, e.g. `base31 <reports@example.com>` |
| `BUG_REPORT_TO` | Optional report destination | Defaults to `hello@base31.org` |

### Cloudflare Worker secrets and bindings

| Name | Purpose |
| --- | --- |
| `VIEW_COUNTER` | Existing KV namespace binding in `worker/wrangler.jsonc`; **preserve its ID** to retain counters, votes, uploads, and subscriptions |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Publication-update emails; signup saves immediately without sending a confirmation email. Configure delivery separately from Next.js |
| `SUBSCRIBER_ADMIN_SECRET` | Required to unlock `/admin`; a long random Worker secret, never public frontend configuration |
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
| `GET /votes?keys=a,b,c` | Read shared up/down totals |
| `POST /vote` | `{ key, from, to }`, where choices are `-1`, `0`, or `1` |
| `GET /sites` | List community-published sites |
| `POST /submit` | Publish static files with title, description, tags, and slug |
| `GET /s/<slug>/…` | Serve a community site's files from KV |
| `GET /discussion?before=<id>` | Newest 20 threads and up to 100 replies each; `nextCursor` for older pages |
| `POST /discussion` | `{ name, body, replyTo? }`; returns the stored message |
| `POST /discussion/moderate` | `{ id }` plus `x-discussion-secret`; replace a message with a removal notice |

`POST /subscribe` saves an active email immediately; success is returned only after storage succeeds, with no confirmation email or Resend requirement. Existing confirmation links still work for older pending records. `GET /admin/subscribers` requires `Authorization: Bearer <SUBSCRIBER_ADMIN_SECRET>` and returns up to 100 emails with active status, signup time (when recorded), and a pagination cursor—never unsubscribe tokens. The `/admin` page holds the entered secret in memory only. Configure this separate secret in the Worker before using the panel; access fails closed if it is unset. KV lists are eventually consistent, so new emails may take about a minute to appear. Older pending signups are not automatically activated.

URL suggestions below the last directory collection use the existing `/api/bug-report` operator inbox with a distinct subject. They are reviewed, not automatically published. The Next.js Resend configuration is required for that form. See `worker/src/index.ts` for legacy confirmation, unsubscribe, and push routes. Single-step signup records form consent but does not verify email ownership; operators should monitor for abusive or unwanted subscriptions.

Community uploads are served on the Worker origin, separate from the directory. Limits are 40 files, 2 MB per file, and 8 MB per upload. KV listings are eventually consistent, so new entries may take about a minute to appear elsewhere. Optional GitHub mirroring is best-effort; it does not automatically add an entry to curated `sites.json`.

**Operational limitations:** votes rely on browser-local choices and client-supplied transitions, not verified identities; they are not abuse-proof or synchronized across devices. KV totals are not transactional. Community uploads are public and unmoderated. Unique visitor estimates use hashed IP/browser signals, so shared networks can undercount and changes in browser signals can overcount; hashing is not a promise that data is impossible to re-identify. Review these tradeoffs before operating at larger scale.

### Community discussion

The board is directly below About and shares one `DiscussionRoom` Durable Object in the **existing Worker**. SQLite storage keeps writes and rate-limit checks atomic, without changing the counter KV namespace or requiring a manually created D1 database. `worker/wrangler.jsonc` declares the `DISCUSSION` binding and its `discussion-v1` SQLite migration. Preserve that migration and the object name to retain messages.

**Activation:** deploy the Worker separately with `npm run deploy:worker` from a trusted environment authenticated to Cloudflare. Deployment credentials are `CLOUDFLARE_API_TOKEN` (Workers/Durable Objects deployment permissions) and `CLOUDFLARE_ACCOUNT_ID`, not browser keys. The binding is provisioned by the migration. Pushing to Vercel alone does not activate chat routes; before deployment the UI shows an honest unavailable state. No additional public URL is needed unless overriding `NEXT_PUBLIC_COUNTER_URL`.

Posting uses a display name (1–32 characters), plain-text body (1–2,000 characters), and optional numeric parent message ID. Replies to replies stay in their original thread with an explicit parent label. A thread holds at most 100 replies; start another once full. Request bodies are bounded at 12 KB. HTML is rendered as text, not markup or clickable links. Network-based limits allow one message every 15 seconds and 50 per UTC day. The Worker replaces client-supplied visitor signals with a daily hash of Cloudflare's connecting IP; raw IPs are not stored in discussion tables. Old rate-limit records are cleaned on subsequent posts.

The board polls every 15 seconds only while the tab is visible; it is not WebSocket realtime. Drafts survive failed submissions but not page reloads. Only the display name is saved locally. Messages/names are public and names are **not verified identities**. Rate limits are basic protection, not a substitute for active moderation, CAPTCHA or authentication at higher traffic.

To moderate, configure `DISCUSSION_MODERATOR_SECRET` as a Worker secret and send an authenticated `POST /discussion/moderate` with `{ "id": 123 }` and the matching `x-discussion-secret` header from trusted tooling. Never expose this key in frontend configuration. Removal clears the author's name/body and leaves a tombstone so replies stay understandable; removing a root closes its thread to further replies. Visitors can report messages to `hello@base31.org`. There is no automatic moderation or self-service delete identity. Review reports and usage regularly.

`npm run test:discussion` exercises the actual SQL against in-memory SQLite: messages, nested replies, concurrent rate limits, pagination, validation and moderation. It does not contact or write to the live Worker. Local tests and frontend CI do not prove the Worker has been deployed.

### GitHub statistics: free, approximate, resilient

- Header commits use GitHub's public REST commit endpoint and pagination headers, cached in the browser for one hour.
- Hero source size uses `GET https://api.github.com/repos/NOTAM-bobk/base31/languages`, cached for **24 hours**.
- GitHub returns **bytes per language, not line counts**. `lib/code-estimate.ts` divides bytes by assumed bytes/line: TypeScript and JavaScript 45, HTML 60, CSS 35; additional languages have documented factors and otherwise use 45.
- The result is labelled `≈` and **estimated lines of code**. It covers files GitHub Linguist counts, not every repository file, dependency, binary, or generated asset.
- Public unauthenticated requests have rate limits (normally 60/hour/IP). Failed refreshes retain a cached estimate; without a successful fetch the UI shows a dash, never a made-up fixed number.

## Deployment and domains

The existing setup deploys Next.js to **Vercel** on repository pushes. CI runs `npm ci`, content validation, external-link checks, directory regression tests, TypeScript, and a production build. The Worker is a **separate deployment**:

```bash
npm run deploy:worker
```

Only run deployment commands when intentionally changing the live service. A frontend deployment does not deploy Worker code or copy hosting secrets into Worker secrets.

For wildcard tool routing, configure the apex and `*.base31.org` in Vercel. Vercel's wildcard certificate setup normally requires Vercel nameservers. If the DNS zone is hosted elsewhere, check current provider requirements and configure explicit subdomains/certificates as needed rather than assuming the wildcard works.

**Before changing nameservers:** export/recreate web, mail, verification, and DKIM records at the new authoritative host. A successful application build does not prove DNS or TLS works. Run `npm run check:domain` after DNS changes and check the hosting dashboard's domain status. Do not change the KV namespace ID during redeployment.

## Maintenance checklist

### Every content or UI change

1. Edit valid JSON—no trailing commas, escaped quotes inside strings, no objects after the closing `]`.
2. Check date accuracy, URL/tag consistency, guide coverage, editor's pick references, and resulting detail slugs.
3. Run `npm run check`. Run `node scripts/check-cool-sites.mjs` for outbound links; failures are soft warnings because some providers block automated requests.
4. Inspect desktop/mobile, dark/light, keyboard focus, reduced motion, empty searches, category filters, and unknown detail URLs.
5. For a release, bump `package.json` and prepend the matching version to `config/changelog.json` together.
6. Review the diff, commit only relevant files, and confirm CI after pushing.

### Periodically

- Review aging picks; update `lastChecked` only after actually checking the destination.
- Rotate the editorial shortlist and remove broken/retired services.
- Read Dependabot PR checks before merging; major Next.js upgrades need deliberate testing.
- Review community uploads, rate limits, Worker KV usage, email/push failures, and abuse reports.
- Audit analytics/ads and privacy copy together; keep consent behavior consistent with what the site discloses.

### Styling and accessibility conventions

Use the existing CSS tokens for both themes. Styles load `globals.css` → `overrides.css` → `inner-pages.css` → `late.css` → `directory.css`; the last file owns the editorial shortlist and refreshed directory cards. No Tailwind or additional React installation is needed.

Featured cards place color-coded tags along the bottom of the preview image. `tagTone` in `lib/directory.ts` maps semantic tag families to mint, sky, amber, or coral, with a stable fallback for custom tags. Text labels remain visible, so meaning never depends on color alone. Ratings sit above the Details link in the card footer. The homepage uses coordinated sky, amber and coral accents alongside emerald, with theme-specific contrast values.

Keep pin, vote, and detail controls **outside** outbound card links. New controls need accessible names, visible keyboard focus, and touch-friendly targets. Carousel rotation and decorative motion respect reduced motion. The page scrollbar is visually hidden where supported, but wheel/touch/keyboard scrolling remains enabled; forced-colors users retain native scrollbar chrome.

Homepage reveal state uses `data-revealed`, not a React-managed class, and the observer tracks shown card IDs rather than just list length. Don't use the homepage's reveal gate on standalone routes without an observer, or their content can remain invisible.

## SEO, privacy, and third-party requests

Curated detail pages and tool guides ship canonical/social metadata and JSON-LD. `app/sitemap.ts` includes curated details and guides; community uploads aren't build-time sitemap entries. Static tools need their own title, description, canonical, social tags, `robots.txt`, and `sitemap.xml`—copy a maintained tool's structure and adapt the content. Never invent ratings, prices, or review dates.

The root layout includes Google Analytics and Umami on every visit. Clarity and homepage ad scripts are consent-gated; some static tools have separate consent implementations or ungated scripts. Screenshot previews request third-party services (WordPress mShots/thum.io), and community favicon requests reach their own origins. Don't describe third-party requests as entirely local or automatically anonymous. See `app/privacy`, `lib/consent.ts`, and the consent-aware components before changing tracking behavior.

Sponsored referrals must remain visibly disclosed and use sponsored link attributes. Editor's picks must remain distinct from those paid slots.

## Troubleshooting

| Symptom | Start here |
| --- | --- |
| Invalid JSON breaks a deploy | `npm run validate:content`; inspect the changed config array |
| Unknown editor's pick disappears | `npm run test:directory`; verify the current `/sites/<slug>` |
| Code estimate or commit count is a dash | GitHub reachability/rate limits; no API key is required |
| Votes or uploads fail | Check the configured Worker URL and deployed routes; don't test writes against production unintentionally |
| Report email returns unavailable | Next.js email variables; verified sender and recipient restrictions |
| Subscriber emails fail | Worker's own email secrets and provider logs |
| Directory works but a tool 404s | Matching static folder/subdomain, middleware, hosting domain and DNS |
| Counters unexpectedly reset | Verify `VIEW_COUNTER` still points at the original KV namespace |
| Build passes but the site is unreachable | Hosting domain validation, authoritative DNS, and TLS—not another build |

For contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md). For shipped release notes, see [the changelog](https://base31.org/whats-new).
