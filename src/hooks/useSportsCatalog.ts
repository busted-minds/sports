import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultCatalogUrl, fetchCatalog, type Match } from "../lib/catalog";

type CatalogState = {
  matches: Match[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  updatedAt: number | null;
  fromCache: boolean;
};

const cacheKey = "busted_minds_sports_catalog_v7";

export function useSportsCatalog(endpoint = defaultCatalogUrl) {
  const [state, setState] = useState<CatalogState>(() => {
    const cached = readCache();
    return {
      matches: cached?.matches ?? [],
      loading: !cached,
      refreshing: false,
      error: "",
      updatedAt: cached?.updatedAt ?? null,
      fromCache: Boolean(cached),
    };
  });
  const mountedRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      setState((current) => ({
        ...current,
        loading: silent ? current.loading : true,
        refreshing: true,
        error: silent ? current.error : "",
      }));

      try {
        const matches = await fetchCatalog(endpoint, controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;

        const updatedAt = Date.now();
        writeCache({ matches, updatedAt });
        setState({ matches, updatedAt, loading: false, refreshing: false, error: "", fromCache: false });
      } catch (error) {
        if (controller.signal.aborted || !mountedRef.current) return;

        const message = error instanceof Error ? error.message : "Catalog request failed";
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: message,
          fromCache: current.matches.length > 0,
        }));
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [endpoint],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const tick = async (silent = false) => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        await refresh(silent);
      } finally {
        inFlight = false;
      }
    };

    const refreshIfActive = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      void tick(true);
    };

    void tick(Boolean(readCache()));
    const intervalId = window.setInterval(refreshIfActive, 60_000);
    document.addEventListener("visibilitychange", refreshIfActive);
    window.addEventListener("online", refreshIfActive);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfActive);
      window.removeEventListener("online", refreshIfActive);
    };
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [refresh, state],
  );
}

function readCache() {
  try {
    const rawValue = window.localStorage.getItem(cacheKey);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as { matches?: Match[]; updatedAt?: number };
    if (!Array.isArray(parsed.matches) || !parsed.updatedAt) return null;
    return { matches: parsed.matches, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function writeCache(payload: { matches: Match[]; updatedAt: number }) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    return;
  }
}
