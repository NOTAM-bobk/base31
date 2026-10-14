"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ben-launches-gate.module.css";

const BEN_LAUNCHES_HOME = "https://www.benlaunches.icu/";
const GATE_SEEN_KEY = "base31-ben-launches-gate-seen";

/** A required first-load choice between the new Ben Launches site and legacy base31. */
export default function BenLaunchesGate() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(GATE_SEEN_KEY) !== "1");
    } catch {
      // Storage may be disabled; the gate remains usable for this visit.
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const preventEscapeDismissal = (event: Event) => event.preventDefault();
    document.body.style.overflow = "hidden";
    dialog.addEventListener("cancel", preventEscapeDismissal);
    if (!dialog.open) dialog.showModal();

    return () => {
      dialog.removeEventListener("cancel", preventEscapeDismissal);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, visible]);

  function rememberChoice() {
    try {
      window.localStorage.setItem(GATE_SEEN_KEY, "1");
    } catch {
      // Storage may be disabled; continue without persisting the choice.
    }
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="ben-launches-gate-title"
      aria-describedby="ben-launches-gate-copy"
    >
      <div className={styles.card}>
        <p className={styles.eyebrow}>A new chapter for the open web</p>
        <h2 id="ben-launches-gate-title" className={styles.title}>
          Allow us to reintroduce ourselves.
        </h2>
        <p id="ben-launches-gate-copy" className={styles.copy}>
          Our name is <strong>Ben Launches.</strong>
        </p>
        <a autoFocus className={styles.primary} href={BEN_LAUNCHES_HOME} onClick={rememberChoice}>
          Continue to Ben Launches <span aria-hidden="true">→</span>
        </a>
        <button
          className={styles.legacy}
          type="button"
          onClick={rememberChoice}
        >
          Continue to legacy
        </button>
      </div>
    </dialog>
  );
}
