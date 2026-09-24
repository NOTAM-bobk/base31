import { NextResponse } from "next/server";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 5;
const recentReports = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const validEmail = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>(),;:\\[\]]+@[^\s@<>(),;:\\[\]]+\.[^\s@<>(),;:\\[\]]+$/.test(value);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

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
  // best-effort per-instance throttle, with provider-side limits as backup.
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
  // form is protected, without sending an email.
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.BUG_REPORT_TO;
  if (!apiKey || !from || !to) {
    return json({ error: "Bug reports are temporarily unavailable. Please try again later." }, 503);
  }

  const safeMessage = escapeHtml(message);
  const safeEmail = email ? escapeHtml(email) : "Not provided";
  const safePage = escapeHtml(page);
  const text = [
    "New base31.org bug report",
    `From: ${email || "Not provided"}`,
    `Page: ${page}`,
    "",
    message,
  ].join("\n");
  const html = `<h2>New base31.org bug report</h2><p><strong>Reply-to:</strong> ${safeEmail}</p><p><strong>Page:</strong> ${safePage}</p><hr><p>${safeMessage.replace(/\n/g, "<br>")}</p>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "New base31.org bug report",
        text,
        html,
        ...(email ? { reply_to: email } : {}),
      }),
    });
    if (!response.ok) return json({ error: "Could not send the report right now. Please try again later." }, 502);
    return json({ success: true }, 202);
  } catch {
    return json({ error: "Could not send the report right now. Please try again later." }, 502);
  }
}
