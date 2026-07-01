import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a Snippet — CodeSpace",
  description: "Share your code snippet on CodeSpace",
  openGraph: {
    title: "Post a Snippet — CodeSpace",
    description: "Share your code snippet on CodeSpace",
    url: "https://codespace.yardansh.com/post",
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
    title: "Post a Snippet — CodeSpace",
    description: "Share your code snippet on CodeSpace",
    images: ["https://cloud.yardansh.com/iwuopD.png?raw=1"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}