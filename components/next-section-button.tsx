"use client";

import { useCallback, useEffect, useState } from "react";
import type { RailSection } from "@/components/section-rail";
import { tick } from "@/lib/haptics";

/**
 * A small circular button fixed to the bottom-right corner that, on click,
 * smooth-scrolls the page to the next section. It appears once the visitor has
 * scrolled past the top and disappears when the visitor is at or past the last
 * section — so it is only there when there is somewhere to go.
 */
export default function NextSectionButton({ sections }: { sections: RailSection[] }) {
  const [visible, setVisible] = useState(false);
  const [nextIndex, setNextIndex] = useState(1);

  useEffect(() => {
    if (sections.length < 2) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.34;
      let current = 0;
      sections.forEach((section, index) => {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) current = index;
      });
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
      setNextIndex(Math.min(sections.length - 1, current + 1));
      setVisible(current < sections.length - 1 && !atBottom && window.scrollY > 80);
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

  const goToNext = useCallback(() => {
    const section = sections[nextIndex];
    if (!section) return;
    const el = document.getElementById(section.id);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = section.id === "page-title" ? 0 : el.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    tick(12);
  }, [sections, nextIndex]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="next-section-button"
      onClick={goToNext}
      aria-label={`Go to ${sections[nextIndex]?.label ?? "next section"}`}
      title={`Next: ${sections[nextIndex]?.label ?? ""}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    </button>
  );
}
