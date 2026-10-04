// "Recently added" is derived, never hand-maintained.
//
// Every directory entry carries an optional `addedAt` day (see
// config/sites.json and the cool-* lists); a community upload carries a
// `createdAt` timestamp instead. This module turns those two into one list, so
// /recently-added is whatever the metadata says it is — adding a site with an
// `addedAt` date is all it takes to put it on the page.
//
// An entry with neither field is deliberately left out rather than guessed at:
// the curated entries that predate the field have no honest date to show, and a
// made-up one would be worse than an absent row.

import { directoryEntries, type DirectoryEntry } from "@/lib/directory";

/** ISO day for an entry: `addedAt` if it has one, else the day it was created. */
export const addedDay = (entry: DirectoryEntry): string | undefined =>
  entry.addedAt ?? (entry.createdAt ? new Date(entry.createdAt).toISOString().slice(0, 10) : undefined);

/** Milliseconds since the epoch, for sorting. Undefined when undated. */
export const addedTime = (entry: DirectoryEntry): number | undefined => {
  if (entry.createdAt) return entry.createdAt;
  const day = addedDay(entry);
  return day ? Date.parse(day) : undefined;
};

/** Every dated entry, newest first, then by name so the order is stable. */
export const recentlyAdded: DirectoryEntry[] = directoryEntries
  .filter((entry) => addedTime(entry) !== undefined)
  .sort((a, b) => (addedTime(b) ?? 0) - (addedTime(a) ?? 0) || a.name.localeCompare(b.name));

/** The newest `limit` picks, for the small blocks on other pages. */
export const recentlyAddedTop = (limit: number) => recentlyAdded.slice(0, limit);

/** The newest additions inside a window of days, counted for the page lede. */
export const addedWithinDays = (days: number): DirectoryEntry[] => {
  const cutoff = Date.now() - days * 86400000;
  return recentlyAdded.filter((entry) => (addedTime(entry) ?? 0) >= cutoff);
};

/** "2026-10-03" → "October 2026", the heading each month group prints. */
export const monthLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));