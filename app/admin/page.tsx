import type { Metadata } from "next";
import SubscriberAdmin from "@/components/subscriber-admin";

export const metadata: Metadata = { title: "Subscriber admin — base31", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <main className="subscriber-admin"><a href="/" className="text-link">← Back to the directory</a><p className="eyebrow mono">operator workspace</p><h1>Email subscribers.</h1><p className="subtitle">Private subscriber list. Use your Worker’s subscriber admin secret to unlock it.</p><SubscriberAdmin /></main>;
}
