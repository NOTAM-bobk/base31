"use client";

import { useEffect, useState } from "react";
import type { DirectoryItem } from "@/lib/directory";

export default function Freshness({ item }: { item: DirectoryItem }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  const added = item.addedAt ?? (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : undefined);
  const checked = item.lastChecked;
  const age = checked && now ? (now - Date.parse(checked)) / 86400000 : null;
  const recent = added && now && now >= Date.parse(added) && now - Date.parse(added) <= 30 * 86400000;
  return (
    <span className="freshness mono">
      {added && <span className={recent ? "freshness-badge is-fresh" : "freshness-badge"}>{recent ? "Recently added · " : "Added · "}<time dateTime={added}>{added}</time></span>}
      {checked ? (
        <span className={`freshness-badge${age !== null && age <= 30 ? " is-fresh" : age !== null && age > 90 ? " is-stale" : ""}`}>
          {age === null ? "Reviewed" : age <= 30 ? "Fresh" : age > 90 ? "Review due" : "Previously reviewed"} · <time dateTime={checked}>{checked}</time>
        </span>
      ) : <span className="freshness-badge">Not yet reviewed</span>}
    </span>
  );
}
