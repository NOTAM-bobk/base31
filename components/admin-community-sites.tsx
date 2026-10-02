"use client";

import { useCallback, useState } from "react";

const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

type AdminSite = {
  slug: string;
  title: string;
  description: string;
  url: string;
  active: boolean;
  createdAt: number;
  lastCheckedAt: number | null;
  healthFailures: number;
};

export default function AdminCommunitySites() {
  const [token, setToken] = useState("");
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSites = useCallback(async () => {
    if (!token.trim()) {
      setStatus("Enter the Worker COUNTER_SECRET to continue.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`${workerUrl}/admin/sites`, { headers: { Authorization: `Bearer ${token.trim()}` } });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not load community sites.");
      setSites(Array.isArray(data?.sites) ? data.sites : []);
      setStatus("Community sites loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load community sites.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const removeSite = async (site: AdminSite) => {
    if (!window.confirm(`Remove ${site.title} (${site.slug})? This deletes its hosted files from the Worker.`)) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`${workerUrl}/admin/sites/${encodeURIComponent(site.slug)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not remove that site.");
      setSites((current) => current.filter((entry) => entry.slug !== site.slug));
      setStatus(`${site.title} was removed.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove that site.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <a className="privacy-back mono" href="/">← base31.org</a>
      <p className="eyebrow mono">moderation</p>
      <h1>Community sites</h1>
      <p className="admin-lede">Review published community uploads, see the latest health-check state, and remove a site from the public directory.</p>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void loadSites(); }}>
        <label htmlFor="admin-token">Worker admin token</label>
        <input id="admin-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="COUNTER_SECRET" />
        <button type="submit" disabled={busy}>{busy ? "Loading…" : "Load sites"}</button>
      </form>
      {status && <p className="admin-status" role="status">{status}</p>}
      <section className="admin-list" aria-live="polite">
        {sites.length === 0 && <p className="admin-empty">No community sites loaded.</p>}
        {sites.map((site) => (
          <article className={`admin-site${site.active ? "" : " is-inactive"}`} key={site.slug}>
            <div>
              <h2>{site.title}</h2>
              <p className="mono">/s/{site.slug}/ · {site.active ? "visible" : "hidden"} · {site.healthFailures} failed checks</p>
              <p>{site.description || "No description"}</p>
              <p className="mono">Last check: {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "not checked yet"}</p>
            </div>
            <button type="button" className="admin-remove" disabled={busy} onClick={() => void removeSite(site)}>Remove</button>
          </article>
        ))}
      </section>
    </main>
  );
}
