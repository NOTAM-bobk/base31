import { redirect } from "next/navigation";

export const metadata = { title: "Admin — base31.org", robots: { index: false, follow: false } };

export default function AdminPage() {
  redirect("/admin/community-sites");
}
