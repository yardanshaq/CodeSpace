import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — CodeSpace",
  description: "Sign in to your CodeSpace account",
  openGraph: {
    title: "Sign In — CodeSpace",
    description: "Sign in to your CodeSpace account",
    url: "https://codespace.yardansh.com/login",
    siteName: "CodeSpace",
    images: [
      {
        url: "https://cdn.nekohime.site/file/E_fVqMJ-.png",
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
    title: "Sign In — CodeSpace",
    description: "Sign in to your CodeSpace account",
    images: ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}