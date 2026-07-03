import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultCatalogUrl, fetchCatalog, type Match } from "../lib/catalog";

type CatalogState = {
  matches: Match[];
  loading: boolean;
  error: string;
  updatedAt: number | null;
  fromCache: boolean;
};

const cacheKey = "busted_minds_sports_catalog_v1";

export function useSportsCatalog(endpoint = defaultCatalogUrl) {
  const [state, setState] = useState<CatalogState>(() => {
    const cached = readCache();
    return {
      matches: cached?.matches ?? [],
      loading: !cached,
      error: "",
      updatedAt: cached?.updatedAt ?? null,
      fromCache: Boolean(cached),
    };
  });

  const refresh = useCallback(
    async (silent = false) => {
      const controller = new AbortController();

      setState((current) => ({
        ...current,
        loading: silent ? current.loading : true,
        error: silent ? current.error : "",
      }));

      try {
        const matches = await fetchCatalog(endpoint, controller.signal);
        const updatedAt = Date.now();
        writeCache({ matches, updatedAt });
        setState({ matches, updatedAt, loading: false, error: "", fromCache: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Catalog request failed";
        setState((current) => ({
          ...current,
          loading: false,
          error: message,
          fromCache: current.matches.length > 0,
        }));
      }

      return () => controller.abort();
    },
    [endpoint],
  );

  useEffect(() => {
    let active = true;

    const tick = async (silent = false) => {
      if (!active) return;
      await refresh(silent);
    };

    void tick(Boolean(readCache()));
    const intervalId = window.setInterval(() => void tick(true), 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
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
