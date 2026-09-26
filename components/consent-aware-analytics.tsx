"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent";

const clarityTag = "ylsxc7fokm";
const googleAnalyticsTag = "G-Y5N2FYK786";

// The ids the two snippets give the loader tags they append to the document,
// so a withdrawn choice has something to take back out.
const LOADER_IDS = ["microsoft-clarity-loader", "google-analytics-loader"];

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

// Microsoft Clarity and Google Analytics run only after the visitor confirms
// the cookie banner. The ad script lives in `consent-aware-ads.tsx` so the
// three can be reasoned about — and switched — separately.
export default function ConsentAwareAnalytics() {
  const consent = useConsent();

  // Both snippets are written into real script elements rather than inline
  // JSX. An inline `<script>` only runs if the browser prepares it as it is
  // inserted, which is easy to lose when the element is created by the
  // renderer instead of the parser — and a tag that silently never runs is
  // exactly how analytics "stop working". Setting `text` on a detached
  // element and then appending it runs every time, so the README snippet is
  // reproduced faithfully here.
  useEffect(() => {
    if (consent !== "accepted") return;

    // Google tag (gtag.js), from README.md. `gtag` queues into `dataLayer`
    // before the loader arrives, so the config call does not have to wait.
    const view = window as AnalyticsWindow;
    view.dataLayer = view.dataLayer || [];
    view.gtag = function gtag(...args: unknown[]) {
      view.dataLayer?.push(args);
    };
    view.gtag("js", new Date());
    view.gtag("config", googleAnalyticsTag);

    const loader = document.createElement("script");
    loader.id = "google-analytics-loader";
    loader.async = true;
    loader.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsTag}`;

    // The Clarity snippet is itself a small inline program that appends the
    // real loader under `microsoft-clarity-loader`.
    const clarity = document.createElement("script");
    clarity.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.id="microsoft-clarity-loader";t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityTag}");`;

    document.head.append(clarity, loader);

    return () => {
      clarity.remove();
      loader.remove();
      document.getElementById("microsoft-clarity-loader")?.remove();
    };
  }, [consent]);

  // Removing a loader cannot unload the library it already pulled in, but it
  // does stop anything new being queued; a reload after withdrawing the choice
  // starts clean, which is what the privacy page describes.
  useEffect(() => {
    if (consent === "accepted") return;
    for (const id of LOADER_IDS) document.getElementById(id)?.remove();
  }, [consent]);

  return null;
}
