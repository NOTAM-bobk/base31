import coolSites from "@/lib/cool-sites";

// The "Other cool sites" strip under the Featured sites directory. These are
// hand-picked sites that live at their own addresses — not base31 subdomains
// — edited purely through config/cool-sites.json. The cards are deliberately
// smaller and quieter than the directory's cards: an external pointer, not a
// full listing, and every one opens in a new tab.
export default function CoolSites() {
  return (
    <section className="cool-section directory-section" data-reveal aria-labelledby="cool-heading">
      <div className="section-heading">
        <h2 id="cool-heading" className="section-heading-main">Other cool sites</h2>
        <span className="section-count mono">{coolSites.length} links</span>
      </div>
      <p className="cool-lede">
        Hand-picked corners of the web that live at their own addresses — not made by base31, just worth the trip.
      </p>
      <div className="cool-grid" role="list">
        {coolSites.map((site) => (
          <a
            key={site.url}
            href={site.url}
            className="cool-card"
            role="listitem"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="cool-card-top">
              <span className="cool-favicon" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny
                    16px favicons, sized explicitly, no optimization needed */}
                <img src={`https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`} alt="" width={16} height={16} loading="lazy" />
              </span>
              <span className="cool-name">{site.name}</span>
              <span className="cool-arrow mono" aria-hidden="true">↗</span>
            </span>
            <span className="cool-host mono">{new URL(site.url).hostname.replace(/^www\./, "")}</span>
            <span className="cool-desc">{site.description}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
