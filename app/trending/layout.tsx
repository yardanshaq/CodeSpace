import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trending Snippets — CodeSpace",
  description: "Discover the most popular snippets on CodeSpace",
  openGraph: {
    title: "Trending Snippets — CodeSpace",
    description: "Discover the most popular snippets on CodeSpace",
    url: "https://codespace.yardansh.com/trending",
    siteName: "CodeSpace",
    images: [
      {
        url: "https://cloud.yardansh.com/iwuopD.png",
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
    title: "Trending Snippets — CodeSpace",
    description: "Discover the most popular snippets on CodeSpace",
    images: ["https://cloud.yardansh.com/iwuopD.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}