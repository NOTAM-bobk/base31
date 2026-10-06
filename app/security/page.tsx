import Link from "next/link";

export const metadata = {
  title: "Security Policy — base31.org",
  description: "How to responsibly report security vulnerabilities in base31.org.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <main className="privacy-page">
      <Link className="privacy-back mono" href="/">← base31.org</Link>
      <p className="eyebrow mono">security policy</p>
      <h1>Help us keep base31 safe.</h1>
      <p className="privacy-updated">Last updated: October 3, 2026</p>
      <section className="privacy-copy">
        <h2>Report privately</h2>
        <p>Please do not open a public issue for a vulnerability. Email <a href="mailto:security@base31.org">security@base31.org</a> with the affected URL, impact, reproduction steps, and any safe proof of concept.</p>
        <h2>Response process</h2>
        <p>We will acknowledge reports, validate the issue, and keep you informed as we work toward a fix. Reports involving user data, credentials, or active exploitation may be prioritized.</p>
        <h2>Responsible testing</h2>
        <p>Do not access, change, or delete data that does not belong to you. Stop testing once a vulnerability is confirmed and keep details private until remediation is complete.</p>
        <h2>Scope</h2>
        <p>This policy covers base31.org and its first-party services. Third-party sites listed in the directory are independently operated and should be reported to their owners.</p>
        <p>The full policy is also available in the repository as <a href="https://github.com/NOTAM-bobk/base31/blob/main/SECURITY.md" target="_blank" rel="noreferrer">SECURITY.md</a>.</p>
      </section>
    </main>
  );
}
