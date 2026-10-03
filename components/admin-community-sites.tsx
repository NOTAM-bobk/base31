"use client";

import { useCallback, useState } from "react";

type AdminSite = { slug: string; title: string; description: string; url: string; active: boolean; lastCheckedAt: number | null; healthFailures: number };
type UrlRequest = { id: string; url: string; title: string; note: string; email?: string; createdAt: number };
type Subscriber = { email: string; verified: boolean };

export default function AdminCommunitySites() {
  const [password, setPassword] = useState("");
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [requests, setRequests] = useState<UrlRequest[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(() => ({ "x-admin-password": password.trim(), "Content-Type": "application/json" }), [password]);
  const loadData = useCallback(async () => {
    if (!password.trim()) { setStatus("Enter your admin password to continue."); return; }
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin", { headers: authHeaders() });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not load admin data.");
      setSites(Array.isArray(data?.sites) ? data.sites : []);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setSubscribers(Array.isArray(data?.subscribers) ? data.subscribers : []);
      setStatus("Admin data loaded.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not load admin data."); }
    finally { setBusy(false); }
  }, [authHeaders, password]);

  const removeSite = async (site: AdminSite) => {
    if (!window.confirm(`Remove ${site.title} (${site.slug})? This deletes its hosted files from the Worker.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ kind: "site", id: site.slug }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not remove that site.");
      setSites((current) => current.filter((entry) => entry.slug !== site.slug)); setStatus(`${site.title} was removed.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not remove that site."); }
    finally { setBusy(false); }
  };

  const dismissRequest = async (item: UrlRequest) => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin", { method: "DELETE", headers: authHeaders(), body: JSON.stringify({ kind: "request", id: item.id }) });
      if (!response.ok) throw new Error("Could not dismiss that request.");
      setRequests((current) => current.filter((entry) => entry.id !== item.id)); setStatus("Request dismissed.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not dismiss that request."); }
    finally { setBusy(false); }
  };

  return (
    <main className="admin-shell">
      <a className="privacy-back mono" href="/">← base31.org</a>
      <p className="eyebrow mono">moderation</p>
      <h1>Community inbox</h1>
      <p className="admin-lede">Review URL suggestions, published community sites, and newsletter signups. Nothing submitted here is published automatically.</p>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void loadData(); }}>
        <label htmlFor="admin-password">Admin password</label>
        <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Your private password" />
        <button type="submit" disabled={busy}>{busy ? "Loading…" : "Open inbox"}</button>
      </form>
      {status && <p className="admin-status" role="status">{status}</p>}

      <section className="admin-section"><div className="admin-section-head"><h2>URL requests</h2><span className="mono">{requests.length}</span></div>
        {requests.length === 0 ? <p className="admin-empty">No pending suggestions.</p> : requests.map((item) => (
          <article className="admin-site" key={item.id}><div><h3>{item.title}</h3><p><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a></p>{item.note && <p>{item.note}</p>}<p className="mono">{item.email || "No reply email"} · {new Date(item.createdAt).toLocaleString()}</p></div><button type="button" className="admin-remove" disabled={busy} onClick={() => void dismissRequest(item)}>Dismiss</button></article>
        ))}
      </section>

      <section className="admin-section"><div className="admin-section-head"><h2>Newsletter subscribers</h2><span className="mono">{subscribers.length}</span></div>
        {subscribers.length === 0 ? <p className="admin-empty">No saved addresses yet.</p> : <ul className="admin-subscriber-list">{subscribers.map((subscriber) => <li key={subscriber.email}><span>{subscriber.email}</span><span className="mono">{subscriber.verified ? "active" : "pending"}</span></li>)}</ul>}
      </section>

      <section className="admin-section"><div className="admin-section-head"><h2>Published sites</h2><span className="mono">{sites.length}</span></div>
        {sites.length === 0 ? <p className="admin-empty">No community sites loaded.</p> : sites.map((site) => (
          <article className={`admin-site${site.active ? "" : " is-inactive"}`} key={site.slug}><div><h3>{site.title}</h3><p className="mono">/s/{site.slug}/ · {site.active ? "visible" : "hidden"} · {site.healthFailures} failed checks</p><p>{site.description || "No description"}</p><p className="mono">Last check: {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString() : "not checked yet"}</p></div><button type="button" className="admin-remove" disabled={busy} onClick={() => void removeSite(site)}>Remove</button></article>
        ))}
      </section>
    </main>
  );
}
