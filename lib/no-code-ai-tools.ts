import noCodeAi from "@/config/no-code-ai.json";
import { matchesQuery } from "@/lib/search";

// The "No-Code AI tools" strip: services that build apps, sites, portals or
// automations from a description, so someone with an idea but no code can ship
// something. The list is edited purely through config/no-code-ai.json — this
// module adds the types, the category chips and the search helper the strip and
// the hero search share.
export type NoCodeAiTool = {
  name: string;
  url: string;
  tags: string[];
  description: string;
  /** The strip's filter chip: what the tool is for, coarser than `tags`. */
  category: string;
  addedAt?: string;
  lastChecked?: string;
};

export const allNoCodeAiTools = noCodeAi as NoCodeAiTool[];

/** The filter chips for the strip, busiest category first (then alphabetical,
    so the order is stable between builds). */
export const noCodeAiToolCategories: string[] = (() => {
  const counts = new Map<string, number>();
  for (const tool of allNoCodeAiTools) counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
})();

/** The no-code AI tools matching a hero-search query (all of them when empty). */
export const searchNoCodeAiTools = (query: string): NoCodeAiTool[] => {
  return allNoCodeAiTools.filter((tool) => matchesQuery(tool, query));
};

export default allNoCodeAiTools;
