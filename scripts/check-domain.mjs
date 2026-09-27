#!/usr/bin/env node
// Checks that base31.org is wired the way the wildcard directory needs it.
//
//   npm run check:domain
//   node scripts/check-domain.mjs example.com
//
// The whole directory is one Vercel project on `base31.org` plus a wildcard
// `*.base31.org`, and Vercel can only issue a certificate for the wildcard when
// the domain uses **Vercel's nameservers** — the wildcard challenge is DNS-01,
// so Vercel has to own the zone. This walks the pieces: nameservers, the apex,
// `www`, one real directory subdomain, and mail. It exits non-zero while
// anything required is missing, so it doubles as a smoke test after a DNS
// change. Uses DNS-over-HTTPS, so it needs no `dig` and no credentials, and it
// works from this workspace, a laptop, or CI.

import { readFileSync } from "node:fs";

const domain = process.argv[2] || "base31.org";
const DOH = "https://cloudflare-dns.com/dns-query";
const VERCEL_A = "76.76.21.21";
const VERCEL_NS = /\.vercel-dns\.com$/i;

async function query(name, type) {
  const url = `${DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) throw new Error(`DNS lookup failed (HTTP ${res.status})`);
  const body = await res.json();
  if (body.Status === 3) return []; // NXDOMAIN
  if (body.Status !== 0) throw new Error(`DNS lookup returned status ${body.Status}`);
  return (body.Answer || []).map((a) => String(a.data).replace(/^"|"$/g, ""));
}

// A real subdomain from the directory is the most honest wildcard test: it is
// the record a visitor's browser actually asks for.
function sampleSubdomain() {
  try {
    const sites = JSON.parse(readFileSync(new URL("../config/sites.json", import.meta.url), "utf8"));
    const live = sites.find((site) => site && site.show !== false && site.subdomain);
    if (live) return live.subdomain;
  } catch {
    // Fall through to a generic label.
  }
  return "example";
}

const pad = (value, width) => String(value).padEnd(width);
const report = (status, label, name, detail) =>
  console.log(`  ${pad(status, 5)} ${pad(label, 8)} ${pad(name, 34)} ${detail}`);

console.log(`\nWildcard-domain check for ${domain}\n`);

let failed = 0;

// 1. Nameservers. Not a hard failure on its own — the apex can still point at
//    Vercel through a CNAME on someone else's DNS — but the wildcard cannot.
const ns = (await query(domain, "NS").catch(() => [])).map((name) => name.replace(/\.$/, ""));
const onVercelNameservers = ns.some((name) => VERCEL_NS.test(name));
if (onVercelNameservers) {
  report("PASS", "NS", domain, ns.join(", "));
} else {
  report("INFO", "NS", domain, `${ns.join(", ") || "unknown"} — not Vercel's`);
  console.log("         Vercel can only issue and renew the wildcard certificate");
  console.log("         while the zone uses ns1/ns2.vercel-dns.com. Another DNS");
  console.log("         host can serve the apex, but not `*.base31.org`.");
}

// 2. Apex. Every subdomain rewrite starts from a request to the root domain.
const apex = [
  ...(await query(domain, "A").catch(() => [])),
  ...(await query(domain, "CNAME").catch(() => [])),
];
if (apex.length) {
  const looksVercel = apex.some((value) => value === VERCEL_A || /vercel/i.test(value));
  report(looksVercel ? "PASS" : "WARN", "apex", domain, apex.join(", "));
} else {
  failed += 1;
  report("FAIL", "apex", domain, "no A or CNAME record — the site is unreachable");
  console.log("         Add `A @ 76.76.21.21` (DNS only) here, or put the nameservers");
  console.log("         back to Vercel's so its zone serves the record again.");
}

// 3. www. Cheap to check and easy to forget when a zone is rebuilt by hand.
const www = [
  ...(await query(`www.${domain}`, "CNAME").catch(() => [])),
  ...(await query(`www.${domain}`, "A").catch(() => [])),
];
if (www.length) {
  report("PASS", "www", `www.${domain}`, www.join(", "));
} else {
  failed += 1;
  report("FAIL", "www", `www.${domain}`, "no record — `www.base31.org` will not load");
}

// 4. The wildcard, tested through a subdomain that really exists in the
//    directory. This is the record the whole site design rests on.
const sample = sampleSubdomain();
const wildcard = [
  ...(await query(`${sample}.${domain}`, "CNAME").catch(() => [])),
  ...(await query(`${sample}.${domain}`, "A").catch(() => [])),
];
if (wildcard.length) {
  report("PASS", "wildcard", `${sample}.${domain}`, wildcard.join(", "));
} else {
  failed += 1;
  report("FAIL", "wildcard", `${sample}.${domain}`, "does not resolve");
  console.log("         The wildcard needs Vercel's nameservers, or `CNAME *` to");
  console.log("         cname.vercel-dns.com with the proxy switched off.");
}

// 5. Mail, reported but never failed: sending cannot break the site, and the
//    inbox may deliberately live somewhere other than the web records.
const mx = await query(domain, "MX").catch(() => []);
const spf = await query(domain, "TXT").catch(() => []);
const mailHosts = [...new Set(mx.map((value) => value.split(/\s+/).pop().replace(/\.$/, "")))];
report(
  mx.length ? "INFO" : "TODO",
  "mail",
  domain,
  mailHosts.join(", ") || "no MX record",
);
if (spf.length) console.log(`         SPF: ${spf.join(" | ").slice(0, 120)}`);

console.log("");
if (failed) {
  console.log(`  ${failed} required record(s) missing — ${domain} cannot serve the directory.`);
  console.log(`  See "One-time Vercel/domain setup" in README.md.\n`);
  process.exit(1);
}
console.log(`  Apex, www and the wildcard all resolve. Mail is reported above.\n`);
