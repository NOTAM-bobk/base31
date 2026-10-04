import { NextRequest, NextResponse } from "next/server";

// The apex domain this whole project is deployed on.
// Change this if you ever move to a different root domain.
const ROOT_DOMAIN = "base31.org";

// The one subdomain that is not a static folder: tags.base31.org serves the
// tag index and one page per tag, both of which are Next.js routes derived from
// the directory itself. It is a subdomain rather than only an internal route so
// a tag has a short, memorable address (tags.base31.org/fun) that can be shared
// on its own, while /tags keeps working on the apex.
const TAG_SUBDOMAIN = "tags";

const SUBDOMAIN_ALIASES: Record<string, string> = {
  dailywordle: "dailywordel",
  jokegenerator: "jokegenrator",
  voicetranscribe: "voicetransrib",
};

function getSubdomain(host: string): string | null {
  const hostname = host.split(":")[0]; // strip port, e.g. for localhost:3000

  // Local development: use e.g. "example.localhost:3000"
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(".localhost", "");
    return sub || null;
  }

  // Vercel preview deployments (project.vercel.app) have no meaningful
  // subdomain for our purposes — always treat as the root site.
  if (hostname.endsWith(".vercel.app")) {
    return null;
  }

  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return null;
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return hostname.slice(0, -(`.${ROOT_DOMAIN}`.length));
  }

  return null;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const subdomain = getSubdomain(host);

  // No subdomain (or "www") -> this is the root directory site, serve normally.
  if (!subdomain) {
    return NextResponse.next();
  }

  const legacyTarget = SUBDOMAIN_ALIASES[subdomain];
  if (legacyTarget) {
    const destination = request.nextUrl.clone();
    destination.hostname = `${legacyTarget}.${ROOT_DOMAIN}`;
    return NextResponse.redirect(destination, 308);
  }

  const url = request.nextUrl.clone();
  let pathname = url.pathname;

  // tags.base31.org/<tag> → /tags/<tag>, and the bare host → /tags. A trailing
  // slash is dropped so both spellings reach the same route.
  if (subdomain === TAG_SUBDOMAIN) {
    const tag = pathname.replace(/^\/+|\/+$/g, "");
    url.pathname = tag ? `/tags/${tag}` : "/tags";
    return NextResponse.rewrite(url);
  }

  // Map "/" to that site's index.html since these are plain static files,
  // not Next.js routes.
  if (pathname === "/") {
    pathname = "/index.html";
  }

  url.pathname = `/sites/${subdomain}${pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  // Run on everything except Next internals and API routes.
  matcher: ["/((?!_next|api).*)"],
};
