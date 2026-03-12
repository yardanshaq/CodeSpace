"use client";

import { useRouter } from "next/navigation";

export function startNavigationLoader() {}
export function stopNavigationLoader()  {}

export function useNavigate() {
  const router = useRouter();
  return (href: string) => router.push(href);
}

export default function NavigationLoader() {
  return null;
}