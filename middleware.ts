import { NextRequest, NextResponse } from "next/server";

// The apex domain this whole project is deployed on.
// Change this if you ever move to a different root domain.
const ROOT_DOMAIN = "base31.org";

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

  const url = request.nextUrl.clone();
  let pathname = url.pathname;

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
