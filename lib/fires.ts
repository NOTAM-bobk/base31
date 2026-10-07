// The visitor's own side of the fire button: when *they* last fired each site.
//
// The Worker decides what a fire is worth and when it stops counting — it holds
// the timestamps and drops the expired ones itself. This file answers the other
// half of the rule, the one only the visitor's browser can know: has this
// person already fired this site today? One fire per visitor per site per 24
// hours, kept next to the votes in localStorage so the button is still disabled
// for them on their next visit, and never merged into the shared totals.
//
// Nothing here is authoritative and nothing here needs to be: a visitor who
// clears their storage can fire again, which costs the directory a second boost
// and nothing else. The Worker's own expiry is what keeps the ranking honest.
//
// Browser-only on purpose. `lib/vote-ranking.ts` holds the one number the
// Worker and the page must agree on (`FIRE_VOTE_WEIGHT`) precisely so this file
// can touch `localStorage` and the Worker never has to import it.

/** A fire stops counting, and stops blocking the button, after this long. */
export const FIRE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Matches `base31-votes`: one flat map of key → when this visitor fired it. */
export const FIRE_STORAGE_KEY = "base31-fires";

export type FireStamps = Record<string, number>;

/**
 * The visitor's fire timestamps, with anything older than the window dropped.
 *
 * Reading and pruning in one step means a stale entry can never make a button
 * that should be live look disabled: the map that comes back only ever holds
 * fires that are still running.
 */
export function readFireStamps(now: number = Date.now()): FireStamps {
  try {
    const saved = JSON.parse(localStorage.getItem(FIRE_STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(
        ([, value]) => typeof value === "number" && Number.isFinite(value) && now - value < FIRE_WINDOW_MS,
      ),
    ) as FireStamps;
  } catch {
    return {};
  }
}

/** Is this visitor's fire on `key` still inside its 24 hours? */
export function isFireActive(stamps: FireStamps, key: string, now: number = Date.now()): boolean {
  const stamp = stamps[key];
  return typeof stamp === "number" && Number.isFinite(stamp) && now - stamp < FIRE_WINDOW_MS;
}

/**
 * Records a fire and hands the new map back, so a caller can set state from the
 * same object that was written rather than re-reading storage.
 */
export function stampFire(key: string, now: number = Date.now()): FireStamps {
  const next = { ...readFireStamps(now), [key]: now };
  try {
    localStorage.setItem(FIRE_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** How long until this visitor may fire `key` again, in hours (0 when it is live). */
export function fireHoursLeft(stamps: FireStamps, key: string, now: number = Date.now()): number {
  if (!isFireActive(stamps, key, now)) return 0;
  return Math.max(1, Math.ceil((FIRE_WINDOW_MS - (now - stamps[key])) / (60 * 60 * 1000)));
}
