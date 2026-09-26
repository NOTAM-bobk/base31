# Contributing to base31.org

Thanks for helping out. base31.org is one Next.js project that hosts both the
directory homepage (on `base31.org`) and every subdomain site (on
`*.base31.org`), so most contributions are either a new site under
`public/sites/` or a change to the homepage in `app/`.

## Getting started

```bash
npm install
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
| `npm run lint` | Run `next lint` |
| `npm run check` | All three of the above |

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

4. Run `npm run validate:content` and fix anything it reports.

Rules the validator enforces (see `scripts/validate-content.mjs`):

- `subdomain` must be a lowercase slug (`^[a-z0-9]+(-[a-z0-9]+)*$`) and must
  match the folder name under `public/sites/` **exactly**.
- `url` must be `https`, and there must be a favicon at
  `public/site-icons/<subdomain>.svg` unless the entry sets its own `icon`.
- `tags` needs at least one value, `description` at least 20 characters, and
  `show` must be a boolean.

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

Every static subdomain page must include the Adcash auto-tag (zone
`iy7zk7mmw`) directly in its `<head>`, ungated, because these pages render
outside Next.js and have no cookie banner. The loader is async, so poll briefly
for `aclib` before calling `runAutoTag` — copy the block from an existing page
such as `public/sites/passwordgen/index.html`.

### Design conventions

Keep the shared look: a clean monochrome base with an emerald accent
(`#10b981` / `#3ecf8e`), a subtle grid backdrop, `Inter` + `JetBrains Mono`,
light/dark support driven by `data-theme` with a pre-paint localStorage
restore, CSS custom properties, a `.sr-only` utility, a skip link and a
`:focus-visible` accent ring. Wrap motion in
`@media (prefers-reduced-motion: reduce)`.

## Changing the homepage

Homepage markup lives in `app/page.tsx` and shared components in
`components/`. Styling is split between the hand-written `app/globals.css` and
`app/overrides.css` (which carries most of the visual design — read the
comments there). Prefer the existing CSS custom properties and component
patterns over new abstractions.

Two accessibility rules the homepage relies on:

- Buttons (pin, thumbs, share) never sit inside a card's link, so nothing is
  focused twice.
- Decorative layers such as the code backdrop are `aria-hidden` and are dropped
  under `prefers-reduced-motion`.

## Environment variables

`env.example` lists every key the project expects, with placeholders only. Add
new keys there (never in `.env`, which is git-ignored) and describe them in
`README.md` if they change how something behaves.

## Pull requests

- Keep changes focused and match the surrounding style.
- Do not commit secrets, build output, or `node_modules/`.
- Make sure `npm run check` passes, and describe the change and why it is needed.

## License

By contributing you agree that your work is released under the [MIT
License](LICENSE).
