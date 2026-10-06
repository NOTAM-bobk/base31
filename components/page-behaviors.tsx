"use client";

import { useEffect } from "react";

// Two small page behaviors that ride along with the directory.
//
// 1. Screen Wake Lock. Where the API exists, the page asks the browser to keep
//    the display awake, and re-acquires the lock whenever the tab is brought
//    back to the foreground (the browser drops it automatically while hidden).
// 2. Resume position. See below.
//
// There is deliberately **no** leave warning: the page used to raise the
// browser's "unsaved changes will be discarded" confirmation once the visitor
// had clicked or scrolled, and it was removed because nothing here is actually
// unsaved — it only got in the way of closing a tab.
//
// Both remaining behaviors are best-effort: every API call is feature-detected
// and its failures are swallowed, so browsers without them simply get none of it.
type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export default function PageBehaviors() {
  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock;
    let sentinel: WakeLockSentinelLike | null = null;

    // Ask for the lock, but never throw: a refusal (low battery, no permission,
    // unsupported browser) must not break the page.
    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock.request("screen");
      } catch {
        sentinel = null;
      }
    };

    // The lock is released automatically when the page is hidden, so it has to
    // be asked for again each time the visitor comes back.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 2. Resume position. The scroll offset of each page is remembered (for 30
    //    days) so a visitor who leaves and comes back lands where they were.
    //    A link with a #hash always wins over the saved position.
    const scrollKey = `base31:scroll:${window.location.pathname}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(scrollKey) || "null") as { y: number; t: number } | null;
      if (!window.location.hash && saved && saved.y > 0 && Date.now() - saved.t < 30 * 864e5) {
        window.setTimeout(() => window.scrollTo({ top: saved.y, behavior: "auto" }), 80);
      }
    } catch { /* storage unavailable */ }
    let saveTimer: number | undefined;
    const saveScroll = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try { window.localStorage.setItem(scrollKey, JSON.stringify({ y: Math.round(window.scrollY), t: Date.now() })); } catch { /* ignore */ }
      }, 250);
    };
    window.addEventListener("scroll", saveScroll, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", saveScroll);
      window.clearTimeout(saveTimer);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);

  return null;
}
