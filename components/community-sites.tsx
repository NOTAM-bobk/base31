"use client";

import { useEffect, useState } from "react";

const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";

export type CommunitySite = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  createdAt: number;
  active: boolean;
  lastCheckedAt?: number | null;
  healthFailures?: number;
};

/** The Worker's /sites feed: what visitors have published, newest first. */
export function useCommunitySites() {
  const [sites, setSites] = useState<CommunitySite[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${counterUrl}/sites`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((data) => {
        setSites(Array.isArray(data?.sites) ? (data.sites as CommunitySite[]) : []);
        setState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, []);
  return { sites, state };
}

const when = (value: number) => new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/* The community half of /recently-added. The curated entries are baked into
 * the page; uploads arrive from the Worker at runtime, so this is the one
 * client-rendered block there. It renders nothing until it has something —
 * an empty strip would just be noise above the footer. */
export default function CommunitySites({ limit }: { limit?: number }) {
  const { sites, state } = useCommunitySites();
  if (state === "loading") return <p className="community-sites-note mono">Checking for community uploads…</p>;
  if (state === "error") return <p className="community-sites-note mono">Community uploads are unavailable right now.</p>;
  if (sites.length === 0) return <p className="community-sites-note mono">No community uploads yet — every site here was added by hand.</p>;
  const shown = typeof limit === "number" ? sites.slice(0, limit) : sites;
  return (
    <>
      <ul className="community-sites">
        {shown.map((site) => (
          <li className="community-site" key={site.slug}>
            <a className="community-site-main" href={site.url} target="_blank" rel="noopener noreferrer">
              <span className="community-site-name">{site.title}</span>
              <span className="community-site-desc">{site.description}</span>
            </a>
            <span className="community-site-meta mono">
              added {when(site.createdAt)}
              {!site.active ? " · hidden after failed checks" : ""}
            </span>
          </li>
        ))}
      </ul>
      {typeof limit === "number" && sites.length > limit && (
        <p className="community-sites-note mono">{sites.length - limit} more community uploads are live on the Worker.</p>
      )}
    </>
  );
}