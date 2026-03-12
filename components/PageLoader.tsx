"use client";

import { useEffect } from "react";
import { startNavigationLoader, stopNavigationLoader } from "@/components/NavigationLoader";

interface PageLoaderProps {
  timeoutMs?: number;
  label?: string;
}

export default function PageLoader({ }: PageLoaderProps) {
  useEffect(() => {
    startNavigationLoader();
    return () => stopNavigationLoader();
  }, []);

  return null; // visual is handled by the singleton NavigationLoader
}