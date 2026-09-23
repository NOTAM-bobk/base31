import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blogs";
import sites from "@/config/sites.json";

const siteUrl = "https://base31.org";

type Site = { url: string; show?: boolean };

// This route is regenerated on every deploy straight from config/sites.json
// and lib/blogs.ts, so a new blog post or directory entry lands in
// /sitemap.xml automatically — there is nothing to edit here.
export default function sitemap(): MetadataRoute.Sitemap {
  const listedSites = (sites as Site[]).filter((site) => site.show !== false);
  const newestPost = blogPosts[0]?.date ? new Date(blogPosts[0].date) : undefined;

  return [
    {
      url: siteUrl,
      lastModified: newestPost,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: newestPost,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...blogPosts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // One URL per listed subdomain site.
    ...listedSites.map((site) => ({
      url: site.url,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
