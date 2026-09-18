import sites from "@/config/sites.json";

type Site = {
  name: string;
  subdomain: string;
  url: string;
  tags?: string[];
  description?: string;
  show?: boolean;
};

export default function HomePage() {
  const visibleSites = (sites as Site[]).filter((site) => site.show !== false);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="wordmark mono" href="/" aria-label="base31.org home">
            base31.org
          </a>
          <span className="header-meta mono" aria-label={`${visibleSites.length} listed sites`}>
            {String(visibleSites.length).padStart(2, "0")} / sites
          </span>
        </div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow mono">base31.org</p>
          <h1 id="page-title">Directory</h1>
          <p className="subtitle">A collection of things built and deployed here.</p>
        </section>

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
                  <span className="site-arrow mono" aria-hidden="true">
                    ↗
                  </span>
                </div>

                <p className="site-url mono">{site.url.replace(/^https?:\/\//, "")}</p>

                {site.description && <p className="site-description">{site.description}</p>}

                {site.tags && site.tags.length > 0 && (
                  <div className="tags" aria-label="Tags">
                    {site.tags.map((tag) => (
                      <span key={tag} className="tag mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner mono">© {new Date().getFullYear()} base31.org</div>
      </footer>
    </>
  );
}
