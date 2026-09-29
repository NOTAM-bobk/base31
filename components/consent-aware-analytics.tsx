"use client";

import { useEffect } from "react";
import { CONSENT_TYPES } from "@/lib/analytics";
import { useConsent } from "@/lib/consent";

const clarityTag = "ylsxc7fokm";

// The id the Clarity snippet gives the loader tag it appends, so a withdrawn
// choice has something to take back out. The Google tag is deliberately not in
// this list: it is served by `app/layout.tsx` and Consent Mode turns its
// storage off instead of its script being pulled out of the page.
const LOADER_IDS = ["microsoft-clarity-loader"];

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

// The cookies the Google tag writes. Clearing them is the part of "withdraw
// consent" a page can still perform after the library has loaded.
const GOOGLE_COOKIE = /^_(ga|gid|gcl|gac)/;

function clearGoogleCookies() {
  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name || !GOOGLE_COOKIE.test(name)) continue;
    for (const domain of ["", location.hostname, `.${location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

// Microsoft Clarity only runs after the visitor confirms the cookie banner — it
// records sessions, so it is the one that waits for the answer. The Google tag
// is different: it is in the page on every load (see `app/layout.tsx`), and the
// Consent Mode update below is what holds its storage back. The ad script lives
// in `consent-aware-ads.tsx` so the three can be reasoned about — and switched
// — separately.
export default function ConsentAwareAnalytics() {
  const consent = useConsent();

  // The Clarity snippet is a small inline program that appends the real loader
  // under `microsoft-clarity-loader`. It is written into a real script element
  // rather than inline JSX: an inline `<script>` only runs if the browser
  // prepares the element as it is inserted, which is easy to lose when the
  // element is created by the renderer instead of the parser.
  useEffect(() => {
    if (consent !== "accepted") return;

    const clarity = document.createElement("script");
    clarity.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.id="microsoft-clarity-loader";t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityTag}");`;
    document.head.append(clarity);

    return () => {
      clarity.remove();
      document.getElementById("microsoft-clarity-loader")?.remove();
    };
  }, [consent]);

  // Removing a loader cannot unload the library it already pulled in, so a
  // denied or withdrawn choice leaves the library idle rather than gone.
  useEffect(() => {
    if (consent === "accepted") return;
    for (const id of LOADER_IDS) document.getElementById(id)?.remove();
  }, [consent]);

  // The visitor's answer, handed to the Google tag as a Consent Mode update:
  // `granted` lets it write its cookies, `denied` keeps them off and clears any
  // an earlier visit left behind. A null answer is ignored — the default in the
  // head snippet is already `denied`.
  useEffect(() => {
    if (consent === null) return;
    const gtag = (window as AnalyticsWindow).gtag;
    if (!gtag) return;

    const granted = consent === "accepted";
    const update: Record<string, string> = {};
    for (const type of CONSENT_TYPES) update[type] = granted ? "granted" : "denied";
    gtag("consent", "update", update);

    if (!granted) clearGoogleCookies();
  }, [consent]);

  return null;
}
