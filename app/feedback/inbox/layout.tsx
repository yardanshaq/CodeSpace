import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback Inbox — CodeSpace",
  description: "Admin feedback inbox for CodeSpace",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}