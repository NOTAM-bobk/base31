import type { MetadataRoute } from "next";
import { directoryEntries } from "@/lib/directory";
import { blogPosts } from "@/lib/blogs";
import { publishedToolSlugs } from "@/lib/tool-pages";
import changelog from "@/config/changelog.json";
import sites from "@/config/sites.json";
import { allTags } from "@/lib/tags";

const siteUrl = "https://base31.org";

type Site = { url: string; show?: boolean };

// This route is regenerated on every deploy straight from config/sites.json
// and lib/blogs.ts, so a new blog post or directory entry lands in
// /sitemap.xml automatically — there is nothing to edit here.
export default function sitemap(): MetadataRoute.Sitemap {
  const listedSites = (sites as Site[]).filter((site) => site.show !== false);
  const newestPost = blogPosts[0]?.date ? new Date(blogPosts[0].date) : undefined;
  // config/changelog.json is newest-first, so entry 0 is the latest release.
  const newestRelease = changelog[0]?.date ? new Date(changelog[0].date) : undefined;

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
      url: `${siteUrl}/our-story`,
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
      url: `${siteUrl}/websites-of-the-week`,
      lastModified: newestPost,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // The hub for the tool guides. Each guide is listed below, and they all
      // interlink through their "More tools" blocks.
      url: `${siteUrl}/tools`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...publishedToolSlugs().map((slug) => ({
      url: `${siteUrl}/tools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      // Sponsorship slots, and the page-level disclosure for the paid cards.
      url: `${siteUrl}/sponsor`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/whats-new`,
      lastModified: newestRelease,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/stats`,
      lastModified: newestPost,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      // The tag index and one page per tag, all derived from the config files.
      url: `${siteUrl}/tags`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...allTags.map((info) => ({
      url: `${siteUrl}/tags/${info.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    {
      // Newest-first additions, straight from the addedAt metadata.
      url: `${siteUrl}/recently-added`,
      lastModified: newestPost,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      // Editorial review dates plus the automated health-check report.
      url: `${siteUrl}/quality-report`,
      changeFrequency: "weekly",
      priority: 0.5,
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
    // The translated homepages ship as static routes, so crawlers can find
    // every language variant directly from the sitemap (hreflang tags cover
    // the variant mapping; these entries make sure each URL is discovered).
    { url: `${siteUrl}/es`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${siteUrl}/fr`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${siteUrl}/pt`, changeFrequency: "weekly" as const, priority: 0.8 },
    ...directoryEntries.map((entry) => ({
      url: `${siteUrl}/sites/${entry.slug}`,
      ...(entry.lastChecked || entry.addedAt ? { lastModified: new Date(entry.lastChecked ?? entry.addedAt!) } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // One URL per listed subdomain site.
    ...listedSites.map((site) => ({
      url: site.url,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
