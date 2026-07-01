import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Server Status — CodeSpace",
  description: "Real-time server status, database latency, hardware stats, and activity metrics for CodeSpace.",
  openGraph: {
    title: "Server Status — CodeSpace",
    description: "Real-time server status, database latency, hardware stats, and activity metrics for CodeSpace.",
    url: "https://codespace.yardansh.com/stats",
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
    title: "Server Status — CodeSpace",
    description: "Real-time server status, database latency, hardware stats, and activity metrics for CodeSpace.",
    images: ["https://cloud.yardansh.com/iwuopD.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}