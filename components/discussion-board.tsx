"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { discussionAvatarUrl } from "@/lib/discussion-avatar";
import { tick } from "@/lib/haptics";

type Message = { id: number; rootId: number | null; replyTo: number | null; name: string; body: string; createdAt: number; removed: number };
type Thread = Message & { replies: Message[] };
type Page = { threads: Thread[]; nextCursor: number | null };
const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");
/** Replies a thread shows before it folds the rest behind one line. */
const REPLY_PREVIEW = 2;

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`${workerUrl}${path}`, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(12000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Community chat is unavailable. Please try again.");
  return data;
}

// "12m" is read at a glance where "Oct 5, 7:42 PM" has to be parsed, so the
// list shows the relative time and keeps the exact one in `title` (and in
// `dateTime` for anything reading the markup rather than the screen).
function relativeTime(createdAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - createdAt) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const exactTime = (createdAt: number) => new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const clip = (value: string, length: number) => (value.length > length ? `${value.slice(0, length).trimEnd()}…` : value);

/** The newest message id on a page — the one number that says "there is more
    to read here than what is on screen". */
const newestId = (value: Page) =>
  value.threads.reduce((top, thread) => thread.replies.reduce((inner, message) => Math.max(inner, message.id), Math.max(top, thread.id)), 0);

// The clipboard API where it exists, a hidden field where it does not — the
// same two-step the share strip uses.
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; }
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "true");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch { return false; }
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
  const [feedNote, setFeedNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Messages that arrived while the visitor was reading. They are held here
  // rather than dropped into the list, so the page never moves under them.
  const [pending, setPending] = useState<Page | null>(null);
  // Threads opened past the two-reply preview, by thread id.
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  // The message a "replying to" quote jumped to, lit up for a moment.
  const [flashed, setFlashed] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // When this visitor last looked, so fresh activity can be marked.
  const [seenAt, setSeenAt] = useState(0);
  const postLock = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const requestNumber = useRef(0);
  const displayed = useRef(page);
  const flashTimer = useRef<number | null>(null);
  const uiTimer = useRef<number | null>(null);

  useEffect(() => { try { setName(localStorage.getItem("base31-discussion-name")?.slice(0, 32) || ""); } catch {} }, []);
  useEffect(() => { displayed.current = page; }, [page]);
  // The dots a returning visitor sees compare against the previous visit, so
  // the stamp is written straight away and the value read is kept for this one.
  useEffect(() => {
    let stored = 0;
    try { stored = Number(localStorage.getItem("base31-discussion-seen")) || 0; } catch {}
    setSeenAt(stored);
    try { localStorage.setItem("base31-discussion-seen", String(Date.now())); } catch {}
  }, []);
  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    if (uiTimer.current) window.clearTimeout(uiTimer.current);
  }, []);

  const refreshPage = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    // The first load of an effect run is a deliberate one — a page turn, a
    // refresh, the visitor's own post — so it replaces what is on screen. The
    // one-minute polls that follow hold new messages back instead.
    let deliberate = true;
    const load = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      const number = ++requestNumber.current;
      const apply = deliberate;
      deliberate = false;
      try {
        const data = await api(`/discussion${cursor ? `?before=${cursor}` : ""}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!data || !Array.isArray(data.threads)) throw new Error("The discussion service needs an update. Please check back soon.");
        if (controller.signal.aborted || number !== requestNumber.current) return;
        setLoadError("");
        setAvailable(true);
        if (apply || !displayed.current.threads.length) { setPage(data); setPending(null); }
        else if (newestId(data) > newestId(displayed.current)) setPending(data);
        else setPage(data);
      } catch (error) {
        if (!controller.signal.aborted && number === requestNumber.current) setLoadError(error instanceof Error ? error.message : "Could not load conversations.");
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [cursor, refresh]);

  const flash = useCallback((id: number | null) => {
    setFlashed(id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    if (id === null) return;
    flashTimer.current = window.setTimeout(() => setFlashed(current => (current === id ? null : current)), 1800);
  }, []);

  const jumpTo = useCallback((id: number) => {
    const target = document.getElementById(`message-${id}`);
    if (!target) return;
    tick(10);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    flash(id);
  }, [flash]);

  const chooseReply = (message: Message) => { tick(10); setReply(message); setNotice(""); setSubmitError(""); textarea.current?.focus(); };

  async function shareMessage(id: number) {
    const copiedOk = await copyText(`${window.location.origin}${window.location.pathname}${window.location.search}#message-${id}`);
    tick(copiedOk ? [8, 30, 8] : 24);
    setFeedNote(copiedOk ? "" : "This browser blocked the clipboard — copy the address bar instead.");
    if (!copiedOk) return;
    setCopied(id);
    if (uiTimer.current) window.clearTimeout(uiTimer.current);
    uiTimer.current = window.setTimeout(() => setCopied(current => (current === id ? null : current)), 1800);
  }

  const showPending = () => {
    if (!pending) return;
    tick(12);
    setPage(pending);
    setPending(null);
    setLoadError("");
  };

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

  // ⌘/Ctrl + Enter posts from the writing area without reaching for the button.
  const composeKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  };

  const renderMessage = (message: Message, thread: Thread, options: { root?: boolean; lastAt?: number; fresh?: boolean } = {}) => {
    const parent = message.replyTo ? [thread, ...thread.replies].find(item => item.id === message.replyTo) : null;
    const now = Date.now();
    return <article className={`discussion-message${message.removed ? " is-removed" : ""}${flashed === message.id ? " is-target" : ""}`} key={message.id} id={`message-${message.id}`}>
      <div className="discussion-avatar" aria-hidden="true">
        {/* DiceBear draws a stable avatar from the display name. It is
            decorative, so it stays hidden from assistive tech — the header
            reads the name itself. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from the DiceBear API at a fixed 36px; next/image would need a remotePatterns entry for one decorative image. */}
        <img src={discussionAvatarUrl(message.name)} alt="" width={36} height={36} loading="lazy" decoding="async" />
      </div>
      <div className="discussion-message-copy">
        <header>
          <strong>{message.name}</strong>
          <time dateTime={new Date(message.createdAt).toISOString()} title={exactTime(message.createdAt)}>{relativeTime(message.createdAt, now)}</time>
          {options.root && options.fresh && <span className="discussion-new-dot" role="img" aria-label="New since your last visit" title="New since your last visit" />}
          {options.root && thread.replies.length > 0 && <span className="discussion-thread-meta mono">{thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"} · last {relativeTime(options.lastAt ?? message.createdAt, now)}</span>}
        </header>
        {parent && <button type="button" className="discussion-reply-quote" onClick={() => jumpTo(parent.id)} title={`Go to ${parent.name}’s message`}>
          <span className="discussion-reply-quote-name">↳ {parent.name}</span>
          <span className="discussion-reply-quote-body">{clip(parent.body, 90)}</span>
        </button>}
        <p>{message.body}</p>
        {!message.removed && !thread.removed && <div className="discussion-message-actions">
          <button type="button" className="discussion-text-button" onClick={() => chooseReply(message)}>Reply <span className="sr-only">to {message.name}</span> ↗</button>
          <button type="button" className="discussion-text-button" onClick={() => void shareMessage(message.id)}>{copied === message.id ? "Copied ✓" : "Copy link"}</button>
        </div>}
      </div>
    </article>;
  };

  return <section id="discussion" className="discussion-board" aria-labelledby="discussion-heading">
    <div className="discussion-heading">
      <div><h2 id="discussion-heading">Good links. Better conversations.</h2><p>Share a discovery, ask a question, or say hello to the people exploring with you.</p></div>
      <span className="discussion-badge mono">Open to everyone</span>
    </div>
    <div className="discussion-layout">
      <form className="discussion-composer" onSubmit={submit}>
        <h3>{reply ? `Reply to ${reply.name}` : "Pull up a chair."}</h3>
        <p>No account needed. Pick a name and join in.</p>
        <label htmlFor="discussion-name">Display name</label>
        <input id="discussion-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} required autoComplete="nickname" placeholder="What should we call you?" disabled={posting} />
        {reply && <div className="discussion-reply-context">
          <span>Replying to <strong>{reply.name}</strong>: “{clip(reply.body, 100)}”</span>
          <button type="button" className="discussion-reply-cancel" onClick={() => setReply(null)} disabled={posting} aria-label={`Cancel the reply to ${reply.name}`}>✕</button>
        </div>}
        <label htmlFor="discussion-body">{reply ? "Your reply" : "Your message"}</label>
        <textarea ref={textarea} id="discussion-body" value={body} onChange={event => setBody(event.target.value)} onKeyDown={composeKeys} rows={5} maxLength={2000} required placeholder="Found something wonderful on the web?" disabled={posting} aria-describedby="discussion-rules" />
        <div className="discussion-composer-footer">
          <div className="discussion-composer-meta">
            <span className={`mono${body.length > 1950 ? " is-over" : body.length > 1800 ? " is-warn" : ""}`}>{body.length}/2000</span>
            <span className="discussion-hint mono">⌘/Ctrl + Enter</span>
          </div>
          <button className="discussion-post" type="submit" disabled={posting || !available || !name.trim() || !body.trim()}>{posting ? "Posting…" : reply ? "Post reply ↗" : "Post message ↗"}</button>
        </div>
        <p id="discussion-rules" className="discussion-rules">Messages are public. Be kind, skip the spam, and don’t share private information. Names aren’t verified. <a href="/privacy">Privacy</a> · <a href="mailto:hello@base31.org?subject=Community%20discussion%20report">Report a message</a></p>
        {(submitError || notice) && <p className={submitError ? "discussion-error" : "discussion-notice"} role={submitError ? "alert" : "status"}>{submitError || notice}</p>}
      </form>
      <div className="discussion-feed">
        <div className="discussion-feed-heading">
          <h3>{cursor ? "Earlier conversations" : "Latest conversations"}</h3>
          {available && <span className="discussion-count mono">{page.threads.length} {page.threads.length === 1 ? "conversation" : "conversations"}</span>}
          <button type="button" className={`discussion-refresh${loading && available ? " is-loading" : ""}`} onClick={() => { tick(8); refreshPage(); }} disabled={loading} aria-label="Refresh conversations">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>
            Refresh
          </button>
        </div>
        <p className="discussion-poll-note mono">Refreshes every minute while this tab is visible</p>
        {loadError && <p className="discussion-error" role="status">{loadError} Your draft is safe; use Refresh to retry.</p>}
        {feedNote && <p className="discussion-error" role="status">{feedNote}</p>}
        {pending && <button type="button" className="discussion-new-pill" onClick={showPending}>
          <span className="discussion-new-dot" aria-hidden="true" />
          {newestId(pending) > newestId(page) ? "New messages have arrived" : "This conversation has moved on"} — show them
        </button>}
        {loading && !available && <>
          <p className="sr-only" role="status">Opening the conversation…</p>
          <div className="discussion-skeletons" aria-hidden="true">
            {[0, 1, 2].map(index => <div className="discussion-skeleton" key={index}>
              <span className="discussion-skeleton-avatar" />
              <span className="discussion-skeleton-lines"><i /><i /><i /></span>
            </div>)}
          </div>
        </>}
        {!loading && !loadError && page.threads.length === 0 && <div className="discussion-empty"><span aria-hidden="true">✳</span><h3>A little quiet in here.</h3><p>Be the first to start a conversation. What’s your favorite find in the directory?</p><button type="button" className="discussion-empty-cta" onClick={() => { tick(12); textarea.current?.focus(); }}>Start the conversation</button></div>}
        {page.threads.map(thread => {
          const replies = thread.replies;
          const opened = expanded[thread.id] === true;
          const hidden = Math.max(0, replies.length - REPLY_PREVIEW);
          const shown = opened || hidden === 0 ? replies : replies.slice(0, REPLY_PREVIEW);
          const lastAt = replies.length ? replies[replies.length - 1].createdAt : thread.createdAt;
          const fresh = seenAt > 0 && lastAt > seenAt;
          return <div className={`discussion-thread${fresh ? " is-fresh" : ""}`} key={thread.id}>
            {renderMessage(thread, thread, { root: true, lastAt, fresh })}
            {replies.length > 0 && <div className="discussion-replies" aria-label={`Replies to ${thread.name}`}>
              {shown.map(message => renderMessage(message, thread))}
              {hidden > 0 && <button type="button" className="discussion-fold" aria-expanded={opened} onClick={() => { tick(8); setExpanded(current => ({ ...current, [thread.id]: !opened })); }}>{opened ? "Show fewer ↑" : `Show ${hidden} more ${hidden === 1 ? "reply" : "replies"} ↓`}</button>}
            </div>}
          </div>;
        })}
        <nav className="discussion-pagination" aria-label="Conversation pages">
          {cursors.length > 1 && <button type="button" onClick={() => { setCursors(value => value.slice(0, -1)); setPending(null); }} disabled={loading}>← Newer</button>}
          {cursor && <button type="button" onClick={() => { setCursors([null]); setPending(null); }} disabled={loading}>Latest</button>}
          {page.nextCursor && <button type="button" onClick={() => { setCursors(value => [...value, page.nextCursor]); setPending(null); }} disabled={loading}>Older →</button>}
          {cursors.length > 1 && <span className="discussion-page-label mono" aria-hidden="true">Page {cursors.length}</span>}
        </nav>
      </div>
    </div>
  </section>;
}
