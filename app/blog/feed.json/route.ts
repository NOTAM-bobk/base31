import { blogPosts } from "@/lib/blogs";

const siteUrl = "https://base31.org";

// The JSON Feed twin of /blog/feed.xml, for readers that prefer it.
export const dynamic = "force-static";

export function GET() {
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "base31.org blog",
    home_page_url: `${siteUrl}/blog`,
    feed_url: `${siteUrl}/blog/feed.json`,
    description: "Guides and notes about cool sites, fun websites, and the independent web.",
    language: "en-US",
    items: blogPosts.map((post) => ({
      id: `${siteUrl}/blog/${post.slug}`,
      url: `${siteUrl}/blog/${post.slug}`,
      title: post.title,
      summary: post.description,
      date_published: new Date(post.date).toISOString(),
      tags: post.tags ?? [],
    })),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
