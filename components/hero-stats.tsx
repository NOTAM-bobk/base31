"use client";

import { useEffect, useState } from "react";

// How long a figure takes to climb from zero to its final value. Deliberately
// slow: the climb is meant to be watched, not missed on the way to something
// else. Both of the hero's figures use it, so they finish together.
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
 * One figure and what it counts: the number, then its label.
 *
 * It is hidden from assistive technology on purpose. The line it sits in is
 * named by its own `aria-label` — the sentence the figures spell out — so a
 * screen reader reading both would say the same thing twice.
 */
function HeroFigure({ value, label }: { value: number; label: string }) {
  return (
    <span className="hero-stat" aria-hidden="true">
      <span className="hero-stat-value">{value.toLocaleString()}</span>
      <span className="hero-stat-label">{label}</span>
    </span>
  );
}

/**
 * The two figures the hero prints, directly above the directory's call to
 * action: how many websites it links out to and how many collections those
 * websites are filed under.
 *
 * Both are the same figure as far as a visitor is concerned, so both are drawn
 * by the same markup and climb with the same hook. The categories count used to
 * be plain words inside the first figure's label — which left one number
 * animating and the other sitting still — and reading them as one sentence is
 * still exactly what the line's `aria-label` does, so the sentence a screen
 * reader hears is the one the two figures spell out. The count is the sum of
 * the collections it names (`directorySections` in lib/sections.ts), so the two
 * halves of that sentence cannot disagree, and it stays true as the directory
 * grows.
 */
export default function HeroStats({ sites, categories }: { sites: number; categories: number }) {
  const siteCount = useCountUp(sites);
  const categoryCount = useCountUp(categories);
  const categoryLabel = categories === 1 ? "category" : "categories";
  const sentence = `${sites.toLocaleString()} websites linked across ${categories} ${categoryLabel}`;

  return (
    <p className="hero-stats" aria-label={sentence}>
      <HeroFigure value={siteCount} label="websites linked" />
      <span className="hero-stat-join" aria-hidden="true">across</span>
      <HeroFigure value={categoryCount} label={categoryLabel} />
    </p>
  );
}
