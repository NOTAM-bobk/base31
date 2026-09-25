"use client";

import { useEffect, useState } from "react";

// The directory's own repository, shown in the header as a live stat: how many
// commits base31 has. GitHub's public API needs no key and allows 60 requests
// per hour per IP address, so the count is cached in localStorage for an hour —
// the header still renders (and still links to the repo) when the request is
// refused, it just shows a dash instead of a number.
const REPO = "NOTAM-bobk/base31";
const REPO_URL = `https://github.com/${REPO}`;
const CACHE_KEY = "base31-commits";
const CACHE_MS = 60 * 60 * 1000;

const readCache = (): number | null => {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (stored && typeof stored.count === "number" && Date.now() - stored.at < CACHE_MS) {
      return stored.count;
    }
  } catch {}
  return null;
};

const writeCache = (count: number) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }));
  } catch {}
};

const countCommits = async (): Promise<number | null> => {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    // GitHub pages one commit per page here and puts the page count in the Link
    // header, so the last page number *is* the commit count.
    const lastPage = response.headers.get("link")?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (lastPage) return Number(lastPage[1]);
    const commits = await response.json();
    return Array.isArray(commits) ? commits.length : null;
  } catch {
    return null;
  }
};

export default function GithubStats() {
  const [commits, setCommits] = useState<number | null>(null);

  useEffect(() => {
    const cached = readCache();
    if (cached != null) {
      setCommits(cached);
      return;
    }
    let cancelled = false;
    countCommits().then((count) => {
      if (cancelled || count == null) return;
      setCommits(count);
      writeCache(count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = commits == null ? "base31.org source on GitHub" : `base31.org on GitHub, ${commits.toLocaleString()} commits`;

  return (
    <a
      className="icon-button github-stats mono"
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      title="See base31.org's source on GitHub"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M12 1.8a10.2 10.2 0 0 0-3.2 19.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8Z" />
      </svg>
      {/* The number is in the link's label, so the visible copy is decorative —
          otherwise a screen reader reads the same figure twice. */}
      <span className="github-stats-count" aria-hidden="true">{commits == null ? "—" : commits.toLocaleString()}</span>
      <span className="github-stats-label" aria-hidden="true">commits</span>
    </a>
  );
}
