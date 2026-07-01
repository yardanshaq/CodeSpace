import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register — CodeSpace",
  description: "Create a new CodeSpace account",
  openGraph: {
    title: "Register — CodeSpace",
    description: "Create a new CodeSpace account",
    url: "https://codespace.yardansh.com/register",
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
    title: "Register — CodeSpace",
    description: "Create a new CodeSpace account",
    images: ["https://cloud.yardansh.com/iwuopD.png?raw=1"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}