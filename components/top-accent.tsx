"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* The thin green line across the top of every page, which doubles as the
   site's loading indicator.

   It is the same 2px rule the layout always drew; the only difference is that
   it now reacts when a visitor follows a link that stays on this site. The
   solid line dims, a bright green bar grows out of the left edge while the
   next page is on its way, and when the page arrives the bar completes, fades
   and leaves the solid line behind — so a page change is never a click with no
   answer. Nothing is fetched or measured for this: the click and the route
   change are the only two signals it needs.

   Internal links are plain anchors in most of the site and `next/link` in the
   inner pages, so both signals are real: the click starts the bar for either
   kind, and the pathname change finishes it for the client-side navigations.
   A hard navigation never reaches the finish, which is fine — the browser
   keeps this page on screen while the next one loads, so the bar animates for
   exactly as long as the wait. */

// The bar is shown for at least this long, so a fast navigation still reads as
// a deliberate answer rather than a flicker on the line.
const MIN_MS = 420;
// How long the completed bar lingers before it fades back to the solid line.
const DONE_MS = 340;
// If the next page never arrives (a cancelled navigation, an offline click),
// the bar gives up rather than sitting there growing forever.
const SAFETY_MS = 6000;

type Phase = "idle" | "loading" | "done";

export default function TopAccent() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const firstRender = useRef(true);
  // Whether a click has started a bar that the next route change should finish.
  // Kept in a ref as well as in the phase, so the route effect never has to
  // reason about whether React has committed the loading state yet — the ref is
  // already true by the time the click handler returns.
  const waiting = useRef(false);
  const startedAt = useRef(0);
  const stepTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (stepTimer.current) {
      window.clearTimeout(stepTimer.current);
      stepTimer.current = null;
    }
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  // A click on a link that stays on this site is the start signal. Modified
  // clicks, downloads, new tabs, hash jumps and external links are all left
  // alone: none of them is a page change this bar could honestly report.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target && typeof target.closest === "function" ? target.closest("a") : null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Only a real change counts — a same-path link would never finish.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clearTimers();
      startedAt.current = Date.now();
      waiting.current = true;
      setPhase("loading");
      safetyTimer.current = window.setTimeout(() => {
        safetyTimer.current = null;
        waiting.current = false;
        setPhase("idle");
      }, SAFETY_MS);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [clearTimers]);

  // The route change is the finish signal. The bar is held for MIN_MS so a
  // cached page cannot swallow it, then completes and hands the line back.
  const finish = useCallback(() => {
    clearTimers();
    waiting.current = false;
    const wait = Math.max(0, MIN_MS - (Date.now() - startedAt.current));
    stepTimer.current = window.setTimeout(() => {
      stepTimer.current = window.setTimeout(() => {
        stepTimer.current = null;
        setPhase("idle");
      }, DONE_MS);
      setPhase("done");
    }, wait);
  }, [clearTimers]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (waiting.current) finish();
  }, [pathname, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      className={`top-accent${phase === "loading" ? " is-loading" : ""}${phase === "done" ? " is-done" : ""}`}
      aria-hidden="true"
    >
      <span className="top-accent-fill" />
    </div>
  );
}
