import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSportScoreBracket,
  fetchSportScoreLeaders,
  fetchSportScoreMatchDetail,
  fetchSportScoreSlate,
  fetchSportScoreStandings,
  fetchSportScoreTeamSchedule,
  type SportScoreBracket,
  type SportScoreLeaders,
  type SportScoreMatch,
  type SportScoreMatchDetail,
  type SportScoreStandings,
  type SportScoreTeamSchedule,
} from "../lib/sportscore";

type SportScoreState = {
  matches: SportScoreMatch[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  updatedAt: number | null;
  fromCache: boolean;
};

const cacheKey = "busted_minds_sportscore_v2";
const insightCacheKey = "busted_minds_score_insights_v1";
const refreshIntervalMs = 90_000;

export function useSportScore() {
  const [state, setState] = useState<SportScoreState>(() => {
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

  const refresh = useCallback(async (silent = false) => {
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
      const slate = await fetchSportScoreSlate(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;

      writeCache({ matches: slate.matches, updatedAt: slate.updatedAt });
      setState({
        matches: slate.matches,
        updatedAt: slate.updatedAt,
        loading: false,
        refreshing: false,
        error: "",
        fromCache: false,
      });
    } catch (error) {
      if (controller.signal.aborted || !mountedRef.current) return;

      const message = error instanceof Error ? error.message : "Scores request failed";
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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const tick = async (silent = false) => {
      if (!active) return;
      await refresh(silent);
    };

    void tick(Boolean(readCache()));
    const intervalId = window.setInterval(() => void tick(true), refreshIntervalMs);

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

export type SportScoreInsight = {
  detail: SportScoreMatchDetail | null;
  standings: SportScoreStandings | null;
  goalLeaders: SportScoreLeaders | null;
  assistLeaders: SportScoreLeaders | null;
  homeSchedule: SportScoreTeamSchedule | null;
  awaySchedule: SportScoreTeamSchedule | null;
  bracket: SportScoreBracket | null;
  updatedAt: number;
};

type SportScoreInsightState = {
  insight: SportScoreInsight | null;
  loading: boolean;
  error: string;
  fromCache: boolean;
};

export function useSportScoreInsight(match: SportScoreMatch | null) {
  const [state, setState] = useState<SportScoreInsightState>(() => ({
    insight: null,
    loading: false,
    error: "",
    fromCache: false,
  }));
  const mountedRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      if (!match) {
        setState({ insight: null, loading: false, error: "", fromCache: false });
        return;
      }

      const key = insightKey(match);
      const cached = readInsightCache(key);
      if (cached && !silent) {
        setState({ insight: cached, loading: true, error: "", fromCache: true });
      } else {
        setState((current) => ({
          ...current,
          loading: !silent,
          error: silent ? current.error : "",
        }));
      }

      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const [
          detailResult,
          standingsResult,
          goalsResult,
          assistsResult,
          homeScheduleResult,
          awayScheduleResult,
          bracketResult,
        ] = await Promise.allSettled([
          fetchSportScoreMatchDetail(match, controller.signal),
          fetchSportScoreStandings(match.sport, match.competitionSlug, controller.signal),
          fetchSportScoreLeaders(match.sport, match.competitionSlug, "goals", controller.signal),
          fetchSportScoreLeaders(match.sport, match.competitionSlug, "assists", controller.signal),
          fetchSportScoreTeamSchedule(match.sport, match.homeTeamSlug, controller.signal),
          fetchSportScoreTeamSchedule(match.sport, match.awayTeamSlug, controller.signal),
          fetchSportScoreBracket(match.sport, match.competitionSlug, controller.signal),
        ]);
        if (controller.signal.aborted || !mountedRef.current) return;

        const insight: SportScoreInsight = {
          detail: fulfilledValue(detailResult),
          standings: fulfilledValue(standingsResult),
          goalLeaders: fulfilledValue(goalsResult),
          assistLeaders: fulfilledValue(assistsResult),
          homeSchedule: fulfilledValue(homeScheduleResult),
          awaySchedule: fulfilledValue(awayScheduleResult),
          bracket: fulfilledValue(bracketResult),
          updatedAt: Date.now(),
        };

        writeInsightCache(key, insight);
        setState({ insight, loading: false, error: "", fromCache: false });
      } catch (error) {
        if (controller.signal.aborted || !mountedRef.current) return;
        const message = error instanceof Error ? error.message : "Score details request failed";
        setState({
          insight: cached,
          loading: false,
          error: message,
          fromCache: Boolean(cached),
        });
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [match],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void refresh(false);
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
    const parsed = JSON.parse(rawValue) as { matches?: SportScoreMatch[]; updatedAt?: number };
    if (!Array.isArray(parsed.matches) || !parsed.updatedAt) return null;
    return { matches: parsed.matches, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function writeCache(payload: { matches: SportScoreMatch[]; updatedAt: number }) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    return;
  }
}

function fulfilledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}

function insightKey(match: SportScoreMatch) {
  return `${match.sport}:${match.slug}`;
}

function readInsightCache(key: string) {
  try {
    const rawValue = window.localStorage.getItem(insightCacheKey);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Record<string, SportScoreInsight>;
    return parsed[key] ?? null;
  } catch {
    return null;
  }
}

function writeInsightCache(key: string, insight: SportScoreInsight) {
  try {
    const rawValue = window.localStorage.getItem(insightCacheKey);
    const parsed = rawValue ? (JSON.parse(rawValue) as Record<string, SportScoreInsight>) : {};
    const entries = Object.entries({ ...parsed, [key]: insight }).slice(-16);
    window.localStorage.setItem(insightCacheKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
}
