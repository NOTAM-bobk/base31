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

// Editorial posts live in code so longer, curated articles can be reviewed in
// pull requests. The original JSON posts remain supported for quick additions.
const editorialPosts: BlogPost[] = [
  {
    slug: "how-to-find-interesting-websites",
    title: "How to Find Interesting Websites on the Open Web",
    description: "A practical guide to finding thoughtful personal sites, useful tools, and strange little corners of the internet.",
    date: "2026-09-20",
    tags: ["discovery", "indie web", "websites"],
    body: [
      "The best parts of the web are often small, personal, and easy to miss. They may not have a marketing budget or a place on a trending page, but they reward curiosity.",
      "## Start with people, not platforms",
      "Follow creators who publish their own websites, link to the sources behind their work, and keep a list of places they return to. Personal link pages and web rings are often better guides than algorithmic feeds.",
      "## Look for useful constraints",
      "A site that does one thing well is usually more memorable than a service trying to become an entire platform. Search for focused tools, small games, public experiments, and projects with a clear point of view.",
      "## Keep your own trail",
      "Save the sites you enjoy and share them with friends. A directory such as base31.org is useful because it turns those one-off discoveries into a browsable trail for the next curious person.",
    ],
  },
  {
    slug: "why-small-web-projects-matter",
    title: "Why Small Web Projects Matter",
    description: "Small websites make the internet more personal, experimental, and useful — one focused idea at a time.",
    date: "2026-09-18",
    tags: ["indie web", "design", "projects"],
    body: [
      "The web does not need every project to become a startup. Some of its most valuable work comes from people building a tool, experiment, or collection simply because they wanted it to exist.",
      "## Small means focused",
      "A small project can make a clear promise: check a site, play a game, learn a word, or explore an idea. That focus makes the experience easier to understand and easier to improve.",
      "## Experiments create culture",
      "Unusual interfaces and personal publishing give the web its character. They make room for playful ideas that would be filtered out by a generic product roadmap.",
      "## Build for a real person",
      "Whether you are publishing a static site or a tiny utility, start with a real use case. Make the first interaction obvious, keep the page fast, and give visitors a reason to come back.",
    ],
  },
  {
    slug: "how-to-publish-a-static-website",
    title: "How to Publish a Static Website",
    description: "A beginner-friendly path from an index.html file to a fast, shareable website on the open web.",
    date: "2026-09-15",
    tags: ["web development", "static sites", "beginners"],
    body: [
      "A static website can be as simple as one HTML file. You do not need a database or a complicated framework to publish something useful on the web.",
      "## Start with three files",
      "Create an index.html file, a style.css file, and a script.js file only if you need interaction. Keep the first version small enough that you understand every part of it.",
      "## Make it usable everywhere",
      "Use semantic HTML, readable contrast, keyboard-friendly controls, and a responsive layout. Test on a phone before adding more features.",
      "## Deploy and iterate",
      "Put the files in a Git repository and connect it to a static host. Once the site is live, improve it based on what real visitors need rather than adding complexity for its own sake.",
    ],
  },
];

/** Newest first. Add posts to config/blogs.json or editorialPosts. */
export const blogPosts: BlogPost[] = [...(postsConfig as BlogPost[]), ...editorialPosts]
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const getBlogPost = (slug: string): BlogPost | undefined =>
  blogPosts.find((post) => post.slug === slug);

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
