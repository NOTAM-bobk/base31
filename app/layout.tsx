import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "base31.org",
  description: "Directory of sites on base31.org",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
