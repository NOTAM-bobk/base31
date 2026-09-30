"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "@/lib/consent";

// The second ad slot in the support hub, from the profitable-rate CPM network.
// Its snippet is a loader script plus an empty container it fills; both are
// pasted as inline tags on most sites, but the script must not run before the
// visitor has answered the cookie banner, so it follows the same rule as the
// Adsterra banner beside it (components/support-banner-ad.tsx) and the Adcash
// auto-tag (components/consent-aware-ads.tsx): the container is always in the
// page, the loader is appended only on `accepted`, and withdrawing the answer
// removes the script and clears whatever it wrote into the container.
const AD_SCRIPT_ID = "profitableratecpm-loader";
const AD_SCRIPT_URL = "https://pl31451992.profitableratecpmnetwork.com/6e8a865fe9ff04e640f573ee8d517d96/invoke.js";
// The network writes into the element with this id, so it is fixed by the
// snippet rather than ours to rename.
const AD_CONTAINER_ID = "container-6e8a865fe9ff04e640f573ee8d517d96";

export default function SupportInlineAd() {
  const consent = useConsent();
  const slot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (consent !== "accepted") return;
    // One loader is global to the network; a second copy would double up the
    // request and fight the first over the same container.
    if (document.getElementById(AD_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = AD_SCRIPT_ID;
    script.async = true;
    // The snippet carries this attribute so Cloudflare's rocket loader leaves
    // the tag alone; set it here too so the managed script behaves the same.
    script.dataset.cfasync = "false";
    script.src = AD_SCRIPT_URL;
    document.body.appendChild(script);

    return () => {
      script.remove();
      // The container and everything the loader drew into it belong to the
      // network: dropping the script alone would leave a dead frame behind.
      slot.current?.replaceChildren();
    };
  }, [consent]);

  return (
    <div className={`support-inline-ad${consent === "accepted" ? "" : " is-waiting"}`} data-reveal>
      <span className="support-ad-tag mono">ad</span>
      <div id={AD_CONTAINER_ID} className="support-inline-ad-slot" ref={slot} />
      {consent !== "accepted" && (
        <p className="support-banner-ad-note">
          Advertising here waits for your answer to the cookie notice.{" "}
          <a href="/privacy">Read the privacy notes</a>.
        </p>
      )}
    </div>
  );
}
