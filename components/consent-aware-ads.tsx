"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent";

const ADCASH_SCRIPT_ID = "adcash-auto-tag";
const ADCASH_SCRIPT_URL = "https://acscdn.com/script/aclib.js";
const ADCASH_ZONE_ID = "iy7zk7mmw";

type AdcashWindow = Window & {
  aclib?: {
    runAutoTag: (options: { zoneId: string }) => void;
  };
};

export default function ConsentAwareAds() {
  const consent = useConsent();

  useEffect(() => {
    if (consent !== "accepted") return;

    const script = document.createElement("script");
    let active = true;
    script.id = ADCASH_SCRIPT_ID;
    script.async = true;
    script.src = ADCASH_SCRIPT_URL;
    script.onload = () => {
      const adcash = (window as AdcashWindow).aclib;
      if (active && adcash) adcash.runAutoTag({ zoneId: ADCASH_ZONE_ID });
    };
    document.head.appendChild(script);

    return () => {
      active = false;
      script.onload = null;
      script.remove();
    };
  }, [consent]);

  return null;
}
