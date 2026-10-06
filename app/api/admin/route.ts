import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const workerUrl = (process.env.NEXT_PUBLIC_COUNTER_URL || "https://base31-directory-counter.sawyerbobk563.workers.dev").replace(/\/$/, "");

const authorized = (request: Request) => {
  const expected = process.env.ADMIN_PANEL_PASSWORD;
  const supplied = request.headers.get("x-admin-password");
  return !!expected && !!supplied && supplied === expected;
};

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  const response = await fetch(`${workerUrl}/admin/data`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_PANEL_PASSWORD}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: "Invalid Worker response." }));
  return NextResponse.json(body, { status: response.status });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  let payload: { kind?: unknown; id?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if ((payload.kind !== "site" && payload.kind !== "request" && payload.kind !== "dmca") || typeof payload.id !== "string") {
    return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
  }
  const base = payload.kind === "site" ? "/admin/sites/" : payload.kind === "dmca" ? "/admin/dmca/" : "/admin/requests/";
  const path = `${base}${encodeURIComponent(payload.id)}`;
  const response = await fetch(`${workerUrl}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.ADMIN_PANEL_PASSWORD}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: "Invalid Worker response." }));
  return NextResponse.json(body, { status: response.status });
}
