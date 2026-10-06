import { NextResponse } from "next/server";

export const runtime = "nodejs";

// The Worker already holds the moderation inbox, so a report is queued there
// rather than emailed: it is read next to the URL suggestions and takedown
// notices on /admin/community-sites, it survives a mail-provider outage, and
// nothing leaves the site's own storage.
const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 5;
const recentReports = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const validEmail = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>(),;:\\[\]]+@[^\s@<>(),;:\\[\]]+\.[^\s@<>(),;:\\[\]]+$/.test(value);

const allowReport = (address: string): boolean => {
  const now = Date.now();
  const recent = (recentReports.get(address) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REPORTS_PER_WINDOW) {
    recentReports.set(address, recent);
    return false;
  }
  recent.push(now);
  recentReports.set(address, recent);

  // Keep this lightweight in long-lived Node instances; entries are only a
  // best-effort per-instance throttle, with the Worker's own limits as backup.
  if (recentReports.size > 1000) {
    for (const [key, timestamps] of recentReports) {
      if (timestamps.every((time) => now - time >= WINDOW_MS)) recentReports.delete(key);
    }
  }
  return true;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ error: "This request could not be verified." }, 403);
      }
    } catch {
      return json({ error: "This request could not be verified." }, 403);
    }
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12_000) return json({ error: "That report is too large." }, 413);

  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return json({ error: "That report is too large." }, 413);
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Please check the report and try again." }, 400);
  }

  // Quietly accept honeypot submissions so simple bots don't learn how the
  // form is protected, without queuing anything.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return json({ success: true }, 202);
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const email = payload.email == null || payload.email === "" ? "" : payload.email;
  if (message.length < 10 || message.length > 4000) {
    return json({ error: "Please describe the issue in 10–4,000 characters." }, 400);
  }
  if (email !== "" && !validEmail(email)) {
    return json({ error: "Enter a valid email address, or leave it blank." }, 400);
  }

  const page = typeof payload.page === "string" && payload.page.length <= 2048
    ? payload.page
    : "https://base31.org/";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim();
  if (address && !allowReport(address)) {
    return json({ error: "Too many reports from this connection. Please try again later." }, 429);
  }

  try {
    const response = await fetch(`${workerUrl}/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // This route is called server-to-server, so the Worker's own throttle
        // would otherwise key every report on this server's connection. Pass
        // the visitor along with it.
        ...(address ? { "x-report-origin": address } : {}),
      },
      body: JSON.stringify({ message, page, ...(email ? { email } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return json({ error: "Could not file the report right now. Please try again later." }, 502);
    return json({ success: true }, 202);
  } catch {
    return json({ error: "Could not file the report right now. Please try again later." }, 502);
  }
}
