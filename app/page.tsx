import sites from "@/config/sites.json";

type Site = {
  name: string;
  subdomain: string;
  url: string;
  tags?: string[];
  description?: string;
  show?: boolean;
};

const siteUrl = "https://base31.org";
const counterUrl = "https://base31-directory-counter.sawyerbobk563.workers.dev";

export default function HomePage() {
  const visibleSites = (sites as Site[]).filter((site) => site.show !== false);
  const itemList = visibleSites.map((site, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: site.name,
    url: site.url,
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "base31.org",
        description:
          "An independent directory of cool sites, fun websites, creative web projects, and useful online tools.",
        inLanguage: "en-US",
      },
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/#directory`,
        name: "base31.org website directory",
        description: "A list of live sites and web projects on base31.org.",
        numberOfItems: visibleSites.length,
        itemListElement: itemList,
      },
    ],
  };

  const counterScript = `
    fetch(${JSON.stringify(`${counterUrl}/?key=base31-directory`)}, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Counter unavailable")))
      .then((data) => {
        const count = document.getElementById("directory-view-count");
        if (count && Number.isFinite(data.views)) count.textContent = Number(data.views).toLocaleString();
      })
      .catch(() => {});
  `;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="site-header">
        <div className="site-header-inner">
          <a className="wordmark mono" href="/" aria-label="base31.org home">
            base31.org
          </a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#sites">Sites</a>
            <a href="#about">About</a>
          </nav>
          <span className="header-meta mono" aria-label={`${visibleSites.length} listed sites`}>
            {String(visibleSites.length).padStart(2, "0")} / sites
          </span>
        </div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow mono">the independent web directory</p>
          <h1 id="page-title">Cool sites for curious people.</h1>
          <p className="subtitle">
            Discover fun websites, useful online tools, and creative web projects built on
            base31.org and the open web.
          </p>
          <div className="intro-links" aria-label="Explore the directory">
            <a className="text-link" href="#sites">Browse all sites <span aria-hidden="true">↓</span></a>
            <a className="text-link muted-link" href="#about">Why base31? <span aria-hidden="true">→</span></a>
          </div>
        </section>

        <section id="sites" className="directory-section" aria-labelledby="sites-heading">
          <div className="section-heading">
            <h2 id="sites-heading">Featured sites</h2>
            <span className="section-count mono">{visibleSites.length} live</span>
          </div>

          {visibleSites.length === 0 ? (
            <div className="empty">No sites deployed yet.</div>
          ) : (
            <div className="site-list" aria-label="Deployed sites">
              {visibleSites.map((site) => (
                <a
                  key={site.subdomain}
                  href={site.url}
                  className="site-card"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="site-card-top">
                    <div className="site-name-row">
                      <span className="live-dot" aria-hidden="true" />
                      <span className="site-name">{site.name}</span>
                    </div>
                    <span className="site-arrow mono" aria-hidden="true">↗</span>
                  </div>
                  <p className="site-url mono">{site.url.replace(/^https?:\/\//, "")}</p>
                  {site.description && <p className="site-description">{site.description}</p>}
                  {site.tags && site.tags.length > 0 && (
                    <div className="tags" aria-label="Tags">
                      {site.tags.map((tag) => <span key={tag} className="tag mono">{tag}</span>)}
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>

        <section id="about" className="about-section" aria-labelledby="about-heading">
          <p className="eyebrow mono">about the directory</p>
          <h2 id="about-heading">A small home for the interesting internet.</h2>
          <p>
            base31.org is an independent collection of personal sites, experiments, tools, and
            other projects worth exploring. It is a hand-built alternative to noisy app lists:
            every link leads to a real project with something to see or use.
          </p>
          <p>
            Looking for Base44? base31 is a separate, independent project and is not affiliated
            with Base44. Start here for a different kind of website directory: slower, stranger,
            and made for curious people.
          </p>
          <div className="topic-links" aria-label="Directory topics">
            <a href="#sites">Cool sites</a>
            <a href="#sites">Fun websites</a>
            <a href="#sites">Creative web projects</a>
            <a href="#sites">Useful online tools</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner mono">
          <span>© {new Date().getFullYear()} base31.org</span>
          <a href="#page-title">Back to top ↑</a>
        </div>
      </footer>

      <div className="view-counter mono" aria-live="polite" aria-label="Directory page views">
        <span>views</span>
        <strong id="directory-view-count">—</strong>
      </div>
      <script dangerouslySetInnerHTML={{ __html: counterScript }} />
    </>
  );
}
