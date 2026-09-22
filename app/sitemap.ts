import sites from "@/config/sites.json";
import { blogPosts } from "@/lib/blogs";
import type { MetadataRoute } from "next";

type Site = { url: string; show?: boolean };

export default function sitemap(): MetadataRoute.Sitemap {
  const visibleSites = (sites as Site[]).filter((site) => site.show !== false);

  return [
    { url: "https://base31.org/", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://base31.org/about", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: "https://base31.org/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://base31.org/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://base31.org/blog", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    ...blogPosts.map((post) => ({
      url: `https://base31.org/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...visibleSites.map((site) => ({ url: site.url, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
