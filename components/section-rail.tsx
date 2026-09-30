"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { tick } from "@/lib/haptics";

export type RailSection = { id: string; label: string };

/**
 * The section rail: a slim column of small lines down the right edge of the
 * homepage, one per section, in page order.
 *
 * It is drawn as part of the page rather than as a panel on top of it — no
 * fill, no border, no blur, no shadow — so only the bars themselves sit in the
 * gutter beside the column, against the background. The single exception is the
 * label that opens for the section you are in: it carries a faint wash of the
 * page colour so it stays readable wherever it reaches.
 *
 * Every section is rendered, so the whole page is reachable from the rail
 * itself: when the list is taller than the rail's cap the column scrolls —
 * the wheel and a drag work inside it like any other scroll container — and
 * the line for the section you are reading is kept scrolled into view as you
 * read down the page, so the readout never slides off the end of the column.
 *
 * The line for the current section stands on end and turns green while its
 * label slides out beside it, so the rail is both a position readout and a
 * menu. Clicking a line scrolls the page there, and the arrow keys walk the
 * list one section at a time.
 *
 * It is always there, from the first screen on, at every width: on a wide
 * monitor it sits in the gutter beside the centered column, on a phone it is a
 * slim strip of bars in the same gutter. Nothing to scroll past to find it, and
 * nothing it covers.
 *
 * Every step it takes — a click or an arrow key — buzzes once through the
 * Vibration API, so moving a section lands as a physical tick on a phone
 * instead of only a scroll. `lib/haptics.ts` turns it off entirely for
 * visitors who asked for reduced motion.
 */
export default function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLElement | null>(null);

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

  // Keep the current line inside the rail's own scroll area. The rail can be
  // scrolled by hand to browse ahead, so this only runs when the *page* moves
  // the current section — a manual scroll of the list is left alone.
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const line = node.querySelector<HTMLElement>(".rail-item.is-active");
    if (!line) return;
    const top = line.offsetTop - (node.clientHeight - line.offsetHeight) / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  }, [active]);

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

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      goTo(Math.min(sections.length - 1, Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1))));
      tick(10);
    },
    [active, goTo, sections.length],
  );

  return (
    <nav ref={rail} className="section-rail" aria-label="Page sections" onKeyDown={onKeyDown}>
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
