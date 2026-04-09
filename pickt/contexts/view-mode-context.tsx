"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type ViewMode =
  | "stack"
  | "carousel"
  | "matrix"
  | "tinder"
  | "compact"
  | "focus";

const ALL_MODES: ViewMode[] = [
  "stack",
  "carousel",
  "matrix",
  "tinder",
  "compact",
  "focus",
];

const STORAGE_KEY = "pickt_view_mode";

function isViewMode(v: string | null): v is ViewMode {
  return v != null && ALL_MODES.includes(v as ViewMode);
}

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
};

const ViewModeContext = createContext<ViewModeContextValue>({
  viewMode: "stack",
  setViewMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    // Priority: URL param > localStorage > default
    const urlParam = searchParams.get("view");
    if (isViewMode(urlParam)) return urlParam;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isViewMode(stored)) return stored;
    }
    return "stack";
  });

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      localStorage.setItem(STORAGE_KEY, mode);
      // Update URL query param
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", mode);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Sync URL param on mount if missing
  useEffect(() => {
    const urlParam = searchParams.get("view");
    if (!isViewMode(urlParam)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", viewMode);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
