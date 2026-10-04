import { NextResponse } from "next/server";

// The public half of the Worker's health-check data. /quality is deliberately
// unauthenticated — it only exposes what the report page already prints — so
// this proxy exists to keep the Worker's address out of the browser and to give
// the page a same-origin endpoint it can refresh on its own schedule.
export const revalidate = 300;

const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

export async function GET() {
  try {
    const response = await fetch(`${workerUrl}/quality`, { next: { revalidate } });
    const body = await response.json().catch(() => ({ error: "Invalid Worker response." }));
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ error: "The quality report is unavailable right now." }, { status: 503 });
  }
}