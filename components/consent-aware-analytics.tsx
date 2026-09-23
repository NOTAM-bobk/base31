"use client";

import { useConsent } from "@/lib/consent";

const clarityTag = "ylsxc7fokm";

// Microsoft Clarity runs only after the visitor confirms the cookie banner.
// The ad script lives in `consent-aware-ads.tsx` so the two can be reasoned
// about — and switched — separately.
export default function ConsentAwareAnalytics() {
  const consent = useConsent();

  if (consent !== "accepted") return null;

  const clarityScript = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityTag}");`;

  return <script id="microsoft-clarity" dangerouslySetInnerHTML={{ __html: clarityScript }} />;
}
