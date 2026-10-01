"use client";

import { useEffect, useState } from "react";
import { estimateLines } from "@/lib/code-estimate";

// How long a figure takes to climb from zero to its final value. Deliberately
// slow: the climb is meant to be watched, not missed on the way to something
// else.
const COUNT_MS = 3400;

const CODE_CACHE_KEY = "base31-code-estimate-v1";
const CODE_CACHE_MS = 24 * 60 * 60 * 1000;
const CODE_METHOD = "Estimated from GitHub language bytes divided by approximate bytes per line (TS/JS: 45, HTML: 60, CSS: 35). Not an exact source-line count; excludes files GitHub Linguist ignores.";

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
 * The three figures the hero prints directly above the search and the one
 * action: how many times the directory has been read, how many sites it links out to (the
 * built-in entries plus the off-directory picks), and how much code the project
 * is.
 *
 * The labels are deliberately English on every locale, like the rail's own
 * labels — they name the same numbers the counters and the source already
 * print in English elsewhere on the page.
 */
export default function HeroStats({ visitors, sites }: { visitors: number | null; sites: number }) {
  const [lines, setLines] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CODE_CACHE_KEY) || "null");
      if (saved && Number.isFinite(saved.lines) && saved.lines >= 0 && Number.isFinite(saved.at)) {
        setLines(saved.lines);
        const age = Date.now() - saved.at;
        if (age >= 0 && age < CODE_CACHE_MS) return;
      }
    } catch {}
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    void fetch("https://api.github.com/repos/NOTAM-bobk/base31/languages", {
      headers: { Accept: "application/vnd.github+json" }, signal: controller.signal,
    }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data || typeof data !== "object" || Array.isArray(data) || controller.signal.aborted) return;
      const estimate = estimateLines(data);
      if (estimate === null) return;
      setLines(estimate);
      try { localStorage.setItem(CODE_CACHE_KEY, JSON.stringify({ lines: estimate, at: Date.now() })); } catch {}
    }).catch(() => {}).finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);
  const visitorCount = useCountUp(visitors);
  const siteCount = useCountUp(sites);
  const codeCount = useCountUp(lines);

  const stats = [
    { label: "views", text: visitors == null ? "—" : visitorCount.toLocaleString() },
    { label: "websites linked", text: siteCount.toLocaleString() },
    { label: "estimated lines of code", text: lines === null ? "—" : `≈${codeCount.toLocaleString()}` },
  ];

  return (
    <ul className="hero-stats" aria-label="base31 at a glance, three figures">
      {stats.map((stat) => (
        <li key={stat.label} className="hero-stat" title={stat.label === "estimated lines of code" ? CODE_METHOD : undefined}>
          <span className="hero-stat-value">{stat.text}</span>
          <span className="hero-stat-label mono">{stat.label}</span>
        </li>
      ))}
      <li className="sr-only">{CODE_METHOD}</li>
    </ul>
  );
}
