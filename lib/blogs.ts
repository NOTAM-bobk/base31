import postsConfig from "@/config/blogs.json";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-09-22". */
  date: string;
  tags?: string[];
  /** Paragraphs of plain text. "## " starts a heading, "- " starts a list item. */
  body: string[];
};

export type BlogBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

/** Newest first. Add posts to `config/blogs.json` — no code changes needed. */
export const blogPosts: BlogPost[] = (postsConfig as BlogPost[])
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const getBlogPost = (slug: string): BlogPost | undefined =>
  blogPosts.find((post) => post.slug === slug);

/**
 * Turns the flat paragraph list into renderable blocks so a post can use
 * headings and bullet lists without pulling in a Markdown dependency.
 */
export const toBlocks = (body: string[]): BlogBlock[] => {
  const blocks: BlogBlock[] = [];
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
      continue;
    }
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.items.push(line.slice(2));
      else blocks.push({ type: "ul", items: [line.slice(2)] });
      continue;
    }
    blocks.push({ type: "p", text: line });
  }
  return blocks;
};
