// Haptics in one place, via the Vibration API.
//
// One helper instead of a guard copied into every component: a device without
// a vibration motor (and every desktop browser) simply does nothing, and a
// visitor who asked for reduced motion gets no buzz at all — the same rule the
// wobble animations follow, so the page never moves or shakes against their
// stated preference. Calling this is always safe: it never throws.

/** A short buzz on the devices that have one, silence everywhere else. */
export function tick(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers expose the method but refuse the call; nothing to do.
  }
}

export default tick;
