"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Keeps keyboard focus inside an open dialog, moves it in on open, and hands it
 * back to whatever opened the dialog on close.
 *
 * It is shared by the homepage's modals (share sheet, milestone, upload form,
 * exit nudge) and by `components/nav-drawer.tsx`, the mobile navigation panel:
 * anything that covers the page and behaves like a dialog needs the same trap,
 * the same `Tab` wrap, and the same focus restore, or a keyboard visitor ends
 * up tabbing through the page behind it.
 *
 * Call it inside the component that owns the dialog. Whatever focusable
 * element comes first in the container's DOM order receives focus, so put the
 * control you actually want focused first — or focus your own element from an
 * effect declared *after* this hook, which runs after this one.
 */
export function useDialogFocus<T extends HTMLElement>(open: boolean, containerRef: RefObject<T>) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;
    const selector = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((element) => element.offsetParent !== null);

    (focusable()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // A stray click outside the trap should not strand focus behind it.
    const onFocusIn = (event: FocusEvent) => {
      if (!container.contains(event.target as Node)) (focusable()[0] ?? container).focus();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      previous?.focus?.();
    };
  }, [open, containerRef]);
}
