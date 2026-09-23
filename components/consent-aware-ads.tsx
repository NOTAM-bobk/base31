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

// Adsterra's iframe banner (160x300). Its loader writes the ad frame with
// document.write, which browsers ignore once the surrounding document has
// finished parsing — so the snippet gets its own iframe, where the child
// document is still loading while the loader runs. That also keeps the ad's
// markup out of the directory's own document. Consent gates it like the rest.
const BANNER_KEY = "d1495d5e568642fb60c4f1232a9af565";
const BANNER_WIDTH = 160;
const BANNER_HEIGHT = 300;

const bannerDocument = [
  "<!doctype html><html><head><meta charset=\"utf-8\">",
  "<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>",
  "<script type=\"text/javascript\">",
  `atOptions={'key':'${BANNER_KEY}','format':'iframe','height':${BANNER_HEIGHT},'width':${BANNER_WIDTH},'params':{}};`,
  "</scr" + "ipt>",
  `<script type="text/javascript" src="https://www.highrevenueformat.com/${BANNER_KEY}/invoke.js"></scr` + "ipt>",
  "</body></html>",
].join("");

/**
 * A single 160x300 ad unit. Before consent the slot still renders — labelled,
 * with a short explanation — so the layout never jumps when the ad appears.
 */
export function AdsterraBanner() {
  const consent = useConsent();

  return (
    <aside className="ad-slot" data-reveal aria-label="Advertisement">
      <div className="ad-slot-head">
        <span className="ad-slot-tag mono">ad</span>
        <span className="ad-slot-note">
          {consent === "accepted" ? "Sponsored" : "Ads load after you confirm cookies"}
        </span>
      </div>
      {consent === "accepted" ? (
        <iframe
          className="ad-slot-frame"
          title="Advertisement"
          width={BANNER_WIDTH}
          height={BANNER_HEIGHT}
          srcDoc={bannerDocument}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="ad-slot-placeholder" aria-hidden="true" />
      )}
    </aside>
  );
}
