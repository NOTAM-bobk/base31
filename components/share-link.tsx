"use client";

import { useCallback, useState } from "react";

/* A share strip for a single site.
 *
 * The outbound links are plain anchors built at render time, so they exist in
 * the served HTML for crawlers and work without JavaScript. Only the copy
 * button needs the client, because the Clipboard API does — and where it is
 * unavailable (an insecure context, an older browser) the fallback selects the
 * URL in a prompt-style textarea so the visitor can copy it by hand.
 *
 * `url` is the page being shared, not necessarily the site's own address: on a
 * detail page it is the base31 detail URL, which carries the description and
 * the vote controls with it. */

type Props = {
  /** The address to share. */
  url: string;
  /** What the share text calls the thing, e.g. the site's name. */
  title: string;
  /** Optional extra line, e.g. the site's description. */
  text?: string;
  /** Compact hides the label and the copy button for a card-sized row. */
  compact?: boolean;
};

export default function ShareLink({ url, title, text, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const message = text ? `${title} — ${text}` : title;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // The Clipboard API is unavailable or refused: fall back to a prompt so
      // the visitor still ends up with the link on their clipboard.
      window.prompt("Copy this link", url);
    }
  }, [url]);

  return (
    <div className={`share-link${compact ? " is-compact" : ""}`}>
      {!compact && <span className="share-link-label mono">Share</span>}
      <a
        className="share-link-item"
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share ${title} on X`}
      >
        <span aria-hidden="true">𝕏</span>
      </a>
      <a
        className="share-link-item"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share ${title} on Facebook`}
      >
        <span aria-hidden="true">f</span>
      </a>
      <a
        className="share-link-item"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share ${title} on LinkedIn`}
      >
        <span aria-hidden="true">in</span>
      </a>
      <a
        className="share-link-item"
        href={`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share ${title} on Reddit`}
      >
        <span aria-hidden="true">r/</span>
      </a>
      <a
        className="share-link-item"
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`}
        aria-label={`Share ${title} by email`}
      >
        <span aria-hidden="true">@</span>
      </a>
      {!compact && (
        <button type="button" className="share-link-copy" onClick={() => void copy()}>
          {copied ? "Link copied" : "Copy link"}
        </button>
      )}
    </div>
  );
}