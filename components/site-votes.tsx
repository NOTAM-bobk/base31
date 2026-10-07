"use client";

import { useEffect, useRef, useState } from "react";
import { tick } from "@/lib/haptics";
import { isFireActive, readFireStamps, stampFire, type FireStamps } from "@/lib/fires";

const counterUrl = process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev";
type Choice = -1 | 0 | 1;
// `fires` is how many fires on this key are still inside their 24 hours; it is
// the Worker's number, not a count of this visitor's clicks.
type Totals = { up: number; down: number; fires?: number };

const readChoices = (): Record<string, Choice> => {
  try {
    const saved = JSON.parse(localStorage.getItem("base31-votes") || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => value === -1 || value === 0 || value === 1)) as Record<string, Choice>;
  } catch { return {}; }
};

export function useSiteVotes(keys: string[]) {
  const keyList = [...new Set(keys)].join(",");
  const [totals, setTotals] = useState<Record<string, Totals>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  // This visitor's own fires, so the button can be spent for them without the
  // shared totals having to say so.
  const [fires, setFires] = useState<FireStamps>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [firePending, setFirePending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = useRef(new Set<string>());
  const busyFire = useRef(new Set<string>());
  useEffect(() => {
    const sync = () => {
      setChoices(readChoices());
      setFires(readFireStamps());
    };
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
      // The response carries the fire count too, so a vote never blanks it out.
      setTotals((current) => ({ ...current, [key]: { up: data.up, down: data.down, fires: Number.isFinite(data.fires) ? data.fires : current[key]?.fires ?? 0 } }));
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
  /**
   * Fires a site once. The guard is the visitor's own 24 hours, read from the
   * same place the button reads it, so a double click, a second tab or a stale
   * render can never spend two fires.
   */
  const fire = async (key: string) => {
    if (busyFire.current.has(key)) return;
    if (isFireActive(readFireStamps(), key)) return;
    busyFire.current.add(key);
    setFirePending((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: "" }));
    tick(18);
    try {
      const response = await fetch(`${counterUrl}/fire`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error("Fire failed");
      const data = await response.json();
      if (!Number.isFinite(data.fires)) throw new Error("Invalid totals");
      setTotals((current) => ({
        ...current,
        [key]: {
          up: Number.isFinite(data.up) ? data.up : current[key]?.up ?? 0,
          down: Number.isFinite(data.down) ? data.down : current[key]?.down ?? 0,
          fires: data.fires,
        },
      }));
      setFires(stampFire(key));
      window.dispatchEvent(new Event("base31-vote-change"));
    } catch {
      setErrors((current) => ({ ...current, [key]: "Could not add your fire. Try again." }));
    } finally {
      busyFire.current.delete(key);
      setFirePending((current) => ({ ...current, [key]: false }));
    }
  };
  return { totals, choices, fires, pending, firePending, errors, vote, fire };
}

/**
 * The fire button, in the one place it is drawn.
 *
 * It is presentational on purpose: it takes the four things it renders and one
 * callback, so the strips (through `SiteVotes` below) and the `/explore` cards
 * — which keep their own visitor state for the thumbs — can both show the same
 * button without either owning the other's plumbing.
 *
 * While this visitor's fire is running the button is spent: disabled and
 * marked pressed, because there is nothing left to do about it for a day. The
 * count beside the emoji is the shared number of fires still counting, not this
 * visitor's, so a row of cards reads as how the directory is doing rather than
 * what one person clicked.
 */
export function FireButton({ name, count, fired, pending, onFire }: {
  name: string;
  count: number;
  fired: boolean;
  pending: boolean;
  onFire: () => void;
}) {
  return (
    <button
      type="button"
      className={`fire-button${fired ? " is-fired" : ""}`}
      disabled={pending || fired}
      aria-pressed={fired}
      aria-label={fired
        ? `${name} is already boosted by your fire — it stops counting a day after you fired it`
        : `Fire ${name} to boost it by ten votes for 24 hours`}
      onClick={onFire}
    >
      <span aria-hidden="true">🔥</span>
      <span className="fire-count mono" aria-hidden="true">{count > 0 ? count : "—"}</span>
    </button>
  );
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
        <FireButton
          name={name}
          count={state.totals[voteKey]?.fires ?? 0}
          fired={isFireActive(state.fires, voteKey)}
          pending={!!state.firePending[voteKey]}
          onFire={() => void state.fire(voteKey)}
        />
      </div>
      {state.errors[voteKey] && <span className="vote-error" role="status">{state.errors[voteKey]}</span>}
    </div>
  );
}
export function DetailVotes({ voteKey, name }: { voteKey: string; name: string }) {
  const state = useSiteVotes([voteKey]);
  return <SiteVotes voteKey={voteKey} name={name} state={state} />;
}
