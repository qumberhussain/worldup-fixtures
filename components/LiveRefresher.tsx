"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounted only on live match pages. Periodically calls router.refresh(), which
 * re-runs the server component and streams updated RSC — so the server-rendered
 * score + event timeline update in place, with no client-side data layer and no
 * polling JS shipped to non-live pages.
 */
export default function LiveRefresher({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh();
    };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return null;
}
