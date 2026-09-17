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
          <span className="wordmark mono">base31.org</span>
          <span className="header-meta mono">
            {visibleSites.length} site{visibleSites.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <main>
        <h1>Directory</h1>
        <p className="subtitle">Everything currently deployed on this domain.</p>

        {visibleSites.length === 0 ? (
          <div className="empty">No sites deployed yet.</div>
        ) : (
          <div className="site-list">
            {visibleSites.map((site) => (
              <a key={site.subdomain} href={site.url} className="site-card">
                <div className="site-card-top">
                  <div className="site-name-row">
                    <span className="live-dot" aria-hidden="true" />
                    <span className="site-name">{site.name}</span>
                  </div>
                  <span className="site-arrow mono" aria-hidden="true">
                    →
                  </span>
                </div>

                <p className="site-url mono">
                  {site.url.replace(/^https?:\/\//, "")}
                </p>

                {site.description && (
                  <p className="site-description">{site.description}</p>
                )}

                {site.tags && site.tags.length > 0 && (
                  <div className="tags">
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
    </>
  );
}
