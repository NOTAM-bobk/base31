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
    <main>
      <h1>base31.org</h1>
      <p className="subtitle">A directory of everything running on this domain.</p>

      {visibleSites.length === 0 && (
        <p className="empty">No sites published yet — check back soon.</p>
      )}

      {visibleSites.map((site) => (
        <a key={site.subdomain} href={site.url} className="site-card">
          <div className="site-name">{site.name}</div>
          <div className="site-url">{site.url}</div>
          {site.description && (
            <p className="site-description">{site.description}</p>
          )}
          {site.tags && site.tags.length > 0 && (
            <div className="tags">
              {site.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </a>
      ))}
    </main>
  );
}
