import Link from "next/link";
import type { Metadata } from "next";
import { blogPosts, readingMinutes } from "@/lib/blogs";

export const metadata: Metadata = {
  title: "base31.org Blog — Cool Sites, Fun Websites, and the Indie Web",
  description:
    "Guides and roundups about cool websites, fun websites, creative web projects, and the independent web — from the team behind the base31.org directory.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/feed.xml", "application/feed+json": "/blog/feed.json" },
  },
  openGraph: {
    type: "website",
    title: "base31.org Blog — Cool Sites and Fun Websites",
    description: "Guides about cool sites, useful tools, and the independent web.",
    url: "https://base31.org/blog",
  },
};

export default function BlogIndexPage() {
  const listData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "base31.org Blog",
    url: "https://base31.org/blog",
    description: "Guides and roundups about cool sites, fun websites, and the independent web.",
    blogPost: blogPosts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      url: `https://base31.org/blog/${post.slug}`,
    })),
  };

  return (
    <main className="privacy-page blog-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listData) }} />
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">the base31 blog</p>
      <h1>Notes on the interesting internet.</h1>
      <p className="privacy-updated">
        Guides, field notes, and practical ideas for finding, building, and sharing better corners of the web.
      </p>
      <p className="blog-subscribe-note">
        New articles cover independent websites, useful tools, static publishing, and the people making the web more personal.
      </p>
      <p className="blog-subscribe mono">
        <span>Follow along</span>
        <a href="/blog/feed.xml">RSS</a>
        <span aria-hidden="true">·</span>
        <a href="/blog/feed.json">JSON feed</a>
      </p>

      <section className="blog-list" aria-label="Blog posts">
        {blogPosts.map((post) => (
          <article key={post.slug} className="blog-card">
            <div className="blog-meta mono">
              <time dateTime={post.date}>{post.date}</time>
              <span className="blog-reading">{readingMinutes(post)} min read</span>
              {post.tags && post.tags.length > 0 && <span className="blog-tags">{post.tags.join(" · ")}</span>}
            </div>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <Link className="blog-read mono" href={`/blog/${post.slug}`}>Read the post →</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
