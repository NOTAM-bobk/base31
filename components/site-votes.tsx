"use client";

import { useEffect, useRef, useState } from "react";
import { tick } from "@/lib/haptics";

const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";
type Choice = -1 | 0 | 1;
type Totals = { up: number; down: number };
const readChoices = (): Record<string, Choice> => {
  try { return JSON.parse(localStorage.getItem("base31-votes") || "{}"); } catch { return {}; }
};
export function useSiteVotes(keys: string[]) {
  const keyList = [...new Set(keys)].join(",");
  const [totals, setTotals] = useState<Record<string, Totals>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = useRef(new Set<string>());
  useEffect(() => {
    const sync = () => setChoices(readChoices());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("base31-vote-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("base31-vote-change", sync);
    };
  }, []);
  useEffect(() => {
    if (!keyList) return;
    const controller = new AbortController();
    // The Worker limits bulk reads; stay below it even on a fully open strip.
    const all = keyList.split(",");
    for (let start = 0; start < all.length; start += 20) {
      void fetch(`${counterUrl}/votes?keys=${encodeURIComponent(all.slice(start, start + 20).join(","))}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.votes) setTotals((current) => ({ ...current, ...data.votes }));
        }).catch(() => {});
    }
    return () => controller.abort();
  }, [keyList]);
  const vote = async (key: string, direction: Choice) => {
    if (busy.current.has(key)) return;
    busy.current.add(key);
    setPending((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: "" }));
    const from = readChoices()[key] ?? 0;
    const to = from === direction ? 0 : direction;
    tick(12);
    try {
      const response = await fetch(`${counterUrl}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, from, to }),
      });
      if (!response.ok) throw new Error("Vote failed");
      const data = await response.json();
      if (!Number.isFinite(data.up) || !Number.isFinite(data.down)) throw new Error("Invalid totals");
      setTotals((current) => ({ ...current, [key]: { up: data.up, down: data.down } }));
      const next = { ...readChoices(), [key]: to };
      setChoices(next);
      try { localStorage.setItem("base31-votes", JSON.stringify(next)); } catch {}
      window.dispatchEvent(new Event("base31-vote-change"));
    } catch {
      setErrors((current) => ({ ...current, [key]: "Could not save your vote. Try again." }));
    } finally {
      busy.current.delete(key);
      setPending((current) => ({ ...current, [key]: false }));
    }
  };
  return { totals, choices, pending, errors, vote };
}
export default function SiteVotes({ voteKey, name, state }: { voteKey: string; name: string; state: ReturnType<typeof useSiteVotes> }) {
  return (
    <div className="external-votes">
      <div className="external-vote-row" role="group" aria-label={`Vote on ${name}`}>
        {([1, -1] as const).map((direction) => (
          <button key={direction} type="button" className={`external-vote${state.choices[voteKey] === direction ? " is-active" : ""}`} disabled={state.pending[voteKey]} aria-pressed={state.choices[voteKey] === direction} aria-label={`${direction === 1 ? "Like" : "Dislike"} ${name}`} onClick={() => void state.vote(voteKey, direction)}>
            <span aria-hidden="true">{direction === 1 ? "↑" : "↓"}</span> {state.totals[voteKey]?.[direction === 1 ? "up" : "down"] ?? "—"}
          </button>
        ))}
      </div>
      {state.errors[voteKey] && <span className="vote-error" role="status">{state.errors[voteKey]}</span>}
    </div>
  );
}
export function DetailVotes({ voteKey, name }: { voteKey: string; name: string }) {
  const state = useSiteVotes([voteKey]);
  return <SiteVotes voteKey={voteKey} name={name} state={state} />;
}
