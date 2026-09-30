"use client";

import { useEffect, useState } from "react";

// How long a figure takes to climb from zero to its final value. Deliberately
// slow: the climb is meant to be watched, not missed on the way to something
// else.
const COUNT_MS = 3400;

// The project's size in lines of source, across the app, the components, the
// worker and the hand-written subdomain pages. Measured by hand on each
// release: 1.23.0 added 67 tracked lines.
const LINES_OF_CODE = 52579;

/**
 * Counts a figure up from zero to `target` with an ease-out, in a rAF loop.
 *
 * `target` may arrive late (the visitor count is fetched), so the effect waits
 * for a real number: while it is `null` the hook simply holds zero, and the
 * climb starts when the value lands. Visitors who asked for reduced motion get
 * the final number immediately — the figure is information, not decoration, so
 * skipping the animation must not hide it.
 */
function useCountUp(target: number | null, duration = COUNT_MS) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return;
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
 * The four figures the hero prints directly above the search and the one
 * action: how many times the directory has been read, how many of those loads
 * were a person rather than a reload, how many sites it links out to (the
 * built-in entries plus the off-directory picks), and how much code the project
 * is.
 *
 * The labels are deliberately English on every locale, like the rail's own
 * labels — they name the same numbers the counters and the source already
 * print in English elsewhere on the page.
 */
export default function HeroStats({ visitors, unique, sites }: { visitors: number | null; unique: number | null; sites: number }) {
  const visitorCount = useCountUp(visitors);
  const uniqueCount = useCountUp(unique);
  const siteCount = useCountUp(sites);
  const codeCount = useCountUp(LINES_OF_CODE);

  const stats = [
    { label: "views", text: visitors == null ? "—" : visitorCount.toLocaleString() },
    { label: "unique visitors", text: unique == null ? "—" : uniqueCount.toLocaleString() },
    { label: "websites linked", text: siteCount.toLocaleString() },
    { label: "lines of code", text: codeCount.toLocaleString() },
  ];

  return (
    <ul className="hero-stats" aria-label="base31 at a glance, four figures">
      {stats.map((stat) => (
        <li key={stat.label} className="hero-stat">
          <span className="hero-stat-value">{stat.text}</span>
          <span className="hero-stat-label mono">{stat.label}</span>
        </li>
      ))}
    </ul>
  );
}
