import type { Metadata } from "next";
import NotFoundClient from "./NotFoundClient";

export const metadata: Metadata = {
  title: "404 – Page Not Found | CodeSpace",
  description: "The page you're looking for doesn't exist or has been moved.",
  openGraph: {
    title: "404 – Page Not Found | CodeSpace",
    description: "The page you're looking for doesn't exist or has been moved.",
    url: "https://codespace.yardansh.com",
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
    title: "404 – Page Not Found | CodeSpace",
    description: "The page you're looking for doesn't exist or has been moved.",
    images: ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return <NotFoundClient />;
}