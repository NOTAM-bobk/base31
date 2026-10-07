"use client";

// The site's light/dark switch, in one place.
//
// It used to live inside the homepage's state, which was fine while the
// homepage was the only page with a header. The 404 wears the same header bar
// now, so the rule has two homes and would otherwise have two
// implementations — and the two would drift on the one detail that matters
// most here: *what the site looks like before the visitor has chosen*.
//
// The default is the device's own preference (`prefers-color-scheme`), not a
// house colour: a visitor whose phone is in light mode gets the light theme
// on their first visit, and if their device flips at sunset the page follows
// it. Only an explicit tap on the toggle is stored, and a stored choice wins
// over the device from then on — which is also what makes the toggle a real
// choice rather than a nudge that the device can undo.
//
// The inline script in `app/layout.tsx` applies the same rule before the page
// paints, so the first frame is already the right theme; this hook resolves
// the same answer after mount and owns every change after that.

import { useCallback, useEffect, useRef, useState } from "react";

export type Theme = "dark" | "light";

/** Where an explicit choice is kept. Shared with the pre-paint script. */
export const THEME_STORAGE_KEY = "base31-theme";

/** The visitor's own choice, or null when they have never made one. */
export function readStoredTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

/**
 * What the device asks for. Only an explicit light preference switches the
 * site off its dark default, so a browser that reports nothing (or reports
 * `no-preference`) stays dark, exactly as before.
 */
export function deviceTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** The theme that should be on screen now: their choice, else their device's. */
export function resolveTheme(): Theme {
  return readStoredTheme() ?? deviceTheme();
}

/** Paints the theme on <html> and keeps the browser chrome colour in step. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#fafafa" : "#000000");
}

/**
 * The theme state every header shares: resolves the device's preference on
 * mount, follows it while the visitor has made no choice, and stores the
 * toggle's own choice so it survives the next visit.
 */
export function useSiteTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  // Nothing is written to the DOM until the real answer is known, so the
  // pre-paint script's work is never overwritten by the placeholder dark.
  const [resolved, setResolved] = useState(false);
  // Set only by the toggle: what separates a chosen theme from a followed one.
  const chosen = useRef(false);

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setTheme(stored);
      setResolved(true);
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setTheme(media.matches ? "light" : "dark");
    sync();
    setResolved(true);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Only a choice is persisted, so following the device never quietly becomes
  // one — and the device can keep changing its mind until the visitor doesn't.
  useEffect(() => {
    if (!resolved || !chosen.current) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme, resolved]);

  useEffect(() => {
    if (resolved) applyTheme(theme);
  }, [theme, resolved]);

  const toggleTheme = useCallback(() => {
    chosen.current = true;
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
