import Link from "next/link";
import { notFound } from "next/navigation";
import sitesConfig from "@/config/sites.json";
import { getToolPage, publishedToolSlugs, relatedToolSlugs, toolPages } from "@/lib/tool-pages";

const siteUrl = "https://base31.org";

type SiteEntry = { name: string; subdomain: string; url: string; description: string; tags?: string[]; show?: boolean };
const sites = sitesConfig as SiteEntry[];
const siteFor = (slug: string) => sites.find((site) => site.subdomain === slug);

type Params = { params: { slug: string } };

// Every published tool gets a page at build time, so these are static HTML
// rather than a server render per visit.
export function generateStaticParams() {
  return publishedToolSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Params) {
  const page = getToolPage(params.slug);
  const site = siteFor(params.slug);
  if (!page || !site) return {};
  const url = `${siteUrl}/tools/${site.subdomain}`;
  return {
    // Keyword-first, the same rule the subdomain pages follow.
    title: `${page.headline} | base31.org`,
    description: page.metaDescription,
    alternates: { canonical: `/tools/${site.subdomain}` },
    // Setting openGraph replaces the layout's object rather than merging it, so
    // it repeats siteName, locale and a page-accurate url.
    openGraph: {
      type: "website",
      url,
      siteName: "base31.org",
      locale: "en_US",
      title: `${page.headline} | base31.org`,
      description: page.metaDescription,
    },
    twitter: { card: "summary_large_image", title: `${site.name} — base31.org`, description: page.metaDescription },
  };
}

export default function ToolPageRoute({ params }: Params) {
  const page = getToolPage(params.slug);
  const site = siteFor(params.slug);
  if (!page || !site || site.show === false) notFound();

  const slug = site.subdomain;
  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const related = relatedToolSlugs(slug)
    .map((key) => ({ key, page: toolPages[key], site: siteFor(key) }))
    .filter((entry) => entry.page && entry.site && entry.site.show !== false);

  // One @graph per page. The site-wide Organization and WebSite nodes live in
  // components/structured-data.tsx and are referenced by id here rather than
  // repeated, so no node is ever published twice.
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/tools/${slug}#page`,
        url: `${siteUrl}/tools/${slug}`,
        name: `${page.headline} | base31.org`,
        description: page.metaDescription,
        inLanguage: "en-US",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/tools/${slug}#app` },
        breadcrumb: { "@id": `${siteUrl}/tools/${slug}#breadcrumb` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/tools/${slug}#app`,
        name: site.name,
        url: site.url,
        description: site.description,
        applicationCategory: "WebApplication",
        operatingSystem: "Any browser",
        isPartOf: { "@id": `${siteUrl}/#website` },
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: page.features.map((feature) => feature.title),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/tools/${slug}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "base31.org", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${siteUrl}/tools` },
          { "@type": "ListItem", position: 3, name: site.name, item: `${siteUrl}/tools/${slug}` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/tools/${slug}#faq`,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <main className="tool-page">
      <nav className="breadcrumb mono" aria-label="Breadcrumb">
        <Link href="/">base31.org</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tools">Tools</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{site.name}</span>
      </nav>

      <p className="eyebrow mono">{site.tags?.length ? `${site.tags[0]} tool` : "tool"}</p>
      <h1>{page.headline}</h1>
      <p className="tool-summary">{page.summary}</p>

      {/* The one thing a visitor came here to do: open the tool. Everything
          else on the page is context for that. */}
      <a className="tool-cta" href={site.url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tool-cta-icon" src={`/site-icons/${slug}.svg`} alt="" width={26} height={26} />
        <span className="tool-cta-label">Open {site.name}</span>
        <span className="tool-cta-host mono">{host}</span>
        <span className="tool-cta-arrow mono" aria-hidden="true">↗</span>
      </a>

      <section className="tool-copy" aria-label="Overview">
        {page.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
      </section>

      <section className="tool-block" aria-labelledby="tool-features-heading">
        <h2 id="tool-features-heading">What it does</h2>
        <ul className="tool-features">
          {page.features.map((feature) => (
            <li key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="tool-block" aria-labelledby="tool-steps-heading">
        <h2 id="tool-steps-heading">How to use {site.name}</h2>
        <ol className="tool-steps">
          {page.steps.map((step) => (
            <li key={step.slice(0, 40)}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="tool-block" aria-labelledby="tool-faq-heading">
        <h2 id="tool-faq-heading">Questions about {site.name}</h2>
        {/* Native disclosures, so the answers are in the served HTML and the
            list works with no JavaScript — same pattern as components/faq.tsx. */}
        <ul className="tool-faqs">
          {page.faqs.map((faq) => (
            <li key={faq.question}>
              <details>
                <summary>
                  <span>{faq.question}</span>
                  <span className="tool-faq-chevron mono" aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section className="tool-block" aria-labelledby="tool-related-heading">
          <h2 id="tool-related-heading">More tools in the directory</h2>
          <ul className="tool-related">
            {related.map((entry) => (
              <li key={entry.key}>
                <Link href={`/tools/${entry.key}`}>
                  <span className="tool-related-name">{entry.site!.name}</span>
                  <span className="tool-related-summary">{entry.page!.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="stats-foot">
        Every tool here is free and needs no account. See the{" "}
        <Link href="/tools">full tools index</Link>, or{" "}
        <Link href="/stats">how many people are using them</Link>.
      </p>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
    </main>
  );
}
