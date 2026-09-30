"use client";

import { useCallback, useEffect, useState } from "react";
import { tick } from "@/lib/haptics";

/**
 * A small floating shortcut from one section to the next.
 *
 * It only shows while `fromId` is the section being read — the same rule the
 * rail uses, the last section whose top has passed a third of the way down the
 * viewport — and disappears once `toId` reaches that line, so it never trails
 * the reader past its own destination.
 *
 * It sits in the bottom-left corner and is deliberately narrow, which is also
 * why it can share that corner with the donate button on the narrow layouts
 * where the donation board drops to a fixed bar: it is drawn above it
 * (`z-index`) rather than moved out of the way.
 */
export default function NextSectionButton({ fromId, toId, label }: { fromId: string; toId: string; label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const from = document.getElementById(fromId);
      const to = document.getElementById(toId);
      if (!from) {
        setVisible(false);
        return;
      }
      const line = window.innerHeight * 0.34;
      const reading = from.getBoundingClientRect().top <= line;
      const arrived = to ? to.getBoundingClientRect().top <= line : false;
      setVisible(reading && !arrived);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [fromId, toId]);

  const go = useCallback(() => {
    const target = document.getElementById(toId);
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Stops just below the fixed header, exactly like the rail's own jumps.
    const top = target.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    tick(12);
  }, [toId]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="next-section"
      onClick={go}
      aria-label={`Next section: ${label}`}
    >
      <span className="next-section-label">{label}</span>
      <span className="next-section-arrow" aria-hidden="true">↓</span>
    </button>
  );
}
