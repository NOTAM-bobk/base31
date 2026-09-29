"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent";

const clarityTag = "ylsxc7fokm";

// The id the Clarity snippet gives the loader tag it appends, so a withdrawn
// choice has something to take back out.
const LOADER_IDS = ["microsoft-clarity-loader"];

// Microsoft Clarity waits for the visitor's answer, because it records sessions
// rather than counting visits. The Google tag deliberately does not: it is
// served from the head on every page and runs either way, which is what Google
// verifies (see `lib/analytics.ts`). The ad script waits too, and lives in
// `consent-aware-ads.tsx` so the two gated scripts can be reasoned about — and
// switched — separately.
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

  // Removing a loader cannot unload the library it already pulled in, but it
  // does stop anything new being queued; a reload after withdrawing the choice
  // starts clean, which is what the privacy page describes.
  useEffect(() => {
    if (consent === "accepted") return;
    for (const id of LOADER_IDS) document.getElementById(id)?.remove();
  }, [consent]);

  return null;
}
