import HomePage from "@/components/home-page";

// The English homepage. The implementation lives in components/home-page.tsx
// so the translated variants (/es, /fr, /pt) can share it with their own
// dictionaries; a route file must take only Next's PageProps, which is why
// this thin wrapper exists.
export default function Page() {
  return <HomePage />;
}
