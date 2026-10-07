"use client";

import { useEffect, useState } from "react";

// How long a figure takes to climb from zero to its final value. Deliberately
// slow: the climb is meant to be watched, not missed on the way to something
// else.
const COUNT_MS = 3400;

/**
 * Counts a figure up from zero to `target` with an ease-out, in a rAF loop.
 *
 * Visitors who asked for reduced motion get the final number immediately — the
 * figure is information, not decoration, so skipping the animation must not
 * hide it.
 */
function useCountUp(target: number, duration = COUNT_MS) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/**
 * The one figure the hero prints, directly above the directory's call to
 * action: how many websites it links out to and how many collections those
 * websites are filed under.
 *
 * It is a sentence rather than a row of counters. Every other number on the
 * page is a list's own count, and the hero had two figures — reads and links —
 * that pulled in opposite directions: a read count is about the page, the
 * links are about the directory, and side by side neither read as the point.
 * The reads still live on /stats, where a number about the site belongs; what
 * is left here is the one claim the landing page exists to make. The count is a
 * live total (`directoryEntries` plus the site list), so it stays true as the
 * directory grows, and it is exactly the sum of the collections it names.
 */
export default function HeroStats({ sites, categories }: { sites: number; categories: number }) {
  const siteCount = useCountUp(sites);
  const sentence = `${sites.toLocaleString()} websites linked across ${categories} ${categories === 1 ? "category" : "categories"}`;

  return (
    <p className="hero-stats" aria-label={sentence}>
      <span className="hero-stat-value" aria-hidden="true">{siteCount.toLocaleString()}</span>
      <span className="hero-stat-label" aria-hidden="true">
        websites linked across {categories} {categories === 1 ? "category" : "categories"}
      </span>
    </p>
  );
}
