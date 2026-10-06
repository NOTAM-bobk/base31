type Searchable = { name: string; url: string; description?: string; tags?: string[]; category?: string; subdomain?: string };

/** Plain words search all fields; #tag and tag:value match an exact tag. */
export function matchesQuery(item: Searchable, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${item.name} ${item.url} ${item.description ?? ""} ${item.category ?? ""} ${item.subdomain ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
  return terms.every((term) => {
    const tag = term.startsWith("#") ? term.slice(1) : term.startsWith("tag:") ? term.slice(4) : null;
    return tag !== null ? tag.length > 0 && tags.includes(tag) : text.includes(term);
  });
}

/**
 * How well one item answers a query, for ordering search results.
 *
 * `matchesQuery` only answers yes or no, which is all a filter needs; the
 * "Best matches" list needs an order. The scale is deliberately blunt and
 * explainable: a term that names the item beats one that merely tags it, and a
 * term in the description beats nothing at all. An item that does not match is
 * 0, so a zero score means "not a result" rather than "a weak one".
 */
export function searchScore(item: Searchable, query: string): number {
  if (!matchesQuery(item, query)) return 0;
  const name = item.name.toLowerCase();
  const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
  const rest = `${item.description ?? ""} ${item.url} ${item.category ?? ""} ${item.subdomain ?? ""}`.toLowerCase();
  let score = 0;
  for (const term of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const tag = term.startsWith("#") ? term.slice(1) : term.startsWith("tag:") ? term.slice(4) : null;
    if (tag !== null) {
      // An exact tag is a deliberate request, so it outranks a loose word.
      if (tags.includes(tag)) score += 30;
      continue;
    }
    if (name === term) score += 60;
    else if (name.startsWith(term)) score += 40;
    else if (name.includes(term)) score += 26;
    else if (tags.some((value) => value.includes(term))) score += 14;
    else if (rest.includes(term)) score += 6;
  }
  return score;
}
