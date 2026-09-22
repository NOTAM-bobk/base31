export default function Loading() {
  return (
    <main className="page-state" aria-busy="true" aria-label="Loading base31.org">
      <div className="page-state-mark mono" aria-hidden="true">31</div>
      <p className="eyebrow mono">base31.org</p>
      <h1>Loading the directory…</h1>
      <div className="page-state-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
