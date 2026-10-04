"use client";

import { useEffect } from "react";

// Two small page behaviors that ride along with the directory.
//
// 1. Screen Wake Lock. Where the API exists, the page asks the browser to keep
//    the display awake, and re-acquires the lock whenever the tab is brought
//    back to the foreground (the browser drops it automatically while hidden).
// 2. A leave warning. Once the visitor has actually clicked, scrolled, tapped or
//    typed, closing or reloading the page raises the browser's "unsaved changes
//    will be discarded" confirmation. Nothing on the page is truly unsaved — the
//    point is to stop an accidental close from throwing away a half-finished
//    read (a vote, a search, a scrolling session).
//
// Both are best-effort: every API call is feature-detected and its failures are
// swallowed, so browsers without them simply get none of it.
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

    // Any real gesture marks the session as "in progress". Pointer and key
    // events cover clicks and typing; a scroll of any kind covers touch and
    // wheel, which do not always surface as pointer events.
    let interacted = false;
    const markInteracted = () => {
      interacted = true;
    };
    const gestures = ["pointerdown", "keydown", "wheel", "touchstart"];
    gestures.forEach((type) => window.addEventListener(type, markInteracted, { passive: true }));
    window.addEventListener("scroll", markInteracted, { passive: true });

    // 3. Resume position. The scroll offset of each page is remembered (for 30
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

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!interacted) return;
      // Both of these are required for the browser to show its own confirmation
      // (the message text is not customizable).
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gestures.forEach((type) => window.removeEventListener(type, markInteracted));
      window.removeEventListener("scroll", markInteracted);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("scroll", saveScroll);
      window.clearTimeout(saveTimer);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);

  return null;
}
