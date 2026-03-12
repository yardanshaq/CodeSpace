"use client";

import { useRouter } from "next/navigation";

// Show/hide instant overlay via body class — no React re-render delay
export function startNavigationLoader() {
  document.body.classList.add("nav-loading");
}
export function stopNavigationLoader() {
  document.body.classList.remove("nav-loading");
}

export function useNavigate() {
  const router = useRouter();
  return (href: string) => {
    startNavigationLoader();
    router.push(href);
  };
}

export default function NavigationLoader() {
  return null;
}