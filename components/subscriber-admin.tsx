"use client";

import { useState, type FormEvent } from "react";

type Subscriber = { email: string; active: boolean; subscribedAt: number | null };
const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

export default function SubscriberAdmin() {
  const [secret, setSecret] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(next?: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${workerUrl}/admin/subscribers${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(12000) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) { setUnlocked(false); setSubscribers([]); setCursor(null); }
        throw new Error(data?.error || "Could not load subscribers.");
      }
      setSubscribers(previous => next ? [...previous, ...data.subscribers].filter((item, index, all) => all.findIndex(other => other.email === item.email) === index) : data.subscribers);
      setCursor(data.nextCursor); setUnlocked(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load subscribers."); }
    finally { setBusy(false); }
  }

  function unlock(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(); }
  return <section className="admin-panel" aria-label="Subscriber management">
    {!unlocked ? <form onSubmit={unlock} className="url-submission-form">
      <label htmlFor="admin-secret">Subscriber admin secret</label>
      <input id="admin-secret" type="password" autoComplete="off" value={secret} onChange={event => setSecret(event.target.value)} required />
      <button className="url-submit-button" disabled={busy} type="submit">{busy ? "Checking…" : "Unlock subscribers"}</button>
    </form> : <>
      <div className="admin-toolbar"><strong>{subscribers.length} loaded subscribers</strong><button onClick={() => void load()} disabled={busy}>Refresh</button><button disabled={busy} onClick={() => { setSecret(""); setSubscribers([]); setCursor(null); setUnlocked(false); }}>Lock</button></div>
      <p className="community-privacy-note">New signups are active immediately. Older unconfirmed signups remain pending. Cloudflare’s list can take about a minute to reflect new entries.</p>
      <div className="admin-table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>Signed up</th></tr></thead><tbody>{subscribers.map(item => <tr key={item.email}><td>{item.email}</td><td>{item.active ? "Active" : "Pending"}</td><td>{item.subscribedAt ? new Date(item.subscribedAt).toLocaleString() : "Not recorded"}</td></tr>)}</tbody></table></div>
      {!subscribers.length && <p>No subscribers yet.</p>}
      {cursor && <button className="url-submit-button" disabled={busy} onClick={() => void load(cursor)}>{busy ? "Loading…" : "Load more"}</button>}
    </>}
    {error && <p className="discussion-error" role="alert">{error}</p>}
  </section>;
}
