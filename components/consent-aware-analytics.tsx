"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const clarityTag = "ylsxc7fokm";
const adsterraScript = "https://pl31451991.profitableratecpmnetwork.com/ea/93/a7/ea93a7aa7cba5d6e3c658cd19a0dded2.js";

export default function ConsentAwareAnalytics() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setConsent(window.localStorage.getItem("base31-consent"));
    const onConsent = () => read();
    read();
    window.addEventListener("base31-consent-change", onConsent);
    window.addEventListener("storage", onConsent);
    return () => {
      window.removeEventListener("base31-consent-change", onConsent);
      window.removeEventListener("storage", onConsent);
    };
  }, []);

  if (consent !== "accepted") return null;

  const clarityScript = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarityTag}");`;

  return (
    <>
      <script id="microsoft-clarity" dangerouslySetInnerHTML={{ __html: clarityScript }} />
      <Script id="adsterra" src={adsterraScript} strategy="afterInteractive" />
    </>
  );
}
