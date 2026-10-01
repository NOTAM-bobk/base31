"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Message = { id: number; rootId: number | null; replyTo: number | null; name: string; body: string; createdAt: number; removed: number };
type Thread = Message & { replies: Message[] };
type Page = { threads: Thread[]; nextCursor: number | null };
const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`${workerUrl}${path}`, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(12000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Community chat is unavailable. Please try again.");
  return data;
}

export default function DiscussionBoard() {
  const [page, setPage] = useState<Page>({ threads: [], nextCursor: null });
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [posting, setPosting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const postLock = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const requestNumber = useRef(0);

  useEffect(() => { try { setName(localStorage.getItem("base31-discussion-name")?.slice(0, 32) || ""); } catch {} }, []);
  const refreshPage = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const load = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      const number = ++requestNumber.current;
      try {
        const data = await api(`/discussion${cursor ? `?before=${cursor}` : ""}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!data || !Array.isArray(data.threads)) throw new Error("The discussion service needs an update. Please check back soon.");
        if (!controller.signal.aborted && number === requestNumber.current) { setPage(data); setAvailable(true); setLoadError(""); }
      } catch (error) {
        if (!controller.signal.aborted && number === requestNumber.current) setLoadError(error instanceof Error ? error.message : "Could not load conversations.");
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [cursor, refresh]);

  const chooseReply = (message: Message) => { setReply(message); setNotice(""); setSubmitError(""); textarea.current?.focus(); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (postLock.current) return;
    postLock.current = true; setPosting(true); setSubmitError(""); setNotice("");
    try {
      await api("/discussion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), body: body.trim(), replyTo: reply?.id ?? null }) });
      try { localStorage.setItem("base31-discussion-name", name.trim()); } catch {}
      setBody(""); setReply(null); setNotice("Your message is posted.");
      if (!reply) setCursors([null]);
      refreshPage();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Your message was not posted. Please try again."); }
    finally { postLock.current = false; setPosting(false); }
  }
  const renderMessage = (message: Message, thread: Thread) => {
    const parent = message.replyTo ? [thread, ...thread.replies].find(item => item.id === message.replyTo) : null;
    return <article className={`discussion-message${message.removed ? " is-removed" : ""}`} key={message.id} id={`message-${message.id}`}>
      <div className="discussion-avatar" aria-hidden="true">{message.name.slice(0, 1).toUpperCase()}</div>
      <div className="discussion-message-copy">
        <header><strong>{message.name}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></header>
        {parent && <span className="discussion-reply-label">↳ replying to {parent.name}</span>}
        <p>{message.body}</p>
        {!message.removed && !thread.removed && <button type="button" className="discussion-text-button" onClick={() => chooseReply(message)}>Reply <span className="sr-only">to {message.name}</span> ↗</button>}
      </div>
    </article>;
  };

  return <section id="discussion" className="discussion-board" aria-labelledby="discussion-heading">
    <div className="discussion-heading">
      <div><p className="eyebrow mono">the community corner</p><h2 id="discussion-heading">Good links. Better conversations.</h2><p>Share a discovery, ask a question, or say hello to the people exploring with you.</p></div>
      <span className="discussion-badge mono">Open to everyone</span>
    </div>
    <div className="discussion-layout">
      <form className="discussion-composer" onSubmit={submit}>
        <h3>{reply ? `Reply to ${reply.name}` : "Pull up a chair."}</h3>
        <p>No account needed. Pick a name and join in.</p>
        <label htmlFor="discussion-name">Display name</label>
        <input id="discussion-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} required autoComplete="nickname" placeholder="What should we call you?" disabled={posting} />
        {reply && <div className="discussion-reply-context"><span>Replying to {reply.name}: “{reply.body.slice(0, 100)}{reply.body.length > 100 ? "…" : ""}”</span><button type="button" onClick={() => setReply(null)} disabled={posting}>Cancel reply</button></div>}
        <label htmlFor="discussion-body">{reply ? "Your reply" : "Your message"}</label>
        <textarea ref={textarea} id="discussion-body" value={body} onChange={event => setBody(event.target.value)} rows={5} maxLength={2000} required placeholder="Found something wonderful on the web?" disabled={posting} aria-describedby="discussion-rules" />
        <div className="discussion-composer-footer"><span className="mono">{body.length}/2000</span><button className="discussion-post" type="submit" disabled={posting || !available || !name.trim() || !body.trim()}>{posting ? "Posting…" : reply ? "Post reply ↗" : "Post message ↗"}</button></div>
        <p id="discussion-rules" className="discussion-rules">Messages are public. Be kind, skip the spam, and don’t share private information. Names aren’t verified. <a href="/privacy">Privacy</a> · <a href="mailto:hello@base31.org?subject=Community%20discussion%20report">Report a message</a></p>
        {submitError && <p className="discussion-error" role="alert">{submitError}</p>}
        <p className="discussion-notice" role="status">{notice}</p>
      </form>
      <div className="discussion-feed">
        <div className="discussion-feed-heading"><h3>{cursor ? "Earlier conversations" : "Latest conversations"}</h3><button type="button" className="discussion-text-button" onClick={refreshPage} disabled={loading}>Refresh ↻</button></div>
        <p className="discussion-poll-note mono">Refreshes every 15 seconds while this tab is visible</p>
        {loadError && <p className="discussion-error" role="status">{loadError} Your draft is safe; use Refresh to retry.</p>}
        {loading && !available && <p className="discussion-empty" role="status">Opening the community corner…</p>}
        {!loading && !loadError && page.threads.length === 0 && <div className="discussion-empty"><span aria-hidden="true">✳</span><h3>A little quiet in here.</h3><p>Be the first to start a conversation. What’s your favorite find in the directory?</p></div>}
        {page.threads.map(thread => <div className="discussion-thread" key={thread.id}>{renderMessage(thread, thread)}{thread.replies.length > 0 && <div className="discussion-replies" aria-label={`Replies to ${thread.name}`}>{thread.replies.map(message => renderMessage(message, thread))}</div>}</div>)}
        <nav className="discussion-pagination" aria-label="Conversation pages">
          {cursors.length > 1 && <button type="button" onClick={() => setCursors(value => value.slice(0, -1))} disabled={loading}>← Newer</button>}
          {cursor && <button type="button" onClick={() => setCursors([null])} disabled={loading}>Latest</button>}
          {page.nextCursor && <button type="button" onClick={() => setCursors(value => [...value, page.nextCursor])} disabled={loading}>Older →</button>}
        </nav>
      </div>
    </div>
  </section>;
}
