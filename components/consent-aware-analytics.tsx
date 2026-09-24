"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent";

const clarityTag = "ylsxc7fokm";
const googleAnalyticsTag = "G-Y5N2FYK786";

// The ids the two snippets give the loader tags they append to the document,
// so a withdrawn choice has something to take back out.
const LOADER_IDS = ["microsoft-clarity-loader", "google-analytics-loader"];

// Microsoft Clarity and Google Analytics run only after the visitor confirms
// the cookie banner. The ad script lives in `consent-aware-ads.tsx` so the
// three can be reasoned about — and switched — separately.
export default function ConsentAwareAnalytics() {
  const consent = useConsent();

  // Removing a loader cannot unload the library it already pulled in, but it
  // does stop anything new being queued; a reload after withdrawing the choice
  // starts clean, which is what the privacy page describes.
  useEffect(() => {
    if (consent === "accepted") return;
    for (const id of LOADER_IDS) document.getElementById(id)?.remove();
  }, [consent]);

  if (consent !== "accepted") return null;

  const clarityScript = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.id="microsoft-clarity-loader";t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityTag}");`;

  // The same shape as the Adcash loader above: a real, id-carrying script
  // element, because Clarity and gtag both queue work through the page rather
  // than needing to be in the markup at first paint.
  const googleAnalyticsScript = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${googleAnalyticsTag}");(function(){var s=document.createElement("script");s.id="google-analytics-loader";s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsTag}";document.head.appendChild(s)})();`;

  return (
    <>
      <script id="microsoft-clarity" dangerouslySetInnerHTML={{ __html: clarityScript }} />
      <script id="google-analytics" dangerouslySetInnerHTML={{ __html: googleAnalyticsScript }} />
    </>
  );
}
