// Every tag used anywhere in the directory, in one place.
//
// The homepage filter chips only show the handful of most-used tags, and the
// tool guide hub only knows about config/sites.json. Neither is an index: this
// module is what /tags and /tags/<tag> are built from, so a tag that appears on
// a single cool API still gets a page of its own with that API on it.
//
// Tag *names* keep the directory's own spelling ("no-key", "WebGL") because
// that is what people see on the cards; the URL uses a slug, so a tag with a
// space or punctuation still gets one stable, lowercase slugify()d address.

import { directoryEntries } from "@/lib/directory";

export type TagInfo = {
  /** The tag exactly as it is written in the config, e.g. "no-key". */
  tag: string;
  /** Lowercase, hyphenated address segment, e.g. "no-key". */
  slug: string;
  /** How many directory entries carry the tag. */
  count: number;
};

export type TagGroup = { letter: string; tags: TagInfo[] };

/** The same rule the detail-page slugs use, so tag URLs look like the rest. */
export const tagSlug = (tag: string) =>
  tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const counts = new Map<string, number>();
for (const entry of directoryEntries) {
  // A tag repeated on one entry still counts once for that entry.
  for (const tag of new Set((entry.tags ?? []).map((value) => value.trim()).filter(Boolean))) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
}

/** Every tag, most used first, then alphabetically — the order /tags prints. */
export const allTags: TagInfo[] = [...counts.entries()]
  .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
  .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

const bySlug = new Map(allTags.map((info) => [info.slug, info]));

/** The tag behind a /tags/<slug> URL, or undefined for a slug we do not have. */
export const tagBySlug = (slug: string): TagInfo | undefined => bySlug.get(slug);

/** The entries carrying a tag, named the way the directory names them. */
export const entriesForTag = (tag: string) =>
  directoryEntries.filter((entry) => (entry.tags ?? []).includes(tag));

/** /tags prints the index alphabetically in letter groups, whatever the order. */
export const tagGroups: TagGroup[] = [...allTags]
  .sort((a, b) => a.tag.localeCompare(b.tag))
  .reduce<TagGroup[]>((groups, info) => {
    const letter = info.tag[0].toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.letter === letter) last.tags.push(info);
    else groups.push({ letter, tags: [info] });
    return groups;
  }, []);

export const tagCount = allTags.length;
export const taggedEntryCount = new Set(directoryEntries.filter((entry) => (entry.tags ?? []).length > 0).map((entry) => entry.slug)).size;