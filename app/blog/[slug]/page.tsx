import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts, getBlogPost, otherPosts, readingMinutes, toBlocks } from "@/lib/blogs";

const siteUrl = "https://base31.org";

// Fully static: every post in config/blogs.json is pre-rendered at build time.
export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return { title: "Post not found — base31.org" };
  return {
    title: `${post.title} — base31.org`,
    description: post.description,
    keywords: post.tags,
    alternates: {
      canonical: `/blog/${post.slug}`,
      types: { "application/rss+xml": "/blog/feed.xml", "application/feed+json": "/blog/feed.json" },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${siteUrl}/blog/${post.slug}`,
      siteName: "base31.org",
      locale: "en_US",
      publishedTime: post.date,
      tags: post.tags,
    },
    // The post has its own 1200x630 opengraph-image, so "summary" would crop it
    // to a small square — large image is the correct card here.
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: `${siteUrl}/blog/${post.slug}`,
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    keywords: post.tags?.join(", "),
    author: { "@type": "Organization", name: "base31.org", url: siteUrl },
    publisher: { "@type": "Organization", name: "base31.org", url: siteUrl },
  };

  return (
    <main className="privacy-page blog-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link className="privacy-back mono" href="/blog">← All posts</Link>
      <p className="eyebrow mono">{post.tags?.[0] || "base31 blog"}</p>
      <h1>{post.title}</h1>
      <p className="privacy-updated">
        <time dateTime={post.date}>{post.date}</time> · {readingMinutes(post)} min read · base31.org
      </p>

      <article className="privacy-copy blog-article">
        {toBlocks(post.body).map((block, index) => {
          if (block.type === "h2") return <h2 key={index}>{block.text}</h2>;
          if (block.type === "ul")
            return (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          return <p key={index}>{block.text}</p>;
        })}
      </article>

      <section className="blog-next" aria-labelledby="read-next">
        <p className="eyebrow mono" id="read-next">read next</p>
        <div className="blog-next-grid">
          {otherPosts(post.slug, 3).map((next) => (
            <Link key={next.slug} className="blog-next-card" href={`/blog/${next.slug}`}>
              <span className="blog-next-title">{next.title}</span>
              <span className="blog-next-meta mono">
                {next.date} · {readingMinutes(next)} min read
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="blog-footer">
        <Link className="blog-read mono" href="/#sites">Browse the directory →</Link>
        <Link className="blog-read mono" href="/blog">More posts →</Link>
        <Link className="blog-read mono" href="/blog/feed.xml">RSS →</Link>
      </div>
    </main>
  );
}
