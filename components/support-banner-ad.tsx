"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "@/lib/consent";

// The 160x300 banner in the support hub. The network's tag is two pieces: a
// global `atOptions` describing the slot, and a loader script that reads it and
// builds the frame. The snippet is normally pasted as two inline tags; here the
// script is inserted into the slot on the client instead, because the snippet
// cannot be pasted into React and it must not run before the visitor has
// answered the cookie banner — so it follows the same rule as the Adcash
// auto-tag in components/consent-aware-ads.tsx: nothing is fetched from the ad
// network until the answer is `accepted`, and withdrawing the answer removes
// the script and whatever it wrote.
//
// The slot keeps its 160x300 footprint whether or not an ad is there, so the
// support section never reflows when the network answers (or does not).
const AD_KEY = "d1495d5e568642fb60c4f1232a9af565";
const AD_WIDTH = 160;
const AD_HEIGHT = 300;
const AD_SCRIPT_ID = "highrevenue-banner-loader";
const AD_SCRIPT_URL = `https://www.highrevenueformat.com/${AD_KEY}/invoke.js`;

type AdOptions = { key: string; format: string; height: number; width: number; params: Record<string, never> };
type AdWindow = Window & { atOptions?: AdOptions };

export default function SupportBannerAd() {
  const consent = useConsent();
  const slot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const holder = slot.current;
    if (consent !== "accepted" || !holder) return;
    // The loader is global: if it is already in the page, it is already
    // working on this slot and a second copy would double up the request.
    if (document.getElementById(AD_SCRIPT_ID)) return;

    (window as AdWindow).atOptions = {
      key: AD_KEY,
      format: "iframe",
      height: AD_HEIGHT,
      width: AD_WIDTH,
      params: {},
    };

    const script = document.createElement("script");
    script.id = AD_SCRIPT_ID;
    script.async = true;
    script.src = AD_SCRIPT_URL;
    holder.appendChild(script);

    return () => {
      script.remove();
      // The frame the loader built belongs to it, not to us: dropping the
      // script alone would leave a dead frame behind in the slot.
      holder.replaceChildren();
    };
  }, [consent]);

  return (
    <div className={`support-banner-ad${consent === "accepted" ? "" : " is-waiting"}`} data-reveal>
      <span className="support-ad-tag mono">ad</span>
      <div className="support-banner-ad-slot" ref={slot} />
      {consent !== "accepted" && (
        <p className="support-banner-ad-note">
          Advertising here waits for your answer to the cookie notice.{" "}
          <a href="/privacy">Read the privacy notes</a>.
        </p>
      )}
    </div>
  );
}
