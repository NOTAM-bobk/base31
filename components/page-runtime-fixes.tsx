"use client";

import { useEffect } from "react";

const LAUNCH_TIME = new Date(2026, 8, 20, 17, 0, 0, 0).getTime();

function formatUnit(value: number) {
  return String(value).padStart(2, "0");
}

export default function PageRuntimeFixes() {
  useEffect(() => {
    const board = document.querySelector<HTMLElement>("body > .donation-board");
    const launchBlock = document.querySelector<HTMLElement>(".launch-block");

    if (board && launchBlock && board.parentElement !== launchBlock.parentElement) {
      launchBlock.parentElement?.insertBefore(board, launchBlock);
    }

    const heading = launchBlock?.querySelector<HTMLElement>("h2");
    const note = launchBlock?.querySelector<HTMLElement>(".clock-note");
    if (heading) heading.textContent = "base31 has been running for";
    if (note) note.textContent = "Started at 5:00 PM on September 20, 2026 and counting, one second at a time.";

    const update = () => {
      const totalSeconds = Math.max(0, Math.floor((Date.now() - LAUNCH_TIME) / 1000));
      const values = [
        formatUnit(Math.floor(totalSeconds / 86400)),
        formatUnit(Math.floor((totalSeconds % 86400) / 3600)),
        formatUnit(Math.floor((totalSeconds % 3600) / 60)),
        formatUnit(totalSeconds % 60),
      ];

      launchBlock?.querySelectorAll<HTMLElement>(".clock-digit").forEach((element, index) => {
        if (values[index]) element.textContent = values[index];
      });
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
