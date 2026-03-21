"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { enforcePortraitMode } from "@/lib/room-orientation";

const isRoomRoute = (pathname: string | null) =>
  Boolean(pathname && /^\/room\/[^/]+$/.test(pathname));

export function RouteOrientationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (isRoomRoute(pathname)) return;
    void enforcePortraitMode();
  }, [pathname]);

  return null;
}
