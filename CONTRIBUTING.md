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
the tag shelf) and the
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
hash the drawer offers is missing from the registry.

Shared components live in `components/`. Styling uses hand-written
CSS; `app/directory.css` owns editor's picks, the Top 10, the refreshed
featured cards, the tag shelf and the mobile navigation drawer, and
`app/subsite.css` (loaded last) owns the pages outside the homepage: the path
band at the top of every subsite with its grey gradient, the Best matches block
and the per-section explorer.
Read the README's style load order before changing overrides. Prefer the existing CSS custom properties and component
patterns over new abstractions.

Two accessibility rules the homepage relies on:

- Buttons (pin, thumbs, share) never sit inside a card's link, so nothing is
  focused twice.
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
