/**
 * useBreakpoint — React hook for responsive breakpoint detection.
 *
 * Returns: { isMobile, isTablet, isDesktop }
 *   isMobile: <= 640px
 *   isTablet: 641–1024px
 *   isDesktop: > 1024px
 */

import { useEffect, useState } from "react";

const MOBILE = 640;
const TABLET = 1024;

export default function useBreakpoint() {
  const [bp, setBp] = useState(() => {
    if (typeof window === "undefined") return { isMobile: false, isTablet: false, isDesktop: true };
    const w = window.innerWidth;
    return { isMobile: w <= MOBILE, isTablet: w > MOBILE && w <= TABLET, isDesktop: w > TABLET };
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setBp({
        isMobile: w <= MOBILE,
        isTablet: w > MOBILE && w <= TABLET,
        isDesktop: w > TABLET,
      });
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return bp;
}
