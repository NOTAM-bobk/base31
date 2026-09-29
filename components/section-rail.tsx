"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { tick } from "@/lib/haptics";

export type RailSection = { id: string; label: string };

// How long a wheel notch keeps its lock: one notch, one section, however hard
// a trackpad is flicked.
const WHEEL_COOLDOWN_MS = 420;

/**
 * The section rail: a column of small lines pinned to the right edge of the
 * homepage, one per section, top to bottom in page order.
 *
 * The line for the section you are reading stands up — it rotates from flat to
 * vertical and brightens — and its label slides out beside it, so the rail
 * doubles as a position readout and as a menu. Clicking a line scrolls there;
 * scrolling *on* the rail walks one section at a time instead of scrolling the
 * page, which is the quick way through a long homepage.
 *
 * It is always there, from the first screen on, at every width: on a wide
 * monitor it sits in the gutter beside the centered column, on a phone it is
 * slit down to a slim strip of bars in the same gutter. Nothing to scroll past
 * to find it, and nothing it covers.
 *
 * Every step it takes — a click, a wheel notch or an arrow key — buzzes once
 * through the Vibration API, so moving a section lands as a physical tick on a
 * phone instead of only a scroll. The pattern is deliberately tiny, and
 * `lib/haptics.ts` turns it off entirely for visitors who asked for reduced
 * motion.
 */
export default function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLElement | null>(null);
  const lastStep = useRef(0);

  // Which section is on screen: the last one whose top has passed a third of
  // the way down the viewport. Measured on scroll inside a rAF so a fast wheel
  // cannot queue a layout per event. The rail itself never hides, so this only
  // ever picks the line that stands up.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.34;
      let current = 0;
      sections.forEach((section, index) => {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= line) current = index;
      });
      setActive(current);
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
  }, [sections]);

  const goTo = useCallback(
    (index: number) => {
      const section = sections[index];
      if (!section) return;
      const element = document.getElementById(section.id);
      if (!element) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // The first entry is the hero, which starts at the very top of the page;
      // everything else stops just below the fixed header.
      const top = section.id === "page-title" ? 0 : element.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
      tick(12);
    },
    [sections],
  );

  // Scrolling on the rail steps through the sections. React registers `wheel`
  // at the root as a passive listener, so preventing the page scroll means a
  // real listener of our own.
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastStep.current < WHEEL_COOLDOWN_MS) return;
      lastStep.current = now;
      goTo(Math.min(sections.length - 1, Math.max(0, active + (event.deltaY > 0 ? 1 : -1))));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [active, goTo, sections.length]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      goTo(active + (event.key === "ArrowDown" ? 1 : -1));
    },
    [active, goTo],
  );

  return (
    <nav
      ref={rail}
      className="section-rail"
      aria-label="Page sections"
      onKeyDown={onKeyDown}
    >
      {sections.map((section, index) => {
        const current = index === active;
        return (
          <button
            key={section.id}
            type="button"
            className={`rail-item${current ? " is-active" : ""}`}
            onClick={() => goTo(index)}
            aria-label={section.label}
            aria-current={current ? "true" : undefined}
            title={section.label}
          >
            <span className="rail-label mono" aria-hidden="true">{section.label}</span>
            <span className="rail-bar" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
