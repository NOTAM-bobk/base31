import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");
const siteUrl = "https://base31.org";

type Site = { slug: string; title: string; description?: string; url?: string; active?: boolean };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const notFound = () =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title></head><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0a0a0a;color:#8a8a8a;font:12px system-ui,sans-serif">Featured card unavailable</body></html>`,
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );

const hostOf = (value?: string) => {
  if (!value) return "base31.org";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "base31.org";
  }
};

/**
 * The "featured on base31.org" card a publisher embeds on their own site. It is
 * a route handler rather than a page so it ships as one self-contained
 * document: no site header, footer, consent banner or analytics, and nothing
 * that could grow the iframe past the size its snippet declares.
 *
 * `frame-ancestors *` is deliberate. Any site may embed this card; denying
 * framing would break the snippet the submission dialog hands out.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return notFound();

  let site: Site | null = null;
  try {
    const response = await fetch(`${workerUrl}/site?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (response.ok) {
      const body = (await response.json()) as { site?: Site };
      site = body.site ?? null;
    }
  } catch {
    // An unreachable Worker still gets a generic card below.
  }

  if (!site || site.active === false) return notFound();

  const title = escapeHtml(site.title);
  const description = escapeHtml(site.description?.trim() || "A site in the base31.org directory.");
  const host = escapeHtml(hostOf(site.url));
  const href = `${siteUrl}/recently-added`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — featured on base31.org</title>
<style>
  :root { color-scheme: dark light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: transparent; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card {
    display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
    width: 100%; height: 100%; padding: 14px 16px; overflow: hidden;
    border: 1px solid #2a2a2a; border-radius: 12px; color: #ededed; text-decoration: none;
    background:
      radial-gradient(120% 140% at 100% 0%, rgb(70 232 145 / 10%), transparent 55%),
      #0a0a0a;
  }
  .top, .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .eyebrow { font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #8a8a8a; }
  .brand { font-size: 11px; font-weight: 600; color: #fff; letter-spacing: -.01em; }
  .brand span { color: #46e891; }
  .body { display: flex; min-height: 0; flex-direction: column; gap: 3px; }
  .name {
    display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    font-size: 16px; font-weight: 600; letter-spacing: -.02em; line-height: 1.2; color: #fff;
  }
  .desc {
    display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 1;
    font-size: 10.5px; line-height: 1.4; color: #b0b0b0;
  }
  .host { overflow: hidden; font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; color: #777; text-overflow: ellipsis; white-space: nowrap; }
  .cta { flex: 0 0 auto; font-family: "SFMono-Regular", Consolas, monospace; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #46e891; }
  .dot { display: inline-block; width: 5px; height: 5px; margin-right: 6px; border-radius: 50%; background: #46e891; vertical-align: 1px; }
  @media (prefers-color-scheme: light) {
    .card { border-color: #e2e2e2; color: #1b1b1b; background: radial-gradient(120% 140% at 100% 0%, rgb(15 157 88 / 10%), transparent 55%), #fff; }
    .brand, .name { color: #050505; }
    .desc { color: #555; }
    .host, .eyebrow { color: #8a8a8a; }
    .brand span, .cta { color: #0f9d58; }
    .dot { background: #0f9d58; }
  }
</style>
</head>
<body>
  <a class="card" href="${href}" target="_blank" rel="noopener">
    <span class="top">
      <span class="eyebrow"><span class="dot" aria-hidden="true"></span>Featured on</span>
      <span class="brand">base31<span>.org</span></span>
    </span>
    <span class="body">
      <span class="name">${title}</span>
      <span class="desc">${description}</span>
    </span>
    <span class="foot">
      <span class="host">${host}</span>
      <span class="cta">Explore the directory →</span>
    </span>
  </a>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The card is the same for everyone and changes only when the site does.
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
}
