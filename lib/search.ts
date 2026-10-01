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
