export default function Loading() {
  return (
    <main className="page-state" aria-busy="true" aria-label="Loading base31.org">
      <div className="page-state-mark mono" aria-hidden="true">31</div>
      <p className="eyebrow mono">base31.org</p>
      <h1>Loading the directory…</h1>
      <section className="loading-preview" aria-hidden="true">
        <div className="loading-preview-bar" />
        <div className="loading-preview-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <article className="loading-card" key={index}>
              <div className="loading-card-image" />
              <div className="loading-card-copy">
                <span className="loading-card-title" />
                <span className="loading-card-line" />
                <span className="loading-card-line loading-card-line-short" />
                <div className="loading-card-tags"><span /><span /><span /></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
