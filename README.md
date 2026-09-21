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
│   └── sites.json         ← the directory's data (edit this)
├── public/
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
the same way it treats `*.base31.org`).


<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ylsxc7fokm");
</script>
