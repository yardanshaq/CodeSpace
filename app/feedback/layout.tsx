import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback — CodeSpace",
  description: "Send feedback or suggestions to CodeSpace",
  openGraph: {
    title: "Feedback — CodeSpace",
    description: "Send feedback or suggestions to CodeSpace",
    url: "https://codespace.yardansh.com/feedback",
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
    title: "Feedback — CodeSpace",
    description: "Send feedback or suggestions to CodeSpace",
    images: ["https://cloud.yardansh.com/iwuopD.png?raw=1"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}