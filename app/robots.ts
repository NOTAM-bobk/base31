import type { MetadataRoute } from "next";

// Crawlers the site welcomes. Naming them explicitly does two things: search
// engines and answer engines get a clear "yes, read the directory" instead of
// having to infer it from `*`, and the site's stance is on the record for the
// AI crawlers that check for their own user-agent before fetching anything.
//
// Every one of these is allowed to read the whole site — that is the point of a
// public directory — except the moderation surfaces and the JSON endpoints
// behind them, which are closed to crawlers too.
const AI_AGENTS = [
  "GPTBot", // OpenAI, training
  "OAI-SearchBot", // the ChatGPT search index
  "ChatGPT-User", // a person asking ChatGPT to open one of our pages
  "ClaudeBot", // Anthropic
  "Claude-User", // a person asking Claude to open a page
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot", // Perplexity's own index
  "Perplexity-User",
  "Google-Extended", // Gemini grounding and Vertex AI
  "Applebot",
  "Applebot-Extended",
  "Bingbot", // Bing feeds Copilot's answers
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent", // Meta's AI systems
  "cohere-ai",
  "MistralAI-User",
  "YouBot",
];

const CLOSED = ["/admin", "/admin/community-sites", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything public is open to everyone, with the moderation panel and
      // the API routes kept out of the index.
      { userAgent: "*", allow: "/", disallow: CLOSED },
      // AI and answer-engine crawlers get the same access, spelled out per
      // user-agent so nothing has to be guessed from the wildcard.
      { userAgent: AI_AGENTS, allow: "/", disallow: ["/admin", "/admin/community-sites", "/api/"] },
    ],
    sitemap: "https://base31.org/sitemap.xml",
    host: "https://base31.org",
  };
}
