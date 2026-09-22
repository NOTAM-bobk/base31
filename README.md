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
