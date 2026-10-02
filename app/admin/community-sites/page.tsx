import AdminCommunitySites from "@/components/admin-community-sites";

export const metadata = {
  title: "Community site moderation — base31.org",
  robots: { index: false, follow: false },
};

export default function CommunitySitesAdminPage() {
  return <AdminCommunitySites />;
}
