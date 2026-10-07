# Contributing to base31.org

Thanks for helping out. base31.org is one Next.js project that hosts both the
directory homepage (on `base31.org`) and every subdomain site (on
`*.base31.org`), so most contributions are either a new site under
`public/sites/` or a change to the homepage in `app/`.

## Getting started

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. Subdomains do not resolve on plain `localhost`, so
to preview one use `http://<subdomain>.localhost:3000` — the middleware treats
`*.localhost` exactly like `*.base31.org`.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run validate:content` | Check `config/*.json` and site folders |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run test:directory` | Test slugs, shared search, editor's picks, vote keys and code estimates |
| `npm run check` | Content validation, directory tests and TypeScript |

Run `npm run check` before opening a pull request.

## Adding a subdomain site

Each site is a plain, build-free static site: HTML/CSS/JS that is served as-is.

1. Create `public/sites/<subdomain>/` with at least an `index.html`. You can
   also add `style.css`, `app.js`, `favicon.svg`, `robots.txt` and
   `sitemap.xml`.
2. Add the matching icon at `public/site-icons/<subdomain>.svg`.
3. Add an entry to `config/sites.json`:

   ```json
   {
     "name": "Password Generator",
     "subdomain": "passwordgen",
     "url": "https://passwordgen.base31.org/",
     "tags": ["security", "password", "utility", "tool"],
     "description": "Generate strong passwords and store them in an encrypted, offline vault.",
     "show": true
   }
   ```

4. Add a matching guide in `lib/tool-pages.ts` for every visible featured entry.
5. Run `npm run check` and fix anything it reports.

Rules the validator enforces (see `scripts/validate-content.mjs`):

- `subdomain` must be a lowercase slug (`^[a-z0-9]+(-[a-z0-9]+)*$`) and must
  match the folder name under `public/sites/` **exactly**.
- `url` must be `https`, and there must be a favicon at
  `public/site-icons/<subdomain>.svg` unless the entry sets its own `icon`.
- `tags` needs at least one value and `description` at least 20 characters.
- Use a boolean `show` value and keep the static folder name aligned with the subdomain; these are authoring conventions, not all enforced by the validator.

### SEO checklist for a new site

- Keyword-first `<title>`, a meta description, and a canonical link to the
  site's own subdomain.
- `robots`, `color-scheme`, `theme-color` and `application-name` meta tags.
- Open Graph and Twitter card tags, using
  `https://base31.org/opengraph-image` as the social image (1200×630).
- One `application/ld+json` `@graph` per page with `WebSite` + `WebApplication`
  (and a `FAQPage` that mirrors any visible `<details>`), referencing the apex
  ids `https://base31.org/#organization` and `https://base31.org/#website`.
- Its own `robots.txt` and `sitemap.xml`.

The best references are `public/sites/passwordgen/` and
`public/sites/qrgenerator/`.

### Ads

Do not blindly copy tracking or advertising scripts into a new tool. Static
subdomains render outside the Next.js consent provider, and some have their
own cookie notice. Review the privacy requirements and consent behavior first;
keep sponsored links visibly disclosed. See README's privacy section.

### Design conventions

Keep the shared look: a clean monochrome base with an emerald accent
(`#10b981` / `#3ecf8e`), a subtle grid backdrop, `Inter` + `JetBrains Mono`,
light/dark support driven by `data-theme` with a pre-paint localStorage
restore, CSS custom properties, a `.sr-only` utility, a skip link and a
`:focus-visible` accent ring. Wrap motion in
`@media (prefers-reduced-motion: reduce)`.

## Changing the homepage

Homepage markup lives in `components/home-page.tsx`; `app/page.tsx` supplies
the route. The same component also renders `/explore` (`app/explore/page.tsx`)
with `mode="explore"`, which is where the sites and every list of them live —
the landing page keeps the hero, a browsing half of its own (the section keys,
the editor's picks, the Top 10, the website of the week, the submission form,
the tag shelf and the site web) and the
prose sections — About, the support hub directly under it, the community board,
the FAQ and the launch clock, in that order. One
file, two modes; see the README's “Pages and navigation” before moving
anything between them. The editor's picks are the landing page's alone:
`/explore` exists to be searched.

`/explore/<section>` is a single collection on a page of its own. Those pages
are built from `lib/sections.ts` — the one place a section's id, heading, lede,
count unit, filter field and cards are described. Add a collection there and its
page, its canonical metadata, its sitemap line, the count on its key row and the
rule a search uses to decide whether it stays on screen all follow. The two key
rows and the phone drawer still carry a row of their own, because each also
needs its own count text and href shape; `npm run test:directory` fails if any
hash the drawer offers is missing from the registry. The phone drawer also
searches in place, so a new collection is reachable from there: it lists the
strongest six matches by `searchScore` and links each to that pick's
`/sites/<slug>` page.

Two pieces of shared behaviour are worth knowing before touching a vote
surface. The fire button sits beside the thumbs on every card and every detail
page and is rendered in exactly one place — `FireButton` in
`components/site-votes.tsx` — with each surface feeding it its own vote state. A
fire is worth ten votes for a day, and that weight is `FIRE_VOTE_WEIGHT` in
`lib/vote-ranking.ts`, which the Worker imports too, so the board, the
`/explore` sort and `/stats` can never disagree about what a fire is worth. One
fire per visitor per day is remembered in the visitor's browser under
`base31-fires` (see `lib/fires.ts`); the expiry itself belongs to the Worker,
which keeps a list of timestamps per key and drops the ones older than
twenty-four hours as it reads them.

The site web (`components/site-web.tsx`) is the branching map of the whole
directory at the foot of the landing page's browsing half, with a hairline
`<hr class="section-divider">` between it and the tag shelf above. Its hubs and
leaves come from `lib/sections.ts` and `lib/directory.ts`, so a new pick needs
no edit in the component — which also means the picture is only right while
those two stay the single source of truth for collections and entries. Keep the
geometry free of `Math.random()` and of the clock: it is computed once at module
scope from a hash of each slug, and that is what keeps the server and the
browser drawing the same picture. Its rules are at the foot of `app/late.css`,
and none of them draws a panel: the map has no border, surface or shadow of its
own, only a radial glow behind the canvas, and the `.section-divider + .site-web`
rule beside it owns the air under that hairline.

The map's own controls are the visitor's rather than the directory's. `Wander
the web` is the one place a random number is allowed in the component — taken
from `crypto.getRandomValues` at the press, never at module scope, so hydration
is untouched — and it lights a leaf the geometry has already placed rather than
moving anything. The node under the pointer is named in SVG on the canvas, and
the met count is kept in `base31-web-met` in the visitor's own browser, beside
their votes and their fires, with a reset button because nothing else can clear
it. Keep anything else that wants a random number or the clock out of this file.

Shared components live in `components/`. Styling uses hand-written
CSS; `app/directory.css` owns editor's picks, the Top 10, the website of the
week (whose heading is now just the title and the week pill, with no marker
box), the refreshed
featured cards, the tag shelf and the mobile navigation drawer, and
`app/subsite.css` (loaded last) owns the pages outside the homepage: the path
band at the top of every subsite with its grey gradient, the `--page-band` grey
those pages sit on, the Best matches block and the per-section explorer. A pick
belongs to one collection: `npm run validate:content` fails a URL that two of
the external lists both claim.
Read the README's style load order before changing overrides. Prefer the existing CSS custom properties and component
patterns over new abstractions.

Two accessibility rules the homepage relies on:

- Buttons (pin, thumbs, fire, share) never sit inside a card's link, so
  nothing is focused twice.
- Decorative layers such as the code backdrop are `aria-hidden` and are dropped
  under `prefers-reduced-motion`.

## Environment variables

README documents keys and the runtime each belongs to. Configure secrets in
hosting environment settings and Worker secrets separately. Never commit
credential values or read existing secrets into logs. Public GitHub statistics
require no key. In Freebuff, workspace Git authentication is managed automatically.

## Pull requests

- Keep changes focused and match the surrounding style.
- Do not commit secrets, build output, or `node_modules/`.
- Make sure `npm run check` passes, and describe the change and why it is needed.

## Content and releases

Curated lists and the editorial shortlist are edited in `config/`; README
includes field examples and maintenance guidance. For a release, bump
`package.json`, the root package-lock metadata, and the newest changelog entry
together. Verify source/asset licensing before contributing third-party material.
