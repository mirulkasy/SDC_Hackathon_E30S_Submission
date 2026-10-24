"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { startPageTransition } from "@/components/PageTransition";

export default function useSplashRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href, opts) => {
        startPageTransition(href);
        router.push(href, opts);
      },
      replace: (href, opts) => {
        startPageTransition(href);
        router.replace(href, opts);
      },
    }),
    [router],
  );
}