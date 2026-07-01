import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users — CodeSpace",
  description: "Browse CodeSpace contributors",
  openGraph: {
    title: "Users — CodeSpace",
    description: "Browse CodeSpace contributors",
    url: "https://codespace.yardansh.com/users",
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
    title: "Users — CodeSpace",
    description: "Browse CodeSpace contributors",
    images: ["https://cloud.yardansh.com/iwuopD.png?raw=1"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}