"use client";

import { useCallback, useEffect, useState } from "react";
import { tick } from "@/lib/haptics";

type Check = {
  slug: string;
  title: string;
  description: string;
  url: string;
  active: boolean;
  lastCheckedAt: number | null;
  healthFailures: number;
};

type Summary = {
  sites: number;
  checked: number;
  neverChecked: number;
  failing: number;
  hidden: number;
  stale: number;
  lastCheckedAt: number | null;
  staleAfterDays: number;
};

type Payload = { generatedAt: number; summary: Summary; checks: Check[] };

const ago = (value: number, now: number) => {
  const minutes = Math.max(0, Math.round((now - value) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/* The live half of /quality-report.
 *
 * The curated entries above it are checked by hand and their dates live in
 * config/*.json. This block is the automated side: the Worker's scheduled
 * trigger re-checks every community upload and records when it last answered,
 * and this reads that record back. It is client-side rather than a server
 * fetch so the page keeps serving the curated report even if the Worker is
 * down — the note in place of the table says so instead of failing the route. */
export default function QualityChecks() {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/quality-report", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.checks) throw new Error(payload?.error || "unavailable");
      setData(payload as Payload);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  // The relative timestamps ("3 h ago") are computed on the client so the
  // cached HTML never prints a stale one.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  if (state === "loading") return <p className="quality-note mono" role="status">Reading the latest health checks…</p>;
  if (state === "error" || !data) {
    return (
      <p className="quality-note mono" role="status">
        The automated health checks are unavailable right now. The curated checks above are unaffected.{" "}
        <button type="button" className="quality-retry" onClick={() => { tick(8); void load(); }}>Try again</button>
      </p>
    );
  }

  const { summary, checks } = data;
  const failures = checks.filter((check) => check.healthFailures > 0 || !check.active);

  return (
    <>
      <div className="quality-cards" aria-label="Automated check totals">
        <div className="stats-card">
          <span className="stats-card-label mono">Community sites</span>
          <strong className="stats-card-value">{summary.sites}</strong>
          <span className="stats-card-note">{summary.checked} answered the last check</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Never checked</span>
          <strong className="stats-card-value">{summary.neverChecked}</strong>
          <span className="stats-card-note">Waiting for the next scheduled run</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Failing</span>
          <strong className="stats-card-value">{summary.failing}</strong>
          <span className="stats-card-note">{summary.hidden} hidden after repeated failures</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label mono">Overdue</span>
          <strong className="stats-card-value">{summary.stale}</strong>
          <span className="stats-card-note">No check in {summary.staleAfterDays} days</span>
        </div>
      </div>

      <p className="quality-generated mono">
        Generated {ago(data.generatedAt, now)}
        {summary.lastCheckedAt ? ` · last check ran ${ago(summary.lastCheckedAt, now)}` : " · no check has run yet"} ·{" "}
        <button type="button" className="quality-retry" onClick={() => { tick(8); void load(); }}>Refresh</button>
      </p>

      {checks.length === 0 ? (
        <p className="quality-note mono">No community sites are published yet, so there is nothing to check.</p>
      ) : (
        <ul className="quality-list">
          {checks.map((check) => {
            const overdue = check.lastCheckedAt !== null && now - check.lastCheckedAt > summary.staleAfterDays * 86400000;
            const status = !check.active ? "hidden" : check.healthFailures > 0 ? "failing" : check.lastCheckedAt === null ? "pending" : overdue ? "overdue" : "healthy";
            return (
              <li className={`quality-row is-${status}`} key={check.slug}>
                <span className="quality-row-main">
                  <span className="quality-row-name">{check.title}</span>
                  <span className="quality-row-url mono">{check.url.replace(/^https?:\/\//, "")}</span>
                </span>
                <span className="quality-row-status mono">{status}</span>
                <span className="quality-row-when mono">
                  {check.lastCheckedAt === null ? "not checked yet" : `checked ${ago(check.lastCheckedAt, now)}`}
                  {check.healthFailures > 0 ? ` · ${check.healthFailures} failed` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {failures.length > 0 && (
        <p className="quality-note">
          {failures.length} site{failures.length === 1 ? " has" : "s have"} failed at least one check. A site is hidden
          from the directory after two consecutive failures and returns automatically once it answers again.
        </p>
      )}
    </>
  );
}