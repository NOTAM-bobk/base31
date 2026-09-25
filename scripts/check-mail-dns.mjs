#!/usr/bin/env node
// Checks the DNS records Resend needs before a domain can send mail.
//
//   npm run check:mail
//   node scripts/check-mail-dns.mjs example.com
//
// Exits non-zero while any required record is missing, so it doubles as a
// pre-flight check before switching RESEND_FROM_EMAIL off onboarding@resend.dev.
// Uses DNS-over-HTTPS, so it needs no `dig` install and no credentials, and it
// works the same from this workspace, a laptop, or CI.

const domain = process.argv[2] || process.env.RESEND_DOMAIN || "base31.org";
const DOH = "https://cloudflare-dns.com/dns-query";

async function query(name, type) {
  const url = `${DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) throw new Error(`DNS lookup failed (HTTP ${res.status})`);
  const body = await res.json();
  if (body.Status === 3) return []; // NXDOMAIN
  if (body.Status !== 0) throw new Error(`DNS lookup returned status ${body.Status}`);
  return (body.Answer || []).map((a) => String(a.data).replace(/^"|"$/g, ""));
}

const nameserversOf = (records) => records.map((r) => r.replace(/\.$/, ""));

// Each check lists the record types Resend may issue. Newer accounts get the
// DKIM key as a CNAME rather than a TXT, so both are accepted.
const checks = [
  {
    label: "SPF",
    name: `send.${domain}`,
    tries: [
      {
        type: "TXT",
        ok: (values) => values.some((v) => /include:amazonses\.com/i.test(v)),
      },
    ],
    why: "Resend sends over Amazon SES, so `send` must authorise amazonses.com",
  },
  {
    label: "DKIM",
    name: `resend._domainkey.${domain}`,
    tries: [
      {
        type: "TXT",
        ok: (values) => values.some((v) => /p=[A-Za-z0-9+/=]{40,}/.test(v)),
      },
      { type: "CNAME", ok: (values) => values.length > 0 },
    ],
    why: "Resend's DKIM key; without it mail is unsigned and lands in spam",
  },
  {
    label: "MX",
    name: `send.${domain}`,
    tries: [
      {
        type: "MX",
        ok: (values) => values.some((v) => /feedback-smtp\.[a-z0-9-]+\.amazonses\.com/i.test(v)),
      },
    ],
    why: "Handles bounces and complaints for the sending subdomain",
  },
  {
    label: "DMARC",
    name: `_dmarc.${domain}`,
    optional: true,
    tries: [
      { type: "TXT", ok: (values) => values.some((v) => /^v=DMARC1/i.test(v)) },
    ],
    why: "Optional policy record; recommended once the domain is verified",
  },
];

const pad = (s, n) => String(s).padEnd(n);

console.log(`\nResend sending-domain check for ${domain}\n`);

const ns = await query(domain, "NS").catch(() => []);
if (ns.length) console.log(`  nameservers      ${nameserversOf(ns).join(", ")}\n`);

let failed = 0;
for (const check of checks) {
  const types = check.tries.map((t) => t.type).join("/");
  let matched = null;
  let lastValues = [];
  let error = null;

  for (const { type, ok } of check.tries) {
    try {
      const values = await query(check.name, type);
      lastValues = values;
      if (ok(values)) {
        matched = { type, values };
        break;
      }
    } catch (err) {
      error = err.message;
    }
  }

  const passed = Boolean(matched);
  const status = passed ? "PASS" : check.optional ? "TODO" : "FAIL";
  if (!passed && !check.optional) failed += 1;

  console.log(`  ${pad(status, 5)} ${pad(check.label, 6)} ${pad(types, 10)} ${check.name}`);
  if (error && !passed) console.log(`        ${error}`);
  else if (passed) console.log(`        ${matched.type} ${matched.values.join("  ").slice(0, 150)}`);
  else {
    console.log(`        ${lastValues.length ? `found: ${lastValues.join("  ").slice(0, 140)}` : "no record found"}`);
    console.log(`        ${check.why}`);
  }
  console.log("");
}

if (failed) {
  console.log(`  ${failed} required record(s) missing. Add them at the DNS host for`);
  console.log(`  ${domain}, then re-run this check.\n`);
  process.exit(1);
}

console.log("  All required records are in place — press Verify DNS Records in Resend.\n");
