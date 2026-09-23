"use client";

import { useEffect, useState } from "react";

/** Where the visitor's cookie choice is remembered. */
export const CONSENT_KEY = "base31-consent";
/** Dispatched on `window` whenever that choice changes. */
export const CONSENT_EVENT = "base31-consent-change";

export type Consent = "accepted" | "denied" | null;

/** The stored choice, or null when the visitor has not answered yet. */
export function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "denied" ? stored : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: "accepted" | "denied") {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage can be unavailable (private mode); the choice then lives for
    // this page view only, which is still better than ignoring it.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Forget the stored choice so the banner asks again. */
export function resetConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {}
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Live view of the stored choice, so ad and analytics scripts can react. */
export function useConsent(): Consent {
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return consent;
}
