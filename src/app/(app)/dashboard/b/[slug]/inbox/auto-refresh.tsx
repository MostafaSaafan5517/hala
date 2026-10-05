"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_MS = 5000;

/**
 * Picks up new messages and status changes by rendering the page again on the server every few
 * seconds, while the tab is in view. Typed text survives: refreshing keeps client state.
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
