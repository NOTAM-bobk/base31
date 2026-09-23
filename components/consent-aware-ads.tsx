"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";

// Adsterra's site-wide unit (a popunder / social-bar format) is a marketing
// script, so it is injected only after the visitor confirms in the banner.
// Denying — or never answering — means no ad script ever reaches the page, and
// withdrawing consent later unmounts it again.
const adsterraScript = "https://pl31451991.profitableratecpmnetwork.com/ea/93/a7/ea93a7aa7cba5d6e3c658cd19a0dded2.js";

export default function ConsentAwareAds() {
  const consent = useConsent();

  if (consent !== "accepted") return null;

  return <Script id="adsterra" src={adsterraScript} strategy="afterInteractive" />;
}
