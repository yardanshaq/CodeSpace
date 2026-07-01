import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — CodeSpace",
  description: "Manage your CodeSpace account settings",
  openGraph: {
    title: "Settings — CodeSpace",
    description: "Manage your CodeSpace account settings",
    url: "https://codespace.yardansh.com/settings",
    siteName: "CodeSpace",
    images: [
      {
        url: "https://cloud.yardansh.com/iwuopD.png?raw=1",
        width: 1280,
        height: 640,
        alt: "CodeSpace Cover",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Settings — CodeSpace",
    description: "Manage your CodeSpace account settings",
    images: ["https://cloud.yardansh.com/iwuopD.png?raw=1"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}