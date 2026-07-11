import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  Server,
  Share2,
  ShieldCheck,
  Trophy,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import type { ComponentType, CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "./components/Player";
import { useSportScore, useSportScoreInsight, type SportScoreInsight } from "./hooks/useSportScore";
import { useSportsCatalog } from "./hooks/useSportsCatalog";
import type { Match, StreamSource } from "./lib/catalog";
import {
  findSportScoreForMatch,
  isMainSportScoreMatch,
  scoreMatchPriority,
  sportScoreLine,
  sportScoreSports,
  teamNamesMatch,
  type LeaderStat,
  type SportScoreIncident,
  type SportScoreLeader,
  type SportScoreLineupPlayer,
  type SportScoreLineups,
  type SportScoreMatch,
  type SportScoreSport,
  type SportScoreStandingRow,
} from "./lib/sportscore";

const parentLogoUrl = "/Busted-Minds-Logo.png";
const sportsLogoUrl = "/busted-minds-sports-logo.png";
const footballIconUrl = "/icons/sport-football.png";
const baseballIconUrl = "/icons/sport-baseball.png";
const basketballIconUrl = "/icons/sport-basketball.png";
const fightIconUrl = "/icons/sport-fight.png";
const cricketIconUrl = "/icons/sport-cricket.png";
const tennisIconUrl = "/icons/sport-tennis.png";
const volleyballIconUrl = "/icons/sport-volleyball.png";
const genericSportIconUrl = "/icons/sport-generic.png";
const homeThumbnailUrl = "/home-thumbnail.png";
const lowerPriorityHosts = [
  "dami-tv.pro",
  "daddylive.dad",
  "daddylivehd.sx",
  "fuck-you.kasin-tv.com",
  "kasintv",
  "kasintv2",
];
const lowerPrioritySourceNames = ["fancode"];
const defaultSportKey = "football";
const featuredSportKeys = ["football", "baseball", "basketball", "fight", "cricket", "tennis", "volleyball"];
type PageMode = "home" | "slate" | "scores";
type StatusFilter = "all" | "live" | "upcoming";
type NavigableStatus = Extract<StatusFilter, "live" | "upcoming">;
type SearchScopeKey =
  | "all"
  | "live"
  | "upcoming"
  | "football"
  | "baseball"
  | "basketball"
  | "fight"
  | "cricket"
  | "tennis"
  | "volleyball";
type SlateStats = {
  live: number;
  upcoming: number;
  servers: number;
  primarySources: number;
};
type SportSummary = {
  key: string;
  label: string;
  total: number;
  live: number;
  upcoming: number;
  servers: number;
};
type AppIcon = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;
type HeaderSportSummary = SportSummary & { iconSrc: string; accent: string };
type SeoRouteKey =
  | "home"
  | "live"
  | "schedule"
  | "scores"
  | "football"
  | "baseball"
  | "basketball"
  | "fight"
  | "cricket"
  | "tennis"
  | "volleyball";
type SeoRoute = {
  key: SeoRouteKey;
  path: string;
  pageMode: PageMode;
  sportFilter: string;
  statusFilter: StatusFilter;
  title: string;
  description: string;
};

const siteBaseUrl = "https://sports.bustedminds.us.kg";
const seoRoutes: Record<SeoRouteKey, SeoRoute> = {
  home: {
    key: "home",
    path: "/",
    pageMode: "home",
    sportFilter: "all",
    statusFilter: "all",
    title: "Live Sports Streams, Scores & Match Schedule | Busted Minds Sports",
    description:
      "Busted Minds Sports brings live football, baseball, basketball, fight, cricket, tennis and volleyball streams, match schedules, live scores, and multi-feed game coverage into one fast sports hub.",
  },
  live: {
    key: "live",
    path: "/live",
    pageMode: "slate",
    sportFilter: "all",
    statusFilter: "live",
    title: "Live Sports Streams Today | Busted Minds Sports",
    description:
      "Watch live football, baseball, basketball, fight, cricket, tennis and volleyball streams with available feeds, game status, stream health signals, and quick access to live match coverage.",
  },
  schedule: {
    key: "schedule",
    path: "/schedule",
    pageMode: "slate",
    sportFilter: "all",
    statusFilter: "upcoming",
    title: "Sports Match Schedule & Upcoming Games | Busted Minds Sports",
    description:
      "See upcoming football, baseball, basketball, fight, cricket, tennis and volleyball fixtures, match times, and leagues before the next game goes live.",
  },
  scores: {
    key: "scores",
    path: "/scores",
    pageMode: "scores",
    sportFilter: "all",
    statusFilter: "all",
    title: "Live Scores, Results & Fixtures | Busted Minds Sports",
    description:
      "Follow live scores, final results, fixtures, standings, leaders, and match insights across football, basketball, cricket, and tennis.",
  },
  football: {
    key: "football",
    path: "/football",
    pageMode: "slate",
    sportFilter: "football",
    statusFilter: "all",
    title: "Football Live Streams, Scores & Fixtures | Busted Minds Sports",
    description:
      "Find football live streams, match feeds, scorelines, upcoming fixtures, and league coverage from Busted Minds Sports.",
  },
  baseball: {
    key: "baseball",
    path: "/baseball",
    pageMode: "slate",
    sportFilter: "baseball",
    statusFilter: "all",
    title: "Baseball Live Streams & MLB Fixtures | Busted Minds Sports",
    description:
      "Find baseball live streams, MLB match feeds, upcoming fixtures, and available game coverage from Busted Minds Sports.",
  },
  basketball: {
    key: "basketball",
    path: "/basketball",
    pageMode: "slate",
    sportFilter: "basketball",
    statusFilter: "all",
    title: "Basketball Live Streams, NBA & WNBA Fixtures | Busted Minds Sports",
    description:
      "Find basketball live streams, NBA and WNBA match feeds, upcoming fixtures, and available game coverage from Busted Minds Sports.",
  },
  fight: {
    key: "fight",
    path: "/fight",
    pageMode: "slate",
    sportFilter: "fight",
    statusFilter: "all",
    title: "Fight Live Streams, WWE & AEW Schedule | Busted Minds Sports",
    description:
      "Find fight live streams, WWE, AEW and wrestling match feeds, upcoming events, and available coverage from Busted Minds Sports.",
  },
  cricket: {
    key: "cricket",
    path: "/cricket",
    pageMode: "slate",
    sportFilter: "cricket",
    statusFilter: "all",
    title: "Cricket Live Streams, Scores & Fixtures | Busted Minds Sports",
    description:
      "Find cricket live streams, match feeds, scores, schedules, and competition coverage from Busted Minds Sports.",
  },
  tennis: {
    key: "tennis",
    path: "/tennis",
    pageMode: "slate",
    sportFilter: "tennis",
    statusFilter: "all",
    title: "Tennis Live Streams, Matches & Schedule | Busted Minds Sports",
    description:
      "Find tennis live streams, tournament match feeds, upcoming fixtures, and available court coverage from Busted Minds Sports.",
  },
  volleyball: {
    key: "volleyball",
    path: "/volleyball",
    pageMode: "slate",
    sportFilter: "volleyball",
    statusFilter: "all",
    title: "Volleyball Live Streams, Matches & Schedule | Busted Minds Sports",
    description:
      "Find volleyball live streams, league and tournament match feeds, upcoming fixtures, and available coverage from Busted Minds Sports.",
  },
};

export default function App() {
  const initialSeoRoute = useMemo(() => seoRouteFromPath(currentPathname()), []);
  const { matches, loading, error, updatedAt, fromCache, refresh } = useSportsCatalog();
  const {
    matches: scoreMatches,
    loading: scoresLoading,
    error: scoresError,
    updatedAt: scoresUpdatedAt,
    fromCache: scoresFromCache,
    refresh: refreshScores,
  } = useSportScore();
  const [selectedId, setSelectedId] = useState("");
  const [requestedMatchId, setRequestedMatchId] = useState(() => currentMatchIdFromUrl());
  const [sourceIndex, setSourceIndex] = useState(0);
  const [shareFeedback, setShareFeedback] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sportsMenuOpen, setSportsMenuOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState(initialSeoRoute.sportFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialSeoRoute.statusFilter);
  const [pageMode, setPageMode] = useState<PageMode>(initialSeoRoute.pageMode);
  const playerSectionRef = useRef<HTMLDivElement | null>(null);
  const sportsMenuRef = useRef<HTMLDivElement | null>(null);
  const headerSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

  const games = useMemo(
    () => matches.filter((match) => match.status === "live" || match.status === "upcoming"),
    [matches],
  );
  const slateStats = useMemo<SlateStats>(() => {
    return games.reduce(
      (stats, match) => {
        if (match.status === "live") stats.live += 1;
        if (match.status === "upcoming") stats.upcoming += 1;
        if (isStreamSelectable(match)) {
          stats.servers += match.sources.length;
          stats.primarySources += match.sources.filter((source) => sourceRank(source) < 4).length;
        }
        return stats;
      },
      { live: 0, upcoming: 0, servers: 0, primarySources: 0 },
    );
  }, [games]);
  const sportSummaries = useMemo(() => {
    const bySport = new Map<string, SportSummary>();

    for (const match of games) {
      const current = bySport.get(match.sportKey) ?? {
        key: match.sportKey,
        label: match.sportLabel,
        total: 0,
        live: 0,
        upcoming: 0,
        servers: 0,
      };
      current.total += 1;
      if (isStreamSelectable(match)) current.servers += match.sources.length;
      if (match.status === "live") current.live += 1;
      if (match.status === "upcoming") current.upcoming += 1;
      bySport.set(match.sportKey, current);
    }

    return bySport;
  }, [games]);
  const sportOptions = useMemo(() => {
    const options = Array.from(sportSummaries.values())
      .map((sport) => ({ key: sport.key, label: sport.label, count: sport.total }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return [{ key: "all", label: "All", count: games.length }, ...options];
  }, [games.length, sportSummaries]);
  const sportFocusItems = useMemo(
    () => [
      {
        ...sportSummaryOrFallback("football", "Football", sportSummaries),
        iconSrc: footballIconUrl,
        accent: "football",
      },
      {
        ...sportSummaryOrFallback("baseball", "Baseball", sportSummaries),
        iconSrc: baseballIconUrl,
        accent: "baseball",
      },
      {
        ...sportSummaryOrFallback("basketball", "Basketball", sportSummaries),
        iconSrc: basketballIconUrl,
        accent: "basketball",
      },
      {
        ...sportSummaryOrFallback("fight", "Fight", sportSummaries),
        iconSrc: fightIconUrl,
        accent: "fight",
      },
      {
        ...sportSummaryOrFallback("cricket", "Cricket", sportSummaries),
        iconSrc: cricketIconUrl,
        accent: "cricket",
      },
      {
        ...sportSummaryOrFallback("tennis", "Tennis", sportSummaries),
        iconSrc: tennisIconUrl,
        accent: "tennis",
      },
      {
        ...sportSummaryOrFallback("volleyball", "Volleyball", sportSummaries),
        iconSrc: volleyballIconUrl,
        accent: "volleyball",
      },
    ],
    [sportSummaries],
  );
  const searchQuery = searchTerm.trim();
  const normalizedSearch = normalizeSearchValue(searchQuery);
  const pageGames = useMemo(() => {
    return games.filter((match) => {
      if (sportFilter !== "all" && match.sportKey !== sportFilter) return false;
      if (statusFilter !== "all" && match.status !== statusFilter) return false;
      return true;
    });
  }, [games, sportFilter, statusFilter]);
  const globalSearchGames = useMemo(() => {
    if (!normalizedSearch) return [];
    return games.filter((match) => matchMatchesSearch(match, normalizedSearch));
  }, [games, normalizedSearch]);
  const searchStats = useMemo(() => searchResultStats(globalSearchGames), [globalSearchGames]);
  const filteredGames = useMemo(() => {
    if (!normalizedSearch) return pageGames;
    return pageGames.filter((match) => matchMatchesSearch(match, normalizedSearch));
  }, [normalizedSearch, pageGames]);
  const liveGames = useMemo(
    () => games.filter(isStreamSelectable),
    [games],
  );
  const upcomingGames = useMemo(
    () => games.filter((match) => match.status === "upcoming").slice(0, 6),
    [games],
  );
  const selectedMatch = useMemo(
    () => games.find((match) => match.id === selectedId && isStreamSelectable(match)) ?? null,
    [games, selectedId],
  );
  const orderedFilteredGames = useMemo(() => {
    if (!selectedMatch) return filteredGames;

    const selectedIndex = filteredGames.findIndex((match) => match.id === selectedMatch.id);
    if (selectedIndex <= 0) return filteredGames;

    const selectedGame = filteredGames[selectedIndex];
    if (!selectedGame) return filteredGames;

    return [
      selectedGame,
      ...filteredGames.slice(0, selectedIndex),
      ...filteredGames.slice(selectedIndex + 1),
    ];
  }, [filteredGames, selectedMatch]);
  const selectedScoreMatch = useMemo(
    () => findSportScoreForMatch(selectedMatch, scoreMatches),
    [scoreMatches, selectedMatch],
  );
  const selectedSource = selectedMatch?.sources[sourceIndex] ?? selectedMatch?.sources[0] ?? null;
  const hasNextSource = (selectedMatch?.sources.length ?? 0) > 1;
  const searchActive = Boolean(normalizedSearch);
  const homePageActive = pageMode === "home";
  const livePageActive = pageMode === "slate" && sportFilter === "all" && statusFilter === "live";
  const schedulePageActive = pageMode === "slate" && sportFilter === "all" && statusFilter === "upcoming";
  const scoresPageActive = pageMode === "scores";
  const sportsPageActive = pageMode === "slate" && statusFilter === "all" && featuredSportKeys.includes(sportFilter);
  const activeSportSummary = sportsPageActive
    ? sportFocusItems.find((sport) => sport.key === sportFilter) ?? null
    : null;
  const mobileMoreActive = sportsPageActive || schedulePageActive;
  const queueTitle = pageQueueTitle(sportFilter, statusFilter, sportSummaries);
  const pageScope = pageScopeLabel(sportFilter, statusFilter, sportSummaries);
  const currentSeoRoute = useMemo(
    () => seoRouteFromState(pageMode, sportFilter, statusFilter),
    [pageMode, sportFilter, statusFilter],
  );

  useEffect(() => {
    if (!sportsMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!sportsMenuRef.current?.contains(target)) setSportsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [sportsMenuOpen]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSearchOpen(false);
        setMobileMoreOpen(false);
        setSportsMenuOpen(false);
        return;
      }

      if (event.key !== "/" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      if (window.matchMedia("(max-width: 820px)").matches) {
        setMobileMoreOpen(false);
        setSportsMenuOpen(false);
        setMobileSearchOpen(true);
        window.requestAnimationFrame(() => mobileSearchRef.current?.focus());
        return;
      }

      headerSearchRef.current?.focus();
    };

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    applyDocumentSeo(currentSeoRoute);
  }, [currentSeoRoute]);

  useEffect(() => {
    if (!games.length) {
      if (selectedId) setSelectedId("");
      return;
    }

    const visibleGames = searchActive ? games : pageGames.length ? pageGames : games;
    const selectableGames = visibleGames.filter(isStreamSelectable);
    const requestedMatch = requestedMatchId
      ? selectableGames.find((match) => match.id === requestedMatchId)
      : null;
    if (requestedMatch) {
      if (selectedId !== requestedMatch.id) setSelectedId(requestedMatch.id);
      return;
    }
    if (selectedId && selectableGames.some((match) => match.id === selectedId)) return;

    const nextMatch = pickPreferredMatch(selectableGames, defaultSportKey);
    if (nextMatch) setSelectedId(nextMatch.id);
    else if (selectedId) setSelectedId("");
  }, [games, pageGames, requestedMatchId, searchActive, selectedId]);

  useEffect(() => {
    setShareFeedback("");
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (sportFilter === "all") return;
    if (featuredSportKeys.includes(sportFilter)) return;
    if (!sportOptions.some((sport) => sport.key === sportFilter)) setSportFilter("all");
  }, [sportFilter, sportOptions]);

  useEffect(() => {
    if (!selectedMatch) {
      setSourceIndex(0);
      return;
    }

    const preferredIndex = preferredSourceIndex(selectedMatch);
    setSourceIndex((currentIndex) => {
      const currentSource = selectedMatch.sources[currentIndex];
      const preferredSource = selectedMatch.sources[preferredIndex];
      if (!currentSource || !preferredSource) return preferredIndex;
      return sourceRank(currentSource) > sourceRank(preferredSource) ? preferredIndex : currentIndex;
    });
  }, [selectedMatch]);

  useEffect(() => {
    if (!selectedMatch) return;
    if (sourceIndex >= selectedMatch.sources.length) setSourceIndex(preferredSourceIndex(selectedMatch));
  }, [selectedMatch, sourceIndex]);

  const useNextSource = () => {
    if (!selectedMatch?.sources.length) return;
    setSourceIndex((currentIndex) => (currentIndex + 1) % selectedMatch.sources.length);
  };

  const routeMatchId = (route: SeoRoute) => {
    if (route.pageMode !== "slate") return "";
    const routeGames = games.filter((match) => {
      if (route.sportFilter !== "all" && match.sportKey !== route.sportFilter) return false;
      if (route.statusFilter !== "all" && match.status !== route.statusFilter) return false;
      return isStreamSelectable(match);
    });
    const preferredSport = route.sportFilter === "all" ? defaultSportKey : route.sportFilter;
    return pickPreferredMatch(routeGames, preferredSport)?.id ?? "";
  };

  const applySeoRouteState = (route: SeoRoute, matchId = "") => {
    setPageMode(route.pageMode);
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportsMenuOpen(false);
    setSportFilter(route.sportFilter);
    setStatusFilter(route.statusFilter);
    setRequestedMatchId(matchId);
    setSelectedId(matchId || routeMatchId(route));
  };

  const openSeoRoute = (routeKey: SeoRouteKey) => {
    const route = seoRoutes[routeKey];
    writeBrowserRoute(route, "push");
    applySeoRouteState(route);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportsMenuOpen(false);
  };

  const applySearchScope = (scope: SearchScopeKey) => {
    setPageMode("slate");
    setMobileMoreOpen(false);
    setSportsMenuOpen(false);

    if (scope === "all") {
      setSportFilter("all");
      setStatusFilter("all");
      return;
    }

    if (scope === "live" || scope === "upcoming") {
      setSportFilter("all");
      setStatusFilter(scope);
      return;
    }

    setSportFilter(scope);
    setStatusFilter("all");
  };

  const openHome = () => {
    openSeoRoute("home");
  };

  const openStatusPage = (nextStatus: NavigableStatus) => {
    openSeoRoute(nextStatus === "live" ? "live" : "schedule");
  };

  const openScores = () => {
    openSeoRoute("scores");
  };

  const openMatch = (match: Match) => {
    if (!isStreamSelectable(match)) return;

    writeBrowserRoute(seoRoutes.live, "push", match.id);
    setRequestedMatchId(match.id);
    setSelectedId(match.id);
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportsMenuOpen(false);
    setStatusFilter("live");
    setSportFilter("all");
    setPageMode("slate");
    showPlayerOnMobile();
  };

  const selectMatchFromList = (match: Match) => {
    if (!isStreamSelectable(match)) return;

    const browserRoute = seoRouteFromPath(currentPathname());
    if (browserRoute.pageMode === "slate") {
      writeBrowserRoute(browserRoute, "replace", match.id);
    } else {
      writeBrowserRoute(seoRoutes.live, "replace", match.id);
      setStatusFilter("live");
      setSportFilter("all");
    }
    setRequestedMatchId(match.id);
    setSelectedId(match.id);
    showPlayerOnMobile();
  };

  const shareSelectedMatch = async () => {
    if (!selectedMatch || typeof window === "undefined") return;

    const shareUrl = new URL(seoRoutes.live.path, window.location.origin);
    shareUrl.searchParams.set("match", selectedMatch.id);
    const shareData = {
      title: `${matchTitle(selectedMatch)} | Busted Minds Sports`,
      text: `Watch ${matchTitle(selectedMatch)} on Busted Minds Sports.`,
      url: shareUrl.toString(),
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        setShareFeedback("Shared");
        return;
      }

      await navigator.clipboard.writeText(shareData.url);
      setShareFeedback("Copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareFeedback(copyTextFallback(shareData.url) ? "Copied" : "Copy failed");
    }
  };

  const showPlayerOnMobile = () => {
    if (!window.matchMedia("(max-width: 820px)").matches) return;
    window.requestAnimationFrame(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openSport = (sportKey: string) => {
    openSeoRoute(sportRouteForKey(sportKey).key);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      applySeoRouteState(seoRouteFromPath(currentPathname()), currentMatchIdFromUrl());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  const handleSearchChange = (value: string) => {
    const nextSearchActive = Boolean(value.trim());
    const wasSearchActive = Boolean(searchTerm.trim());
    setSearchTerm(value);
    if (nextSearchActive) {
      setPageMode("slate");
      setMobileMoreOpen(false);
      setSportsMenuOpen(false);
      if (!wasSearchActive) {
        setSportFilter("all");
        setStatusFilter("all");
      }
    }
  };
  const toggleMobileSearch = () => {
    setMobileMoreOpen(false);
    setSportsMenuOpen(false);
    setMobileSearchOpen((isOpen) => !isOpen);
  };
  const toggleMobileMore = () => {
    setMobileSearchOpen(false);
    setSportsMenuOpen(false);
    setMobileMoreOpen((isOpen) => !isOpen);
  };
  const toggleSportsMenu = () => {
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportsMenuOpen((isOpen) => !isOpen);
  };
  const selectedHeaderAccent = selectedMatch ? sportAccent(selectedMatch.sportKey) : "generic";
  const selectedSportIcon = selectedMatch ? sportIconForKey(selectedMatch.sportKey) : "";
  const playerStatusLabel = selectedMatch?.status === "live" ? "Live" : "No stream";

  return (
    <div className={searchActive ? "app-shell is-searching" : "app-shell"}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand-lockup">
          <a
            className="brand"
            href="/"
            aria-label="Busted Minds Sports home"
            onClick={(event) => {
              event.preventDefault();
              openHome();
            }}
          >
            <BrandWordmark />
          </a>
        </div>

        <div className="topbar-workspace" aria-label="Main navigation and sport pages">
          <div className="header-primary-nav">
            <div className="header-status-strip" role="group" aria-label="Main pages">
              <HeaderNavButton
                icon={HomeNavIcon}
                label="Home"
                href={seoRoutes.home.path}
                active={homePageActive}
                onClick={openHome}
              />
              <HeaderNavButton
                icon={LiveNavIcon}
                label="Live"
                href={seoRoutes.live.path}
                active={livePageActive}
                onClick={() => openStatusPage("live")}
              />
              <HeaderNavButton
                icon={NextNavIcon}
                label="Schedule"
                href={seoRoutes.schedule.path}
                active={schedulePageActive}
                onClick={() => openStatusPage("upcoming")}
              />
              <HeaderNavButton
                icon={Activity}
                label="Scores"
                href={seoRoutes.scores.path}
                active={scoresPageActive}
                onClick={openScores}
              />
            </div>

            <HeaderSportsMenu
              sports={sportFocusItems}
              activeSportKey={sportsPageActive ? sportFilter : ""}
              activeSport={activeSportSummary}
              open={sportsMenuOpen}
              menuRef={sportsMenuRef}
              onToggle={toggleSportsMenu}
              onSelect={openSport}
            />
          </div>

          <label className="search-box header-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={headerSearchRef}
              type="search"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search teams, leagues"
              aria-label="Search games"
              autoComplete="off"
              enterKeyHint="search"
              aria-keyshortcuts="/"
            />
            {searchTerm ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : (
              <kbd className="search-shortcut" aria-hidden="true">
                /
              </kbd>
            )}
          </label>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={mobileSearchOpen || searchActive ? "icon-button mobile-search-button is-active" : "icon-button mobile-search-button"}
            onClick={toggleMobileSearch}
            title="Search games"
            aria-label={searchActive ? `Search games, ${filteredGames.length} results` : "Search games"}
            aria-expanded={mobileSearchOpen}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        </div>

        {mobileSearchOpen ? (
          <div className="mobile-search-panel">
            <label className="search-box mobile-search-box">
              <Search size={16} aria-hidden="true" />
              <input
                ref={mobileSearchRef}
                type="search"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setMobileSearchOpen(false);
                }}
                placeholder="Search teams, leagues"
                aria-label="Search games"
                autoFocus
                autoComplete="off"
                enterKeyHint="search"
              />
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  if (searchTerm) {
                    setSearchTerm("");
                  } else {
                    setMobileSearchOpen(false);
                  }
                }}
                aria-label={searchTerm ? "Clear search" : "Close search"}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </label>
            {searchActive ? (
              <div className="mobile-search-feedback" aria-live="polite">
                <span>{filteredGames.length} results</span>
                <small>{pageScope}</small>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
        <section className="content-area">
          {error || fromCache ? (
            <CatalogNotice
              error={error}
              fromCache={fromCache}
              updatedAt={updatedAt}
              onRefresh={() => void refresh(false)}
            />
          ) : null}

          {pageMode === "home" ? (
            <HomePage
              games={games}
              loading={loading}
              slateStats={slateStats}
              scoreMatches={scoreMatches}
              liveGames={liveGames}
              upcomingGames={upcomingGames}
              sportFocusItems={sportFocusItems}
              onOpenStatus={openStatusPage}
              onSelectMatch={openMatch}
              onSelectSport={openSport}
            />
          ) : pageMode === "scores" ? (
            <ScoresPage
              scores={scoreMatches}
              loading={scoresLoading}
              error={scoresError}
              updatedAt={scoresUpdatedAt}
              fromCache={scoresFromCache}
              onRefresh={() => void refreshScores(false)}
            />
          ) : (
            <>
          <section className="stage-grid">
            <div className="player-section" ref={playerSectionRef}>
              <div className="player-shell">
                <div className="player-topline">
                  <span className={selectedMatch?.status === "live" ? "live-chip" : "soft-chip"}>
                    {selectedMatch?.status === "live" ? (
                      <LiveNavIcon size={14} aria-hidden="true" />
                    ) : (
                      <Server size={14} aria-hidden="true" />
                    )}
                    {playerStatusLabel}
                  </span>
                  <div className="topline-actions">
                    <span className="source-kind">
                      {selectedSource
                        ? `${sourceKindLabel(selectedSource.kind)} · ${sourceDisplayName(selectedSource)}`
                        : "No source"}
                    </span>
                    {selectedMatch || hasNextSource ? (
                      <span className="topline-button-group">
                        {selectedMatch ? (
                          <button
                            type="button"
                            className="mini-button player-share-button"
                            onClick={() => void shareSelectedMatch()}
                            aria-label={`Share ${matchTitle(selectedMatch)}`}
                            aria-live="polite"
                            title="Share this live match"
                          >
                            {shareFeedback === "Copied" || shareFeedback === "Shared" ? (
                              <Check size={14} aria-hidden="true" />
                            ) : (
                              <Share2 size={14} aria-hidden="true" />
                            )}
                            <span>{shareFeedback || "Share"}</span>
                          </button>
                        ) : null}
                        {hasNextSource ? (
                          <button type="button" className="mini-button" onClick={useNextSource}>
                            Next
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Player
                  match={selectedMatch}
                  source={selectedSource}
                  canUseNextSource={hasNextSource}
                  onNextSource={useNextSource}
                />
              </div>

              <div className={`match-header is-${selectedHeaderAccent}`}>
                {selectedMatch ? (
                  <div className={selectedMatch.awayTeam ? "match-scoreboard" : "match-scoreboard is-channel"}>
                    <div className="match-side is-home">
                      <TeamMark
                        badge={selectedMatch.homeBadge}
                        name={selectedMatch.homeTeam}
                        sportIcon={!selectedMatch.awayTeam ? selectedSportIcon : undefined}
                        accent={selectedHeaderAccent}
                        size="large"
                      />
                      <span>
                        <small>{selectedMatch.sportLabel}</small>
                        <strong>{selectedMatch.homeTeam}</strong>
                      </span>
                    </div>
                    <div className="match-center">
                      <span className={selectedMatch.status === "live" ? "match-status-pill is-live" : "match-status-pill is-upcoming"}>
                        <span />
                        {selectedMatch.status === "live" ? "Live" : "Upcoming"}
                      </span>
                      <strong className={selectedScoreMatch ? "match-scoreline" : undefined}>
                        {selectedScoreMatch ? sportScoreLine(selectedScoreMatch) : selectedMatch.awayTeam ? "VS" : "ON AIR"}
                      </strong>
                      <small>{compactCompetitionLabel(selectedScoreMatch?.competition || selectedMatch.league)}</small>
                    </div>
                    {selectedMatch.awayTeam ? (
                      <div className="match-side is-away">
                        <span>
                          <small>{selectedMatch.dateLabel || "Today"}</small>
                          <strong>{selectedMatch.awayTeam}</strong>
                        </span>
                        <TeamMark
                          badge={selectedMatch.awayBadge}
                          name={selectedMatch.awayTeam}
                          accent={selectedHeaderAccent}
                          size="large"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="team-title">
                    <span className="badge-fallback">BM</span>
                    <div className="match-title-copy">
                      <div className="match-title-kicker">
                        <p>Busted Minds Sports</p>
                      </div>
                      <h1>No game selected</h1>
                    </div>
                  </div>
                )}
                <div className="match-meta">
                  <span>
                    <Users size={15} aria-hidden="true" />
                    {selectedMatch ? selectedMatch.viewers.toLocaleString() : "0"}
                  </span>
                  <span>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {selectedMatch?.sources.length ?? 0} feeds
                  </span>
                  <span>
                    <Clock3 size={15} aria-hidden="true" />
                    {selectedMatch?.timeLabel || "Now"}
                  </span>
                </div>
              </div>

              <div className="source-panel">
                <div className="section-title">
                  <Server size={17} aria-hidden="true" />
                  <h2>Feeds</h2>
                </div>
                <div className="source-list">
                  {selectedMatch?.sources.length ? (
                    selectedMatch.sources.map((source, index) => {
                      const fullName = sourceDisplayName(source);
                      const compactName = sourceCompactDisplayName(source);

                      return (
                        <button
                          key={source.id}
                          type="button"
                          className={index === sourceIndex ? "source-button is-active" : "source-button"}
                          onClick={() => setSourceIndex(index)}
                          aria-label={`Use ${fullName} feed`}
                          aria-pressed={index === sourceIndex}
                          title={`${fullName} - ${sourceKindLabel(source.kind)}`}
                        >
                          <span className="source-name source-name-compact" aria-hidden="true">
                            {compactName}
                          </span>
                          <span className="source-name source-name-full" aria-hidden="true">
                            {fullName}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="quiet-text">No feeds available</span>
                  )}
                </div>
              </div>
            </div>

            <aside className="games-panel" aria-label="Games">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Matches</span>
                  <h2>{queueTitle}</h2>
                </div>
                <span className="count-pill">{filteredGames.length}</span>
              </div>

              {searchActive ? (
                <div className="games-controls search-results-bar">
                  <div className="active-filter-line" aria-live="polite">
                    <span>{filteredGames.length} of {searchStats.total}</span>
                    <strong>{searchQuery ? `"${searchQuery}" in ${pageScope}` : `Search in ${pageScope}`}</strong>
                  </div>
                  <div className="search-scope-actions" role="group" aria-label="Search scope">
                    <SearchScopeButton
                      label="All"
                      count={searchStats.total}
                      active={sportFilter === "all" && statusFilter === "all"}
                      onClick={() => applySearchScope("all")}
                    />
                    <SearchScopeButton
                      label="Live"
                      count={searchStats.live}
                      active={sportFilter === "all" && statusFilter === "live"}
                      onClick={() => applySearchScope("live")}
                    />
                    <SearchScopeButton
                      label="Next"
                      count={searchStats.upcoming}
                      active={sportFilter === "all" && statusFilter === "upcoming"}
                      onClick={() => applySearchScope("upcoming")}
                    />
                    <SearchScopeButton
                      label="Football"
                      count={searchStats.football}
                      active={sportFilter === "football" && statusFilter === "all"}
                      onClick={() => applySearchScope("football")}
                    />
                    <SearchScopeButton
                      label="Baseball"
                      count={searchStats.baseball}
                      active={sportFilter === "baseball" && statusFilter === "all"}
                      onClick={() => applySearchScope("baseball")}
                    />
                    <SearchScopeButton
                      label="Basketball"
                      count={searchStats.basketball}
                      active={sportFilter === "basketball" && statusFilter === "all"}
                      onClick={() => applySearchScope("basketball")}
                    />
                    <SearchScopeButton
                      label="Fight"
                      count={searchStats.fight}
                      active={sportFilter === "fight" && statusFilter === "all"}
                      onClick={() => applySearchScope("fight")}
                    />
                    <SearchScopeButton
                      label="Cricket"
                      count={searchStats.cricket}
                      active={sportFilter === "cricket" && statusFilter === "all"}
                      onClick={() => applySearchScope("cricket")}
                    />
                    <SearchScopeButton
                      label="Tennis"
                      count={searchStats.tennis}
                      active={sportFilter === "tennis" && statusFilter === "all"}
                      onClick={() => applySearchScope("tennis")}
                    />
                    <SearchScopeButton
                      label="Volleyball"
                      count={searchStats.volleyball}
                      active={sportFilter === "volleyball" && statusFilter === "all"}
                      onClick={() => applySearchScope("volleyball")}
                    />
                  </div>
                  <button type="button" className="clear-filters" onClick={clearSearch}>
                    <X size={15} aria-hidden="true" />
                    Clear search
                  </button>
                </div>
              ) : null}

              <div className="match-list">
                {loading && games.length === 0 ? (
                  <LoadingRows />
                ) : orderedFilteredGames.length ? (
                  orderedFilteredGames.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      score={findSportScoreForMatch(match, scoreMatches)}
                      selected={isStreamSelectable(match) && match.id === selectedId}
                      onSelect={() => selectMatchFromList(match)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={searchActive ? Search : error ? WifiOff : CalendarDays}
                    title={
                      searchActive
                        ? searchStats.total
                          ? "No games in this scope"
                          : `No results for "${searchQuery}"`
                        : error && !fromCache
                          ? "Games unavailable"
                          : "No games right now"
                    }
                    detail={
                      searchActive
                        ? searchStats.total
                          ? "Try All games or another scope"
                          : "Check the spelling or clear the search"
                        : error && !fromCache
                          ? error
                          : "Refresh again when the next slate is ready"
                    }
                  />
                )}
              </div>
            </aside>
          </section>

          <section className="lower-grid" aria-label="Slate details">
            <section className="schedule-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Schedule</span>
                  <h2>Up Next</h2>
                </div>
                <CalendarDays size={18} aria-hidden="true" />
              </div>
              <div className="schedule-list">
                {upcomingGames.length ? (
                  upcomingGames.map((match) => (
                    <ScheduleRow
                      key={match.id}
                      match={match}
                      score={findSportScoreForMatch(match, scoreMatches)}
                      selected={isStreamSelectable(match) && match.id === selectedId}
                      onSelect={() => selectMatchFromList(match)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="No upcoming games"
                    detail="Live games will stay available above"
                  />
                )}
              </div>
            </section>

            <section className="insight-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Signals</span>
                  <h2>Stream Health</h2>
                </div>
                <Activity size={18} aria-hidden="true" />
              </div>
              <div className="health-grid">
                <HealthItem
                  label="Live now"
                  value={`${slateStats.live} games`}
                  state={slateStats.live ? "good" : "neutral"}
                />
                <HealthItem
                  label="Live feeds"
                  value={slateStats.servers.toLocaleString()}
                  state={slateStats.servers ? "good" : "warn"}
                />
                <HealthItem
                  label="Primary feeds"
                  value={`${slateStats.primarySources}/${slateStats.servers}`}
                  state={slateStats.primarySources ? "good" : "warn"}
                />
                <HealthItem
                  label="Catalog"
                  value={fromCache ? "Cached" : error ? "Retrying" : "Fresh"}
                  state={fromCache || error ? "warn" : "good"}
                />
                <HealthItem
                  label="Updated"
                  value={updatedAt ? timeAgo(updatedAt) : "Pending"}
                  state={updatedAt ? "neutral" : "warn"}
                />
              </div>
            </section>
          </section>
            </>
          )}
        </section>
      </main>

      <nav className="mobile-tabbar" aria-label="Quick navigation">
        {mobileMoreOpen ? (
          <div id="mobile-more-menu" className="mobile-more-menu is-sports" aria-label="More navigation">
            <button
              type="button"
              className={schedulePageActive ? "mobile-more-action is-active" : "mobile-more-action"}
              onClick={() => openStatusPage("upcoming")}
              aria-current={schedulePageActive ? "page" : undefined}
            >
              <NextNavIcon size={20} aria-hidden="true" />
              <span>Schedule</span>
              <small>{slateStats.upcoming}</small>
            </button>
            {sportFocusItems.map((sport) => {
              const sportActive = sportsPageActive && sportFilter === sport.key;

              return (
                <button
                  key={sport.key}
                  type="button"
                  className={sportActive ? "mobile-more-action is-active" : "mobile-more-action"}
                  onClick={() => openSport(sport.key)}
                  aria-current={sportActive ? "page" : undefined}
                >
                  <img src={sport.iconSrc} alt="" loading="lazy" decoding="async" draggable="false" />
                  <span>{sport.label}</span>
                  <small>{sport.total}</small>
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          type="button"
          className={homePageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={openHome}
          aria-current={homePageActive ? "page" : undefined}
        >
          <HomeNavIcon size={18} aria-hidden="true" />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={livePageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={() => openStatusPage("live")}
          aria-current={livePageActive ? "page" : undefined}
        >
          <LiveNavIcon size={18} aria-hidden="true" />
          <span>Live</span>
        </button>
        <button
          type="button"
          className={scoresPageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={openScores}
          aria-current={scoresPageActive ? "page" : undefined}
        >
          <Activity size={18} aria-hidden="true" />
          <span>Scores</span>
        </button>
        <button
          type="button"
          className={
            mobileMoreActive
              ? "mobile-tabbar-button is-active"
              : mobileMoreOpen
                ? "mobile-tabbar-button is-open"
                : "mobile-tabbar-button"
          }
          onClick={toggleMobileMore}
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-menu"
          aria-current={mobileMoreActive ? "page" : undefined}
          aria-label={
            schedulePageActive
              ? "More, Schedule selected"
              : activeSportSummary
                ? `More, ${activeSportSummary.label} selected`
                : "More"
          }
        >
          {schedulePageActive ? (
            <NextNavIcon size={18} aria-hidden="true" />
          ) : (
            <img src={activeSportSummary?.iconSrc ?? genericSportIconUrl} alt="" aria-hidden="true" />
          )}
          <span>More</span>
        </button>
      </nav>

      <footer className="site-footer">
        <span className="footer-powered-label">powered by</span>
        <a
          className="footer-parent-brand"
          href="https://bustedminds.us.kg/"
          target="_blank"
          rel="noreferrer"
          aria-label="Visit Busted Minds"
        >
          <img className="footer-parent-logo" src={parentLogoUrl} alt="" />
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}

function HeaderSportsMenu({
  sports,
  activeSportKey,
  activeSport,
  open,
  menuRef,
  onToggle,
  onSelect,
}: {
  sports: HeaderSportSummary[];
  activeSportKey: string;
  activeSport: HeaderSportSummary | null;
  open: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onSelect: (sportKey: string) => void;
}) {
  const active = Boolean(activeSportKey);

  return (
    <div className="header-sports-menu" ref={menuRef}>
      <button
        type="button"
        className={active || open ? "header-sports-trigger is-active" : "header-sports-trigger"}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="header-sports-menu"
        aria-current={active ? "page" : undefined}
      >
        <span className="header-sports-trigger-icon">
          {activeSport ? (
            <img src={activeSport.iconSrc} alt="" decoding="async" draggable="false" />
          ) : (
            <img src={genericSportIconUrl} alt="" decoding="async" draggable="false" />
          )}
        </span>
        <span>Sports</span>
      </button>

      {open ? (
        <div id="header-sports-menu" className="header-sports-popover" role="menu" aria-label="Sport pages">
          {sports.map((sport) => {
            const sportActive = activeSportKey === sport.key;
            const sportMeta = sport.live ? `${sport.live} live` : sport.upcoming ? `${sport.upcoming} next` : `${sport.total}`;

            return (
              <a
                key={sport.key}
                href={sportRouteForKey(sport.key).path}
                className={
                  sportActive
                    ? `header-sports-option is-${sport.accent} is-active`
                    : `header-sports-option is-${sport.accent}`
                }
                role="menuitem"
                aria-current={sportActive ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(sport.key);
                }}
              >
                <img src={sport.iconSrc} alt="" loading="lazy" decoding="async" draggable="false" />
                <span>{sport.label}</span>
                <small>{sportMeta}</small>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SearchScopeButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const disabled = count === 0 && !active;

  return (
    <button
      type="button"
      className={active ? "search-scope-chip is-active" : "search-scope-chip"}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
    >
      <span>{label}</span>
      <small>{count}</small>
    </button>
  );
}

function BrandWordmark() {
  return (
    <span className="brand-wordmark" aria-hidden="true">
      <img className="sports-brand-logo" src={sportsLogoUrl} alt="" />
    </span>
  );
}

function HomeNavIcon({
  size = 20,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      className={className ? `bm-nav-icon ${className}` : "bm-nav-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <path
        d="M4.25 11.2 12 4.75l7.75 6.45"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 10.8v7.45c0 .66.54 1.2 1.2 1.2h8.8c.66 0 1.2-.54 1.2-1.2V10.8"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M6.4 10.8v7.45c0 .66.54 1.2 1.2 1.2h8.8c.66 0 1.2-.54 1.2-1.2V10.8"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.45v-4.2c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v4.2"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path d="M8.5 12.3h2.15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function LiveNavIcon({
  size = 20,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      className={className ? `bm-nav-icon ${className}` : "bm-nav-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <circle cx="12" cy="12" r="2.55" fill="currentColor" />
      <path
        d="M8.15 8.45a5.45 5.45 0 0 0 0 7.1M15.85 8.45a5.45 5.45 0 0 1 0 7.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M5.35 5.75a9.25 9.25 0 0 0 0 12.5M18.65 5.75a9.25 9.25 0 0 1 0 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.62"
      />
      <path
        d="M9.35 19.75h5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.72"
      />
    </svg>
  );
}

function NextNavIcon({
  size = 20,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      className={className ? `bm-nav-icon ${className}` : "bm-nav-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <rect x="4.2" y="5.6" width="15.6" height="14.15" rx="2.6" fill="currentColor" opacity="0.16" />
      <rect
        x="4.2"
        y="5.6"
        width="15.6"
        height="14.15"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M8 3.95v3.2M16 3.95v3.2M4.75 9.55h14.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M8.05 14.3h6.55M12.85 11.8l3.05 2.5-3.05 2.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomePage({
  games,
  loading,
  slateStats,
  scoreMatches,
  liveGames,
  upcomingGames,
  sportFocusItems,
  onOpenStatus,
  onSelectMatch,
  onSelectSport,
}: {
  games: Match[];
  loading: boolean;
  slateStats: SlateStats;
  scoreMatches: SportScoreMatch[];
  liveGames: Match[];
  upcomingGames: Match[];
  sportFocusItems: HeaderSportSummary[];
  onOpenStatus: (status: NavigableStatus) => void;
  onSelectMatch: (match: Match) => void;
  onSelectSport: (sportKey: string) => void;
}) {
  const heroMatch = pickPreferredMatch(games, defaultSportKey);
  const heroAccent = heroMatch ? sportAccent(heroMatch.sportKey) : "generic";
  const heroSportIcon = heroMatch ? sportIconForKey(heroMatch.sportKey) : "";
  const heroFeatureLabel = "Featured live match";
  const showLiveTicker = liveGames.length > 0;
  const tickerMatches = (showLiveTicker ? liveGames : upcomingGames).slice(0, 10);
  const tickerStatus: NavigableStatus = showLiveTicker ? "live" : "upcoming";
  const tickerCount = showLiveTicker ? slateStats.live : slateStats.upcoming;
  const tickerDuration = `${Math.max(24, tickerMatches.length * 7)}s`;
  const tickerViewportRef = useRef<HTMLDivElement>(null);
  const mobileTickerPausedRef = useRef(false);
  const mobileTickerResumeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = tickerViewportRef.current;
    if (!viewport || tickerMatches.length < 2 || typeof window === "undefined") return;

    const advanceTicker = () => {
      if (
        mobileTickerPausedRef.current ||
        !window.matchMedia("(max-width: 820px)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const items = Array.from(
        viewport.querySelectorAll<HTMLElement>(".home-live-ticker-group:not([aria-hidden]) .home-live-ticker-item"),
      );
      if (items.length < 2) return;

      const currentIndex = items.reduce((closestIndex, item, index) => {
        const closestDistance = Math.abs(items[closestIndex].offsetLeft - viewport.scrollLeft);
        const itemDistance = Math.abs(item.offsetLeft - viewport.scrollLeft);
        return itemDistance < closestDistance ? index : closestIndex;
      }, 0);
      const nextItem = items[(currentIndex + 1) % items.length];
      viewport.scrollTo({ left: nextItem.offsetLeft, behavior: "smooth" });
    };

    const intervalId = window.setInterval(advanceTicker, 5_000);
    return () => {
      window.clearInterval(intervalId);
      if (mobileTickerResumeTimerRef.current !== null) {
        window.clearTimeout(mobileTickerResumeTimerRef.current);
        mobileTickerResumeTimerRef.current = null;
      }
    };
  }, [tickerMatches.length]);

  const pauseMobileTicker = () => {
    mobileTickerPausedRef.current = true;
    if (mobileTickerResumeTimerRef.current !== null) {
      window.clearTimeout(mobileTickerResumeTimerRef.current);
      mobileTickerResumeTimerRef.current = null;
    }
  };

  const resumeMobileTickerLater = () => {
    if (mobileTickerResumeTimerRef.current !== null) {
      window.clearTimeout(mobileTickerResumeTimerRef.current);
    }
    mobileTickerResumeTimerRef.current = window.setTimeout(() => {
      mobileTickerPausedRef.current = false;
      mobileTickerResumeTimerRef.current = null;
    }, 5_000);
  };

  return (
    <section className="home-page" aria-label="Home">
      <section className="home-hero">
        <img className="home-hero-art" src={homeThumbnailUrl} alt="" />
        <span className="home-hero-shade" />
        <div className="home-hero-brandmarks">
          <div className="home-hero-powered" role="img" aria-label="Powered by Busted Minds">
            <span className="home-hero-powered-label">Powered by</span>
            <img className="home-hero-brandmark is-parent" src={parentLogoUrl} alt="" />
          </div>
        </div>

        <div className="home-hero-content">
          <div className="home-hero-copy">
            <span className="home-hero-welcome">Busted Minds Sports</span>
            <h1>Every match, one place.</h1>
            <p>Pick a sport, jump into a live stream, and keep scores close.</p>
          </div>
          <div className="home-hero-sport-actions">
            <a
              href={seoRoutes.live.path}
              className="home-hero-sport-action is-live"
              onClick={(event) => {
                event.preventDefault();
                onOpenStatus("live");
              }}
            >
              <LiveNavIcon size={18} aria-hidden="true" />
              <span>Live now</span>
            </a>
            <a href="#featured-sports" className="home-hero-sport-action is-browse">
              <Trophy className="home-hero-browse-icon" size={16} aria-hidden="true" />
              <span>Browse sports</span>
            </a>
          </div>
        </div>
        {heroMatch ? (
          <button
            type="button"
            className={`home-feature-card is-${heroAccent}`}
            onClick={() => onSelectMatch(heroMatch)}
            aria-label={`Open ${matchTitle(heroMatch)}`}
          >
            <span className={`home-feature-label is-${heroMatch.status}`}>{heroFeatureLabel}</span>
            <span className={heroMatch.awayTeam ? "home-feature-matchup" : "home-feature-matchup is-channel"}>
              <span className="home-feature-team">
                <TeamMark
                  badge={heroMatch.homeBadge}
                  name={heroMatch.homeTeam}
                  sportIcon={!heroMatch.awayTeam ? heroSportIcon : undefined}
                  accent={heroAccent}
                  size="large"
                />
                <strong>{heroMatch.homeTeam}</strong>
              </span>
              <span className="home-feature-center">
                <strong>{heroMatch.awayTeam ? "VS" : "ON AIR"}</strong>
              </span>
              {heroMatch.awayTeam ? (
                <span className="home-feature-team is-away">
                  <strong>{heroMatch.awayTeam}</strong>
                  <TeamMark
                    badge={heroMatch.awayBadge}
                    name={heroMatch.awayTeam}
                    accent={heroAccent}
                    size="large"
                  />
                </span>
              ) : null}
            </span>
            <span className="home-feature-meta">
              <span>{heroMatch.league}</span>
              <span>{matchStreamMeta(heroMatch)}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </span>
          </button>
        ) : null}
        <section
          className={`home-live-ticker is-${tickerStatus}`}
          aria-label={showLiveTicker ? "Live match ticker" : "Upcoming match ticker"}
        >
          <button
            type="button"
            className="home-live-ticker-label"
            onClick={() => onOpenStatus(tickerStatus)}
            aria-label={`Open all ${tickerCount} ${showLiveTicker ? "live" : "upcoming"} matches`}
          >
            {showLiveTicker ? (
              <span className="home-live-ticker-pulse" aria-hidden="true" />
            ) : (
              <Clock3 className="home-live-ticker-clock" size={14} aria-hidden="true" />
            )}
            <span>{showLiveTicker ? "Live" : "Up next"}</span>
            <strong>{tickerCount}</strong>
          </button>
          <div
            ref={tickerViewportRef}
            className="home-live-ticker-viewport"
            onPointerDown={pauseMobileTicker}
            onPointerUp={resumeMobileTickerLater}
            onPointerCancel={resumeMobileTickerLater}
            onFocus={pauseMobileTicker}
            onBlur={resumeMobileTickerLater}
            onWheel={() => {
              pauseMobileTicker();
              resumeMobileTickerLater();
            }}
          >
            {tickerMatches.length ? (
              <div
                className={`home-live-ticker-track${tickerMatches.length > 1 ? " is-animated" : " is-static"}`}
                style={{ "--ticker-duration": tickerDuration } as CSSProperties}
              >
                <div className="home-live-ticker-group">
                  {tickerMatches.map((match) => (
                    <HomeLiveTickerItem
                      key={match.id}
                      match={match}
                      score={findSportScoreForMatch(match, scoreMatches)}
                      onSelect={() => showLiveTicker ? onSelectMatch(match) : onOpenStatus("upcoming")}
                    />
                  ))}
                </div>
                {tickerMatches.length > 1 ? (
                  <div className="home-live-ticker-group" aria-hidden="true">
                    {tickerMatches.map((match) => (
                      <HomeLiveTickerItem
                        key={`repeat-${match.id}`}
                        match={match}
                        score={findSportScoreForMatch(match, scoreMatches)}
                        onSelect={() => showLiveTicker ? onSelectMatch(match) : onOpenStatus("upcoming")}
                        duplicate
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" className="home-live-ticker-empty" onClick={() => onOpenStatus("upcoming")}>
                <span>No scheduled matches available</span>
                <strong>View schedule</strong>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </section>

      <section className="home-summary-strip" aria-label="Slate summary">
        <SummaryMetric icon={LiveNavIcon} label="Live now" value={slateStats.live.toLocaleString()} />
        <SummaryMetric icon={NextNavIcon} label="Up next" value={slateStats.upcoming.toLocaleString()} />
        <SummaryMetric icon={ShieldCheck} label="Live feeds" value={slateStats.servers.toLocaleString()} />
        <SummaryMetric icon={Activity} label="Scores" value={scoreMatches.length.toLocaleString()} />
      </section>

      <section className="home-dashboard-grid" aria-label="Home slate">
        <section className="home-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">On air</span>
              <h2>Live Matches</h2>
            </div>
            <a
              href={seoRoutes.live.path}
              className="home-panel-action"
              onClick={(event) => {
                event.preventDefault();
                onOpenStatus("live");
              }}
            >
              <LiveNavIcon size={15} aria-hidden="true" />
              <span>{slateStats.live}</span>
            </a>
          </div>
          <div className="home-match-grid">
            {loading && games.length === 0 ? (
              <LoadingRows />
            ) : liveGames.length ? (
              liveGames.slice(0, 4).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  score={findSportScoreForMatch(match, scoreMatches)}
                  selected={false}
                  onSelect={() => onSelectMatch(match)}
                />
              ))
            ) : (
              <EmptyState icon={LiveNavIcon} title="No live games" detail="Next games are listed on the schedule" />
            )}
          </div>
        </section>

        <section className="home-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">Schedule</span>
              <h2>Coming Up</h2>
            </div>
            <a
              href={seoRoutes.schedule.path}
              className="home-panel-action"
              onClick={(event) => {
                event.preventDefault();
                onOpenStatus("upcoming");
              }}
            >
              <NextNavIcon size={15} aria-hidden="true" />
              <span>{slateStats.upcoming}</span>
            </a>
          </div>
          <div className="schedule-list home-schedule-list">
            {loading && games.length === 0 ? (
              <LoadingRows />
            ) : upcomingGames.length ? (
              upcomingGames.map((match) => (
                <ScheduleRow
                  key={match.id}
                  match={match}
                  score={findSportScoreForMatch(match, scoreMatches)}
                  selected={false}
                  onSelect={() => onSelectMatch(match)}
                />
              ))
            ) : (
              <EmptyState icon={CalendarDays} title="No upcoming games" detail="Live games remain available" />
            )}
          </div>
        </section>
      </section>

      <section id="featured-sports" className="home-panel home-sports-panel">
        <div className="home-panel-heading">
          <div>
            <span className="eyebrow">Sports</span>
            <h2>Featured Sports</h2>
          </div>
          <Activity size={18} aria-hidden="true" />
        </div>
        <div className="home-sport-grid">
          {sportFocusItems.map((sport) => (
            <HomeSportCard key={sport.key} sport={sport} onSelect={() => onSelectSport(sport.key)} />
          ))}
        </div>
      </section>
    </section>
  );
}

function HomeLiveTickerItem({
  match,
  score,
  onSelect,
  duplicate = false,
}: {
  match: Match;
  score: SportScoreMatch | null;
  onSelect: () => void;
  duplicate?: boolean;
}) {
  const liveScore = score?.status === "live" ? score : null;
  const presentation = matchPresentation(match, score);
  const scoreLine = liveScore ? sportScoreLine(liveScore) : "";
  const hasScore = Boolean(scoreLine && scoreLine !== "vs");
  const stateLabel = hasScore ? scoreLine : match.timeLabel || "Live";
  const contextLabel = hasScore ? liveScore?.statusText : presentation.competition;

  return (
    <button
      type="button"
      className="home-live-ticker-item"
      onClick={onSelect}
      tabIndex={duplicate ? -1 : undefined}
      aria-label={
        duplicate
          ? undefined
          : match.status === "upcoming"
            ? `View ${matchTitle(match)} schedule, starts ${stateLabel}`
            : `Open ${matchTitle(match)}, ${hasScore ? `score ${scoreLine}` : stateLabel}`
      }
    >
      <span className="home-live-ticker-matchup">
        <span className="home-live-ticker-team">
          <TeamMark
            badge={presentation.homeBadge}
            name={match.homeTeam}
            accent={sportAccent(match.sportKey)}
            size="small"
            showInitials={false}
          />
          <span>{match.homeTeam}</span>
        </span>
        {match.awayTeam ? (
          <>
            <span className="home-live-ticker-vs">vs</span>
            <span className="home-live-ticker-team is-away">
              <TeamMark
                badge={presentation.awayBadge}
                name={match.awayTeam}
                accent={sportAccent(match.sportKey)}
                size="small"
                showInitials={false}
              />
              <span>{match.awayTeam}</span>
            </span>
          </>
        ) : null}
      </span>
      <strong className={hasScore ? "has-score" : "is-time"}>{stateLabel}</strong>
      <small>{contextLabel}</small>
    </button>
  );
}

function ScoresPage({
  scores,
  loading,
  error,
  updatedAt,
  fromCache,
  onRefresh,
}: {
  scores: SportScoreMatch[];
  loading: boolean;
  error: string;
  updatedAt: number | null;
  fromCache: boolean;
  onRefresh: () => void;
}) {
  const counts = useMemo(() => scoreCounts(scores), [scores]);
  const [scoreFilters, setScoreFilters] = useState<ScoreFilters>(defaultScoreFilters);
  const [selectedScoreId, setSelectedScoreId] = useState("");
  const insightPanelRef = useRef<HTMLElement | null>(null);
  const shouldScrollSelectedScoreIntoView = useMediaQuery(compactScoreListQuery);
  const filteredScores = useMemo(
    () => filterScoreMatches(scores, scoreFilters).slice(0, 30),
    [scores, scoreFilters],
  );
  const selectedScore = useMemo(
    () => filteredScores.find((score) => score.id === selectedScoreId) ?? filteredScores[0] ?? null,
    [filteredScores, selectedScoreId],
  );
  const {
    insight,
    loading: insightLoading,
    error: insightError,
    fromCache: insightFromCache,
    refresh: refreshInsight,
  } = useSportScoreInsight(selectedScore);

  useEffect(() => {
    if (!filteredScores.length) {
      if (selectedScoreId) setSelectedScoreId("");
      return;
    }
    if (!filteredScores.some((score) => score.id === selectedScoreId)) {
      setSelectedScoreId(filteredScores[0].id);
    }
  }, [filteredScores, selectedScoreId]);

  const selectScore = (score: SportScoreMatch) => {
    setSelectedScoreId(score.id);
    if (!shouldScrollSelectedScoreIntoView || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      insightPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section className="scores-page" aria-label="Scores">
      <section className="scores-hero">
        <div className="scores-hero-copy">
          <h1>Scoreboard</h1>
          <p>Priority-ranked live, final and upcoming results across football, basketball, cricket and tennis.</p>
        </div>
        <div className="scores-hero-actions">
          <section className="scores-summary-strip" aria-label="Score summary">
            <SummaryMetric icon={LiveNavIcon} label="Live" value={counts.live.toLocaleString()} />
            <SummaryMetric icon={NextNavIcon} label="Upcoming" value={counts.upcoming.toLocaleString()} />
            <SummaryMetric icon={Activity} label="Final" value={counts.finished.toLocaleString()} />
            <SummaryMetric
              icon={Clock3}
              label="Updated"
              value={updatedAt ? timeAgo(updatedAt) : loading ? "Loading" : "Pending"}
            />
          </section>
          <RefreshIconButton
            className="mini-button icon-only-button scores-refresh-button"
            onRefresh={onRefresh}
            label="Refresh scores"
            title="Refresh scores"
            size={16}
          />
        </div>
      </section>

      <section className="scores-workspace" aria-label="Score match center">
        <ScoreboardPanel
          scores={scores}
          filteredScores={filteredScores}
          loading={loading}
          error={error}
          updatedAt={updatedAt}
          fromCache={fromCache}
          filters={scoreFilters}
          selectedScoreId={selectedScore?.id ?? ""}
          onChangeFilters={setScoreFilters}
          onSelectScore={selectScore}
          onRefresh={onRefresh}
        />
        <ScoreInsightPanel
          panelRef={insightPanelRef}
          score={selectedScore}
          insight={insight}
          loading={insightLoading}
          error={insightError}
          fromCache={insightFromCache}
          onRefresh={() => void refreshInsight(false)}
        />
      </section>
    </section>
  );
}

type ScorePriorityFilter = "main" | "others" | "all";
type ScoreSportFilter = "all" | SportScoreSport;
type ScoreStatusFilter = "all" | "live" | "upcoming" | "finished";
type ScoreCompetitionFilter = "all" | "fifa" | "uefa" | "epl" | "nba" | "icc" | "ipl" | "tennis-majors";
type ScoreFilters = {
  priority: ScorePriorityFilter;
  sport: ScoreSportFilter;
  status: ScoreStatusFilter;
  competition: ScoreCompetitionFilter;
  query: string;
};
type ScoreInsightTab = "match" | "table" | "leaders" | "teams";

const defaultScoreFilters: ScoreFilters = {
  priority: "main",
  sport: "all",
  status: "all",
  competition: "all",
  query: "",
};
const compactScoreListQuery = "(max-width: 959px)";
const compactScoreListLimit = 8;

const scoreCompetitionFilters: Array<{ key: ScoreCompetitionFilter; label: string; sport?: ScoreSportFilter }> = [
  { key: "all", label: "All" },
  { key: "fifa", label: "FIFA", sport: "football" },
  { key: "uefa", label: "UEFA", sport: "football" },
  { key: "epl", label: "EPL", sport: "football" },
  { key: "nba", label: "NBA", sport: "basketball" },
  { key: "icc", label: "ICC", sport: "cricket" },
  { key: "ipl", label: "IPL", sport: "cricket" },
  { key: "tennis-majors", label: "Majors", sport: "tennis" },
];
const scoreSearchStopWords = new Set(["score", "scores", "match", "matches", "game", "games", "result", "results", "fixture", "fixtures"]);

function ScoreboardPanel({
  scores,
  filteredScores,
  loading,
  error,
  updatedAt,
  fromCache,
  filters,
  selectedScoreId,
  onChangeFilters,
  onSelectScore,
  onRefresh,
}: {
  scores: SportScoreMatch[];
  filteredScores: SportScoreMatch[];
  loading: boolean;
  error: string;
  updatedAt: number | null;
  fromCache: boolean;
  filters: ScoreFilters;
  selectedScoreId: string;
  onChangeFilters: Dispatch<SetStateAction<ScoreFilters>>;
  onSelectScore: (score: SportScoreMatch) => void;
  onRefresh: () => void;
}) {
  const priorityOptions = useMemo(
    () => [
      { key: "main" as const, label: "Featured", count: filterScoreMatches(scores, { ...filters, priority: "main" }).length },
      { key: "all" as const, label: "All", count: filterScoreMatches(scores, { ...filters, priority: "all" }).length },
      { key: "others" as const, label: "Other", count: filterScoreMatches(scores, { ...filters, priority: "others" }).length },
    ],
    [filters, scores],
  );
  const competitionCountBase = useMemo(
    () => filterScoreMatches(scores, { ...filters, competition: "all" }),
    [filters, scores],
  );
  const competitionOptions = useMemo(
    () =>
      scoreCompetitionFilters.map((competition) => ({
        ...competition,
        count:
          competition.key === "all"
            ? competitionCountBase.length
            : competitionCountBase.filter((score) => scoreMatchesCompetitionFilter(score, competition.key)).length,
      })),
    [competitionCountBase],
  );
  const sportCountBase = useMemo(
    () => filterScoreMatches(scores, { ...filters, sport: "all" }),
    [filters, scores],
  );
  const statusCountBase = useMemo(
    () => filterScoreMatches(scores, { ...filters, status: "all" }),
    [filters, scores],
  );
  const sportOptions = useMemo(() => {
    return [
      { key: "all" as const, label: "All", count: sportCountBase.length },
      ...sportScoreSports.map((sport) => ({
        key: sport,
        label: formatSportKey(sport),
        count: sportCountBase.filter((score) => score.sport === sport).length,
      })),
    ];
  }, [sportCountBase]);
  const statusOptions = useMemo(
    () => [
      { key: "all" as const, label: "All", count: statusCountBase.length },
      { key: "live" as const, label: "Live", count: statusCountBase.filter((score) => score.status === "live").length },
      { key: "upcoming" as const, label: "Fixtures", count: statusCountBase.filter((score) => score.status === "upcoming").length },
      { key: "finished" as const, label: "Results", count: statusCountBase.filter((score) => score.status === "finished").length },
    ],
    [statusCountBase],
  );
  const hasActiveFilter = !scoreFiltersMatch(filters, defaultScoreFilters);
  const activeFacetCount = [
    filters.priority !== defaultScoreFilters.priority,
    filters.sport !== defaultScoreFilters.sport,
    filters.status !== defaultScoreFilters.status,
    filters.competition !== defaultScoreFilters.competition,
  ].filter(Boolean).length;
  const filterSummary = `${filteredScores.length.toLocaleString()} of ${scores.length.toLocaleString()} matches`;
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState("");
  const [scoreListExpanded, setScoreListExpanded] = useState(false);
  const isCompactScoreList = useMediaQuery(compactScoreListQuery);
  const shouldLimitScores = isCompactScoreList && !scoreListExpanded && filteredScores.length > compactScoreListLimit;
  const visibleScores = shouldLimitScores ? filteredScores.slice(0, compactScoreListLimit) : filteredScores;
  const hiddenScoreCount = filteredScores.length - visibleScores.length;
  const shownSummary =
    hiddenScoreCount > 0
      ? `${visibleScores.length.toLocaleString()} of ${filteredScores.length.toLocaleString()} shown`
      : `${filteredScores.length.toLocaleString()} shown`;

  useEffect(() => {
    setScoreListExpanded(false);
  }, [filters.competition, filters.priority, filters.query, filters.sport, filters.status]);

  useEffect(() => {
    if (!isCompactScoreList || scoreListExpanded || !selectedScoreId) return;
    const selectedIndex = filteredScores.findIndex((score) => score.id === selectedScoreId);
    if (selectedIndex >= compactScoreListLimit) setScoreListExpanded(true);
  }, [filteredScores, isCompactScoreList, scoreListExpanded, selectedScoreId]);

  const updateFilters = (nextFilters: Partial<ScoreFilters>) => {
    onChangeFilters((currentFilters) => ({ ...currentFilters, ...nextFilters }));
  };
  const selectSport = (sportKey: ScoreSportFilter) => {
    onChangeFilters((currentFilters) => {
      const activeCompetition = scoreCompetitionFilters.find((competition) => competition.key === currentFilters.competition);
      const competitionConflicts =
        sportKey !== "all" && activeCompetition?.sport && activeCompetition.sport !== sportKey;

      return {
        ...currentFilters,
        sport: sportKey,
        competition: competitionConflicts ? "all" : currentFilters.competition,
      };
    });
  };
  const selectCompetition = (competition: (typeof scoreCompetitionFilters)[number]) => {
    onChangeFilters((currentFilters) => ({
      ...currentFilters,
      competition: competition.key,
      priority: competition.key === "all" ? currentFilters.priority : "all",
      sport: competition.sport ?? currentFilters.sport,
    }));
  };
  const warningNotice = error
    ? fromCache
      ? "Score refresh failed. Showing cached results."
      : error
    : "";

  return (
    <section className="score-panel" aria-label="Scoreboard">
      <div className="panel-heading score-panel-heading">
        <div className="score-title-block">
          <h2>Matches</h2>
          <p>{filterSummary}</p>
        </div>
        <div className="score-heading-actions">
          {warningNotice ? <span className="score-sync is-warning">{warningNotice}</span> : null}
          <RefreshIconButton
            className="mini-button icon-only-button"
            onRefresh={onRefresh}
            label="Refresh scores"
            title="Refresh scores"
          />
        </div>
      </div>

      <div className="score-filter-stack">
        <div className="score-filter-primary">
          <label className="search-box score-filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Search matches"
              aria-label="Search score matches"
              autoComplete="off"
              enterKeyHint="search"
            />
            {filters.query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => updateFilters({ query: "" })}
                aria-label="Clear score search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="score-filter-actions" aria-live="polite">
            <span className="score-filter-count">{shownSummary}</span>
            <button
              type="button"
              className={filtersExpanded ? "score-filter-toggle is-open" : "score-filter-toggle"}
              onClick={() => setFiltersExpanded((isExpanded) => !isExpanded)}
              aria-expanded={filtersExpanded}
              aria-controls="score-filter-controls"
            >
              <ChevronRight size={14} aria-hidden="true" />
              Filters
              {activeFacetCount ? <small>{activeFacetCount}</small> : null}
            </button>
            {hasActiveFilter ? (
              <button type="button" className="score-filter-clear" onClick={() => onChangeFilters(defaultScoreFilters)}>
                <X size={13} aria-hidden="true" />
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <div className="score-status-tabs" role="group" aria-label="Score status">
          {statusOptions.map((status) => (
            <button
              key={status.key}
              type="button"
              className={filters.status === status.key ? "score-status-tab is-active" : "score-status-tab"}
              onClick={() => updateFilters({ status: status.key })}
              aria-pressed={filters.status === status.key}
            >
              <span>{status.label}</span>
              <small>{status.count}</small>
            </button>
          ))}
        </div>

        <div
          id="score-filter-controls"
          className={filtersExpanded ? "score-filter-collapse is-open" : "score-filter-collapse"}
          hidden={!filtersExpanded}
        >
          <div className="score-filter-row score-filter-controls">
            <div className="score-filter-group">
              <div className="score-filter-label">
                <span>View</span>
              </div>
              <ScoreFilterMenu
                id="score-filter-view"
                value={filters.priority}
                options={priorityOptions}
                openMenu={openFilterMenu}
                onOpenChange={setOpenFilterMenu}
                onSelect={(value) => updateFilters({ priority: value })}
              />
            </div>

            <div className="score-filter-group">
              <div className="score-filter-label">
                <span>Sport</span>
              </div>
              <ScoreFilterMenu
                id="score-filter-sport"
                value={filters.sport}
                options={sportOptions}
                openMenu={openFilterMenu}
                onOpenChange={setOpenFilterMenu}
                onSelect={selectSport}
              />
            </div>

            <div className="score-filter-group">
              <div className="score-filter-label">
                <span>Competition</span>
              </div>
              <ScoreFilterMenu
                id="score-filter-competition"
                value={filters.competition}
                options={competitionOptions}
                openMenu={openFilterMenu}
                onOpenChange={setOpenFilterMenu}
                onSelect={(value) => {
                  const competition = scoreCompetitionFilters.find((option) => option.key === value);
                  if (competition) selectCompetition(competition);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="score-list">
        {loading && scores.length === 0 ? (
          <LoadingRows />
        ) : filteredScores.length ? (
          visibleScores.map((score) => (
            <ScoreRow
              key={score.id}
              score={score}
              selected={score.id === selectedScoreId}
              onSelect={() => onSelectScore(score)}
            />
          ))
        ) : (
          <EmptyState
            icon={error ? WifiOff : Activity}
            title={error && !fromCache ? "Scores unavailable" : "No matches found"}
            detail={error && !fromCache ? error : "Adjust the priority, sport, status or search filters"}
          />
        )}
      </div>

      {hiddenScoreCount > 0 ? (
        <div className="score-list-footer">
          <button
            type="button"
            className="score-list-more"
            onClick={() => setScoreListExpanded(true)}
            aria-label={`Show ${hiddenScoreCount.toLocaleString()} more score matches`}
          >
            <span>Show {hiddenScoreCount.toLocaleString()} more</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function useMediaQuery(query: string) {
  const readQuery = () => (typeof window === "undefined" ? false : window.matchMedia(query).matches);
  const [matches, setMatches] = useState(readQuery);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function RefreshIconButton({
  className = "mini-button icon-only-button",
  onRefresh,
  label,
  title = label,
  size = 15,
}: {
  className?: string;
  onRefresh: () => void;
  label: string;
  title?: string;
  size?: number;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const animationTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimer.current !== null && typeof window !== "undefined") {
        window.clearTimeout(animationTimer.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (typeof window !== "undefined") {
      if (animationTimer.current !== null) window.clearTimeout(animationTimer.current);
      setIsPressed(false);
      window.requestAnimationFrame(() => {
        setIsPressed(true);
        animationTimer.current = window.setTimeout(() => setIsPressed(false), 680);
      });
    }
    onRefresh();
  };

  return (
    <button
      type="button"
      className={`${className} refresh-icon-button${isPressed ? " is-pressed" : ""}`}
      onClick={handleClick}
      aria-label={label}
      title={title}
    >
      <RefreshCw className="refresh-button-icon" size={size} aria-hidden="true" />
    </button>
  );
}

function ScoreFilterMenu<TValue extends string>({
  id,
  value,
  options,
  openMenu,
  onOpenChange,
  onSelect,
}: {
  id: string;
  value: TValue;
  options: Array<{ key: TValue; label: string; count: number }>;
  openMenu: string;
  onOpenChange: (id: string) => void;
  onSelect: (value: TValue) => void;
}) {
  const selectedOption = options.find((option) => option.key === value) ?? options[0];
  const isOpen = openMenu === id;

  return (
    <div
      className="score-filter-menu"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          onOpenChange("");
        }
      }}
    >
      <button
        type="button"
        className={isOpen ? "score-filter-menu-button is-open" : "score-filter-menu-button"}
        onClick={() => onOpenChange(isOpen ? "" : id)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
      >
        <span>{selectedOption.label}</span>
        <small>{selectedOption.count}</small>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="score-filter-menu-popover" id={`${id}-menu`} role="listbox">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={option.key === value ? "score-filter-menu-option is-selected" : "score-filter-menu-option"}
              onClick={() => {
                onSelect(option.key);
                onOpenChange("");
              }}
              role="option"
              aria-selected={option.key === value}
            >
              <span>{option.label}</span>
              <small>{option.count}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScoreRow({
  score,
  selected,
  onSelect,
}: {
  score: SportScoreMatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = sportAccent(score.sport);

  return (
    <button
      type="button"
      className={`score-row is-${score.status} is-${accent}${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="score-team is-home">
        <TeamMark badge={score.homeLogo} name={score.homeTeam} accent={accent} size="small" />
        <strong>{score.homeTeam}</strong>
      </span>
      <span className="score-center-block">
        <span className={`score-state is-${score.status}`}>{scoreStatusLabel(score)}</span>
        <strong>{sportScoreLine(score)}</strong>
        <small>{score.timeLabel || score.dateLabel || score.statusText}</small>
      </span>
      <span className="score-team is-away">
        <strong>{score.awayTeam}</strong>
        <TeamMark badge={score.awayLogo} name={score.awayTeam} accent={accent} size="small" />
      </span>
      <span className="score-competition">
        <span className="score-competition-copy">
          <small>{score.sportLabel}</small>
          <span>{score.competition}</span>
        </span>
        <ChevronRight size={15} aria-hidden="true" />
      </span>
    </button>
  );
}

function ScoreInsightPanel({
  panelRef,
  score,
  insight,
  loading,
  error,
  fromCache,
  onRefresh,
}: {
  panelRef?: RefObject<HTMLElement | null>;
  score: SportScoreMatch | null;
  insight: SportScoreInsight | null;
  loading: boolean;
  error: string;
  fromCache: boolean;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ScoreInsightTab>("match");

  useEffect(() => {
    setActiveTab("match");
  }, [score?.id]);

  if (!score) {
    return (
      <section ref={panelRef} className="score-insight-panel" aria-label="Score details">
        <EmptyState icon={Activity} title="No match selected" detail="Choose a score to view match context" />
      </section>
    );
  }

  const detail = insight?.detail ?? null;
  const lineups = detail?.lineups ?? null;
  const standings = insight?.standings ?? null;
  const hasLeaders = Boolean(insight?.goalLeaders?.leaders.length || insight?.assistLeaders?.leaders.length);
  const hasTeams = Boolean(insight?.homeSchedule?.matches.length || insight?.awaySchedule?.matches.length);
  const contextErrorMessage = error && !fromCache ? error : "";

  return (
    <section ref={panelRef} className="score-insight-panel" aria-label="Score details">
      <div className="score-insight-header">
        <div className="score-insight-matchup">
          <div className="score-insight-team is-home">
            <TeamMark badge={score.homeLogo} name={score.homeTeam} accent={sportAccent(score.sport)} size="regular" />
            <span>
              <small>Home</small>
              <strong>{score.homeTeam}</strong>
            </span>
          </div>
          <div className="score-insight-score">
            <span className={`score-state is-${score.status}`}>{scoreStatusLabel(score)}</span>
            <strong>{sportScoreLine(score)}</strong>
            <small>{score.dateLabel || score.timeLabel || score.statusText}</small>
          </div>
          <div className="score-insight-team is-away">
            <span>
              <small>Away</small>
              <strong>{score.awayTeam}</strong>
            </span>
            <TeamMark badge={score.awayLogo} name={score.awayTeam} accent={sportAccent(score.sport)} size="regular" />
          </div>
        </div>
        <div className="score-insight-meta">
          <span>{score.competition}</span>
          <RefreshIconButton
            className="mini-button icon-only-button"
            onRefresh={onRefresh}
            label="Reload match context"
            title="Reload match context"
          />
        </div>
      </div>

      {contextErrorMessage ? (
        <div className="score-context-status">
          <strong>{contextErrorMessage}</strong>
        </div>
      ) : null}

      <div className="score-insight-tabs" role="tablist" aria-label="Match context">
        <InsightTabButton label="Match" active={activeTab === "match"} onClick={() => setActiveTab("match")} />
        <InsightTabButton
          label="Table"
          active={activeTab === "table"}
          disabled={!standings?.tables.length}
          onClick={() => setActiveTab("table")}
        />
        <InsightTabButton
          label="Leaders"
          active={activeTab === "leaders"}
          disabled={!hasLeaders}
          onClick={() => setActiveTab("leaders")}
        />
        <InsightTabButton
          label="Teams"
          active={activeTab === "teams"}
          disabled={!hasTeams}
          onClick={() => setActiveTab("teams")}
        />
      </div>

      <div className="score-insight-body">
        {activeTab === "match" ? (
          <MatchContextTab score={score} detail={detail} lineups={lineups} loading={loading} />
        ) : null}
        {activeTab === "table" ? (
          <TableContextTab standings={standings} bracket={insight?.bracket ?? null} />
        ) : null}
        {activeTab === "leaders" ? (
          <LeadersContextTab goals={insight?.goalLeaders ?? null} assists={insight?.assistLeaders ?? null} />
        ) : null}
        {activeTab === "teams" ? (
          <TeamsContextTab home={insight?.homeSchedule ?? null} away={insight?.awaySchedule ?? null} />
        ) : null}
      </div>
    </section>
  );
}

function InsightTabButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "score-insight-tab is-active" : "score-insight-tab"}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function MatchContextTab({
  score,
  detail,
  lineups,
  loading,
}: {
  score: SportScoreMatch;
  detail: SportScoreInsight["detail"];
  lineups: SportScoreLineups | null;
  loading: boolean;
}) {
  const incidents = detail?.incidents ?? [];
  const stats = detail?.stats ?? [];

  return (
    <div className="score-context-stack">
      {stats.length ? (
        <section className="score-context-card">
          <div className="score-context-heading">
            <h3>Stats</h3>
          </div>
          <div className="score-stat-list">
            {stats.slice(0, 8).map((stat) => (
              <div className="score-stat-row" key={stat.label}>
                <strong>{stat.home || "-"}</strong>
                <span>{stat.label}</span>
                <strong>{stat.away || "-"}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="score-context-card">
        <div className="score-context-heading">
          <h3>Timeline</h3>
          <span>{incidents.length ? `${incidents.length} events` : loading ? "Loading" : "No events"}</span>
        </div>
        {incidents.length ? (
          <TimelineList incidents={incidents} />
        ) : (
          <EmptyState icon={Clock3} title="No timeline yet" detail="Events will appear here when available" />
        )}
      </section>

      {lineups ? (
        <section className="score-context-card">
          <div className="score-context-heading">
            <h3>Lineups</h3>
            <span>{lineups.confirmed ? "Confirmed" : "Projected"}</span>
          </div>
          <LineupPreview
            homeTeam={score.homeTeam}
            awayTeam={score.awayTeam}
            homeFormation={lineups.homeFormation}
            awayFormation={lineups.awayFormation}
            homePlayers={lineups.homeXi}
            awayPlayers={lineups.awayXi}
          />
        </section>
      ) : null}
    </div>
  );
}

function TimelineList({ incidents }: { incidents: SportScoreIncident[] }) {
  return (
    <div className="timeline-list">
      {incidents.slice(0, 16).map((incident, index) => (
        <div className={`timeline-event is-${incident.side} is-${incident.category}`} key={`${incident.minute}-${incident.type}-${index}`}>
          <span className="timeline-minute">{incident.minute || "--"}</span>
          <span className="timeline-dot" />
          <span className="timeline-copy">
            <strong>{incident.type}</strong>
            <small>
              {incident.detail || incident.player || "Match event"}
              {incident.homeScore !== null || incident.awayScore !== null
                ? ` / ${scoreValue(incident.homeScore)}-${scoreValue(incident.awayScore)}`
                : ""}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}

function LineupPreview({
  homeTeam,
  awayTeam,
  homeFormation,
  awayFormation,
  homePlayers,
  awayPlayers,
}: {
  homeTeam: string;
  awayTeam: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: SportScoreLineupPlayer[];
  awayPlayers: SportScoreLineupPlayer[];
}) {
  return (
    <div className="lineup-preview">
      <LineupColumn team={homeTeam} formation={homeFormation} players={homePlayers} />
      <LineupColumn team={awayTeam} formation={awayFormation} players={awayPlayers} />
    </div>
  );
}

function LineupColumn({
  team,
  formation,
  players,
}: {
  team: string;
  formation: string;
  players: SportScoreLineupPlayer[];
}) {
  return (
    <div className="lineup-column">
      <div className="lineup-title">
        <strong>{team}</strong>
        {formation ? <small>{formation}</small> : null}
      </div>
      {players.slice(0, 11).map((player) => (
        <div className="lineup-player" key={`${team}-${player.number}-${player.name}`}>
          <span>{player.number || "-"}</span>
          <strong>{player.name}</strong>
          <small>{player.position}</small>
        </div>
      ))}
    </div>
  );
}

function TableContextTab({
  standings,
  bracket,
}: {
  standings: SportScoreInsight["standings"];
  bracket: SportScoreInsight["bracket"];
}) {
  const table = standings?.tables[0] ?? null;
  return (
    <div className="score-context-stack">
      {table ? (
        <section className="score-context-card">
          <div className="score-context-heading">
            <h3>{standings?.competition || "Standings"}</h3>
            <span>{table.group}</span>
          </div>
          <StandingTable rows={table.rows.slice(0, 12)} />
        </section>
      ) : (
        <EmptyState icon={Activity} title="No standings" detail="Table data is not available for this competition" />
      )}

      {bracket ? (
        <section className="score-context-card">
          <div className="score-context-heading">
            <h3>Bracket</h3>
            <span>{bracket.rounds.length} groups</span>
          </div>
          <div className="bracket-summary">
            {bracket.rounds.slice(0, 6).map((round, index) => (
              <span key={index}>{bracketRoundLabel(round, index)}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StandingTable({ rows }: { rows: SportScoreStandingRow[] }) {
  return (
    <div className="standings-table" role="table" aria-label="Standings">
      <div className="standings-row is-head" role="row">
        <span>#</span>
        <span>Team</span>
        <span>P</span>
        <span>W</span>
        <span>D</span>
        <span>L</span>
        <span>GD</span>
        <span>PTS</span>
      </div>
      {rows.map((row) => (
        <div className="standings-row" role="row" key={`${row.position}-${row.team}`}>
          <span>{row.position ?? "-"}</span>
          <span className="standings-team">
            <TeamMark badge={row.teamLogo} name={row.team} accent="generic" size="small" />
            <strong>{row.team}</strong>
          </span>
          <span>{row.played ?? "-"}</span>
          <span>{row.won ?? "-"}</span>
          <span>{row.drawn ?? "-"}</span>
          <span>{row.lost ?? "-"}</span>
          <span>{row.goalDifference ?? "-"}</span>
          <strong>{row.points ?? "-"}</strong>
        </div>
      ))}
    </div>
  );
}

function LeadersContextTab({
  goals,
  assists,
}: {
  goals: SportScoreInsight["goalLeaders"];
  assists: SportScoreInsight["assistLeaders"];
}) {
  return (
    <div className="leader-grid">
      <LeaderList title="Top Goals" leaders={goals?.leaders ?? []} stat="goals" />
      <LeaderList title="Top Assists" leaders={assists?.leaders ?? []} stat="assists" />
    </div>
  );
}

function LeaderList({
  title,
  leaders,
  stat,
}: {
  title: string;
  leaders: SportScoreLeader[];
  stat: LeaderStat;
}) {
  return (
    <section className="score-context-card">
      <div className="score-context-heading">
        <h3>{title}</h3>
      </div>
      <div className="leader-list">
        {leaders.length ? (
          leaders.slice(0, 8).map((leader) => (
            <div className="leader-row" key={`${title}-${leader.rank}-${leader.player}`}>
              <span>{leader.rank ?? "-"}</span>
              <TeamMark badge={leader.playerLogo || leader.teamLogo} name={leader.player} accent="generic" size="small" />
              <span className="leader-copy">
                <strong>{leader.player}</strong>
                <small>{leader.team}</small>
              </span>
              <strong>{stat === "goals" ? leader.goals ?? "-" : leader.assists ?? "-"}</strong>
            </div>
          ))
        ) : (
          <EmptyState icon={Activity} title="No leaders" detail="Leader data is not available" />
        )}
      </div>
    </section>
  );
}

function TeamsContextTab({
  home,
  away,
}: {
  home: SportScoreInsight["homeSchedule"];
  away: SportScoreInsight["awaySchedule"];
}) {
  return (
    <div className="team-form-grid">
      <TeamSchedulePanel schedule={home} />
      <TeamSchedulePanel schedule={away} />
    </div>
  );
}

function TeamSchedulePanel({ schedule }: { schedule: SportScoreInsight["homeSchedule"] }) {
  return (
    <section className="score-context-card">
      <div className="score-context-heading">
        <h3>{schedule?.team.name || "Team Form"}</h3>
        <span>{schedule?.matches.length ? `${schedule.matches.length} fixtures` : "No fixtures"}</span>
      </div>
      <div className="team-form-list">
        {schedule?.matches.length ? (
          schedule.matches.slice(0, 6).map((match) => (
            <div className="team-form-row" key={match.id}>
              <span className={`score-state is-${match.status}`}>{scoreStatusLabel(match)}</span>
              <strong>{match.homeTeam} vs {match.awayTeam}</strong>
              <small>{sportScoreLine(match)} / {match.dateLabel || match.timeLabel || match.statusText}</small>
            </div>
          ))
        ) : (
          <EmptyState icon={CalendarDays} title="No team fixtures" detail="Schedule data is not available" />
        )}
      </div>
    </section>
  );
}

function scoreStatusLabel(score: SportScoreMatch) {
  if (score.status === "live") return "Live";
  if (score.status === "upcoming") return "Next";
  if (score.status === "finished") return "FT";
  return score.statusText || "Match";
}

function scoreCounts(scores: SportScoreMatch[]) {
  return scores.reduce(
    (counts, score) => {
      if (score.status === "live") counts.live += 1;
      if (score.status === "upcoming") counts.upcoming += 1;
      if (score.status === "finished") counts.finished += 1;
      return counts;
    },
    { live: 0, upcoming: 0, finished: 0 },
  );
}

function filterScoreMatches(scores: SportScoreMatch[], filters: ScoreFilters) {
  const queryTokens = scoreSearchTokens(filters.query);
  let filteredScores = scores;

  if (filters.priority === "main") {
    const mainMatches = filteredScores.filter(isMainSportScoreMatch);
    filteredScores = mainMatches.length ? mainMatches : filteredScores.slice(0, 12);
  } else if (filters.priority === "others") {
    filteredScores = filteredScores.filter((score) => !isMainSportScoreMatch(score));
  }

  if (filters.sport !== "all") {
    filteredScores = filteredScores.filter((score) => score.sport === filters.sport);
  }

  if (filters.competition !== "all") {
    filteredScores = filteredScores.filter((score) => scoreMatchesCompetitionFilter(score, filters.competition));
  }

  if (filters.status !== "all") {
    filteredScores = filteredScores.filter((score) => score.status === filters.status);
  }

  if (queryTokens.length) {
    filteredScores = filteredScores.filter((score) => scoreMatchesScoreSearch(score, queryTokens));
  }

  return sortScoreMatchesForDisplay(filteredScores);
}

function scoreSearchTokens(query: string) {
  return normalizeSearchValue(query.trim())
    .split(/\s+/)
    .filter((token) => token && !scoreSearchStopWords.has(token));
}

function scoreMatchesScoreSearch(score: SportScoreMatch, queryTokens: string[]) {
  const searchText = normalizeSearchValue(
    [
      score.homeTeam,
      score.awayTeam,
      score.competition,
      score.sport,
      score.sportLabel,
      score.status,
      score.statusText,
      score.dateLabel,
      score.timeLabel,
      scoreCompetitionSearchAliases(score),
    ].join(" "),
  );
  return queryTokens.every((token) => searchText.includes(token));
}

function scoreFiltersMatch(left: ScoreFilters, right: ScoreFilters) {
  return (
    left.priority === right.priority &&
    left.sport === right.sport &&
    left.status === right.status &&
    left.competition === right.competition &&
    left.query === right.query
  );
}

function scoreMatchesCompetitionFilter(score: SportScoreMatch, competition: ScoreCompetitionFilter) {
  if (competition === "all") return true;

  const text = normalizeSearchValue(`${score.sport} ${score.competition} ${score.statusText}`);
  if (competition === "fifa") return score.sport === "football" && /\bfifa\b|\bworld cup\b|\bclub world cup\b/.test(text);
  if (competition === "uefa") return score.sport === "football" && /\buefa\b|\beuro\b|\bchampions league\b|\beuropa league\b|\bconference league\b|\bnations league\b/.test(text);
  if (competition === "epl") return score.sport === "football" && /\bpremier league\b|\benglish premier league\b|\bepl\b/.test(text);
  if (competition === "nba") return score.sport === "basketball" && /\bnba\b|\bwnba\b/.test(text);
  if (competition === "icc") return score.sport === "cricket" && /\bicc\b|\bworld cup\b|\bt20\b|\bodi\b|\bchampions trophy\b/.test(text);
  if (competition === "ipl") return score.sport === "cricket" && /\bipl\b|\bindian premier league\b/.test(text);
  if (competition === "tennis-majors") return score.sport === "tennis" && /\bwimbledon\b|\bus open\b|\baustralian open\b|\bfrench open\b|\broland garros\b/.test(text);
  return true;
}

function scoreCompetitionSearchAliases(score: SportScoreMatch) {
  return scoreCompetitionFilters
    .filter((competition) => competition.key !== "all" && scoreMatchesCompetitionFilter(score, competition.key))
    .map((competition) => competition.label)
    .join(" ");
}

function sortScoreMatchesForDisplay(scores: SportScoreMatch[]) {
  return [...scores].sort((a, b) => {
    const statusDifference = scoreStatusWeight(a.status) - scoreStatusWeight(b.status);
    if (statusDifference) return statusDifference;
    const priorityDifference = scoreMatchPriority(a) - scoreMatchPriority(b);
    if (priorityDifference) return priorityDifference;
    const aTime = a.startsAt ?? 0;
    const bTime = b.startsAt ?? 0;
    return a.status === "finished" ? bTime - aTime : aTime - bTime;
  });
}

function scoreStatusWeight(status: SportScoreMatch["status"]) {
  if (status === "live") return 0;
  if (status === "upcoming") return 1;
  if (status === "finished") return 2;
  return 3;
}

function scoreValue(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  return String(value);
}

function bracketRoundLabel(value: unknown, index: number) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const label = record.name ?? record.round ?? record.stage ?? record.title;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return `Group ${index + 1}`;
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: AppIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="summary-metric">
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamMark({
  badge,
  name,
  sportIcon,
  accent,
  size = "regular",
  showInitials = true,
}: {
  badge?: string;
  name: string;
  sportIcon?: string;
  accent: string;
  size?: "small" | "regular" | "large";
  showInitials?: boolean;
}) {
  const imageSources = [badge, sportIcon].filter(
    (source, index, sources): source is string => Boolean(source) && sources.indexOf(source) === index,
  );
  const [failedImageSources, setFailedImageSources] = useState<string[]>([]);
  const imageSrc = imageSources.find((source) => !failedImageSources.includes(source)) || "";

  if (!imageSrc && !showInitials) return null;

  return (
    <span className={`team-mark is-${accent} is-${size}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onError={() => setFailedImageSources((sources) => [...sources, imageSrc])}
        />
      ) : showInitials ? (
        <span>{initials(name || "BM")}</span>
      ) : null}
    </span>
  );
}

function HomeSportCard({
  sport,
  onSelect,
}: {
  sport: HeaderSportSummary;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`home-sport-card is-${sport.accent}`}
      onClick={onSelect}
      aria-label={`${sport.label}: ${sport.live} live, ${sport.upcoming} next`}
    >
      <span className="home-sport-shade" />
      <span className="home-sport-main">
        <span className="home-sport-icon">
          <img src={sport.iconSrc} alt="" loading="lazy" decoding="async" draggable="false" />
        </span>
        <span className="home-sport-copy">
          <strong>{sport.label}</strong>
          <small>{sport.servers.toLocaleString()} live feeds</small>
        </span>
      </span>
      <span className="home-sport-metrics">
        <span>
          <strong>{sport.live}</strong>
          <small>Live</small>
        </span>
        <span>
          <strong>{sport.upcoming}</strong>
          <small>Next</small>
        </span>
      </span>
    </button>
  );
}

function CatalogNotice({
  error,
  fromCache,
  updatedAt,
  onRefresh,
}: {
  error: string;
  fromCache: boolean;
  updatedAt: number | null;
  onRefresh: () => void;
}) {
  const message = error
    ? fromCache
      ? `Refresh failed. Showing cached games${updatedAt ? ` from ${timeAgo(updatedAt)}` : ""}.`
      : error
    : `Using cached games${updatedAt ? ` from ${timeAgo(updatedAt)}` : ""} while fresh data loads.`;

  return (
    <section className={error ? "catalog-notice is-warning" : "catalog-notice"} role="status">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" className="mini-button" onClick={onRefresh}>
        Retry
      </button>
    </section>
  );
}

function MatchCard({
  match,
  score,
  selected,
  onSelect,
}: {
  match: Match;
  score?: SportScoreMatch | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = sportAccent(match.sportKey);
  const dateLabel = match.status === "live" ? "Now" : match.dateLabel || "TBA";
  const timeLabel =
    match.status === "live"
      ? match.timeLabel && match.timeLabel !== "Now"
        ? match.timeLabel
        : ""
      : match.timeLabel || "";
  const sportIcon = sportIconForKey(match.sportKey);
  const useSportMark = Boolean(sportIcon && !match.awayTeam && !match.homeBadge);
  const hasAwayTeam = Boolean(match.awayTeam);
  const hasPoster = Boolean(match.poster);
  const cardStyle = matchCardBackgroundStyle(match, sportIcon);
  const scoreLine = score ? sportScoreLine(score) : "";
  const selectable = isStreamSelectable(match);
  const showTrailingMeta = !selectable || !score || scoreLine.trim().toLowerCase() !== "vs";

  return (
    <button
      type="button"
      className={`match-card is-${match.status} is-${accent}${hasPoster ? " has-poster" : ""}${selected ? " is-selected" : ""}${selectable ? "" : " is-unavailable"}`}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={!selectable}
      style={cardStyle}
      title={selectable ? undefined : "Stream unlocks when this match is live"}
    >
      <span className="match-card-body">
        <span className="match-card-top">
          <span className={match.status === "live" ? "event-tag is-live" : "event-tag is-upcoming"}>
            <span />
            {match.status === "live" ? "Live" : "Next"}
          </span>
          <span className="match-date-block">
            <strong>{dateLabel}</strong>
            {timeLabel ? <small>{timeLabel}</small> : null}
          </span>
        </span>

        <span className={hasAwayTeam ? "match-card-matchup" : "match-card-matchup is-channel"}>
          <span className="match-card-team is-home">
            <TeamMark
              badge={match.homeBadge}
              name={match.homeTeam}
              sportIcon={useSportMark ? sportIcon : undefined}
              accent={accent}
              size="small"
            />
            <span>
              <strong>{match.homeTeam}</strong>
              <small>{match.sportLabel}</small>
            </span>
          </span>
          {hasAwayTeam ? (
            <>
              <small className={score ? "match-card-vs has-score" : "match-card-vs"}>
                {score ? scoreLine : "VS"}
              </small>
              <span className="match-card-team is-away">
                <span>
                  <strong>{match.awayTeam}</strong>
                  <small>{score ? score.statusText : match.dateLabel || "Today"}</small>
                </span>
                <TeamMark
                  badge={match.awayBadge}
                  name={match.awayTeam}
                  accent={accent}
                  size="small"
                />
              </span>
            </>
          ) : (
          <small className="match-card-channel-label">{compactCompetitionLabel(match.league)}</small>
          )}
        </span>

        <span className="match-card-meta">
          <small>{match.sportLabel} · {compactCompetitionLabel(score?.competition || match.league)}</small>
          {showTrailingMeta ? <small>{selectable && score ? scoreLine : matchStreamMeta(match)}</small> : null}
        </span>
      </span>
    </button>
  );
}

type MatchCardStyle = CSSProperties & {
  "--match-card-bg"?: string;
  "--match-card-bg-opacity"?: string;
  "--match-card-bg-position"?: string;
  "--match-card-bg-repeat"?: string;
  "--match-card-bg-size"?: string;
};

function matchCardBackgroundStyle(match: Match, fallbackUrl: string): MatchCardStyle {
  const hasPoster = Boolean(match.poster);
  const backgroundLayers = [hasPoster ? match.poster : fallbackUrl]
    .filter(Boolean)
    .map((imageUrl) => `url("${cssUrlValue(imageUrl)}")`);
  if (!backgroundLayers.length) return {};

  return {
    "--match-card-bg": backgroundLayers.join(", "),
    "--match-card-bg-opacity": hasPoster ? "0.52" : "0.18",
    "--match-card-bg-position": hasPoster ? "center" : "right 20px center",
    "--match-card-bg-repeat": "no-repeat",
    "--match-card-bg-size": hasPoster ? "cover" : "112px",
  };
}

function cssUrlValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r]/g, "");
}

function HeaderNavButton({
  icon: Icon,
  label,
  href,
  active,
  onClick,
}: {
  icon?: AppIcon;
  label: string;
  href: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      className={active ? "header-nav-button is-active" : "header-nav-button"}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      aria-current={active ? "page" : undefined}
    >
      <span className="header-nav-button-label">
        {Icon ? (
          <span className="header-nav-icon">
            <Icon size={15} className="bm-nav-icon" aria-hidden="true" />
          </span>
        ) : null}
        <span>{label}</span>
      </span>
    </a>
  );
}

function ScheduleRow({
  match,
  score,
  selected,
  onSelect,
}: {
  match: Match;
  score?: SportScoreMatch | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = sportAccent(match.sportKey);
  const sportIcon = sportIconForKey(match.sportKey);
  const selectable = isStreamSelectable(match);

  return (
    <button
      type="button"
      className={`schedule-row${selected ? " is-selected" : ""}${selectable ? "" : " is-unavailable"}`}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={!selectable}
      title={selectable ? undefined : "Stream unlocks when this match is live"}
    >
      <span className="date-box">
        <strong>{match.dateLabel || "Today"}</strong>
        <small>{match.timeLabel || "TBA"}</small>
      </span>
      <TeamMark
        badge={match.homeBadge}
        name={match.homeTeam}
        sportIcon={!match.awayTeam ? sportIcon : undefined}
        accent={accent}
        size="small"
      />
      <span className="schedule-copy">
        <strong>{matchTitle(match)}</strong>
        <small>
          {selectable && score
            ? `${sportScoreLine(score)} / ${score.statusText}`
            : `${match.league} / ${matchStreamMeta(match)}`}
        </small>
      </span>
      {selectable ? <ChevronRight size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
    </button>
  );
}

function HealthItem({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`health-item is-${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamLine({ badge, name }: { badge: string; name: string }) {
  return (
    <span className="team-line">
      {badge ? (
        <img src={badge} alt="" className="team-badge" loading="lazy" />
      ) : (
        <span className="team-badge team-badge-fallback">{initials(name)}</span>
      )}
      <strong>{name}</strong>
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: AppIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={24} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </>
  );
}

function pickPreferredMatch(matches: Match[], preferredSportKey: string) {
  const playableMatches = matches.filter(isStreamSelectable);
  const preferredSportMatches = playableMatches.filter((match) => match.sportKey === preferredSportKey);

  return (
    preferredSportMatches.find(
      (match) => match.status === "live" && match.sources.some((source) => sourceRank(source) === 0),
    ) ??
    preferredSportMatches.find((match) => match.status === "live" && match.sources.length > 0) ??
    playableMatches.find(
      (match) => match.status === "live" && match.sources.some((source) => sourceRank(source) === 0),
    ) ??
    playableMatches.find((match) => match.status === "live" && match.sources.length > 0) ??
    null
  );
}

function currentPathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function currentMatchIdFromUrl() {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("match") ?? "").trim().slice(0, 200);
}

function seoRouteFromPath(pathname: string): SeoRoute {
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return (
    Object.values(seoRoutes).find((route) => route.path === normalizedPath) ??
    seoRoutes.home
  );
}

function seoRouteFromState(
  pageMode: PageMode,
  sportFilter: string,
  statusFilter: StatusFilter,
): SeoRoute {
  if (pageMode === "scores") return seoRoutes.scores;
  if (pageMode === "home") return seoRoutes.home;
  if (sportFilter === "football") return seoRoutes.football;
  if (sportFilter === "baseball") return seoRoutes.baseball;
  if (sportFilter === "basketball") return seoRoutes.basketball;
  if (sportFilter === "fight") return seoRoutes.fight;
  if (sportFilter === "cricket") return seoRoutes.cricket;
  if (sportFilter === "tennis") return seoRoutes.tennis;
  if (sportFilter === "volleyball") return seoRoutes.volleyball;
  if (statusFilter === "live") return seoRoutes.live;
  if (statusFilter === "upcoming") return seoRoutes.schedule;
  return seoRoutes.home;
}

function writeBrowserRoute(route: SeoRoute, mode: "push" | "replace", matchId = "") {
  if (typeof window === "undefined") return;
  const nextUrl = new URL(route.path, window.location.origin);
  if (matchId) nextUrl.searchParams.set("match", matchId);
  const relativeUrl = `${nextUrl.pathname}${nextUrl.search}`;
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  if (mode === "push" && currentUrl === relativeUrl) return;

  const state = { route: route.key, matchId: matchId || undefined };
  if (mode === "replace") {
    window.history.replaceState(state, "", relativeUrl);
  } else {
    window.history.pushState(state, "", relativeUrl);
  }
}

function copyTextFallback(value: string) {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function applyDocumentSeo(route: SeoRoute) {
  if (typeof document === "undefined") return;

  const url = canonicalUrl(route.path);
  document.title = route.title;
  setLinkHref('link[rel="canonical"]', { rel: "canonical" }, url);
  setMetaContent('meta[name="description"]', { name: "description" }, route.description);
  setMetaContent('meta[property="og:title"]', { property: "og:title" }, route.title);
  setMetaContent('meta[property="og:description"]', { property: "og:description" }, route.description);
  setMetaContent('meta[property="og:url"]', { property: "og:url" }, url);
  setMetaContent('meta[name="twitter:title"]', { name: "twitter:title" }, route.title);
  setMetaContent('meta[name="twitter:description"]', { name: "twitter:description" }, route.description);
}

function canonicalUrl(path: string) {
  return new URL(path, siteBaseUrl).toString();
}

function setMetaContent(selector: string, attributes: Record<string, string>, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => meta?.setAttribute(name, value));
    document.head.append(meta);
  }
  meta.setAttribute("content", content);
}

function setLinkHref(selector: string, attributes: Record<string, string>, href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    Object.entries(attributes).forEach(([name, value]) => link?.setAttribute(name, value));
    document.head.append(link);
  }
  link.setAttribute("href", href);
}

function preferredSourceIndex(match: Match) {
  if (!match.sources.length) return 0;
  let bestIndex = 0;
  let bestRank = Number.POSITIVE_INFINITY;

  match.sources.forEach((source, index) => {
    const rank = sourceRank(source);
    if (rank < bestRank) {
      bestIndex = index;
      bestRank = rank;
    }
  });

  return bestIndex;
}

function sourceRank(source: StreamSource) {
  const host = sourceHost(source.url);
  const name = source.name.toLowerCase();
  const lowerPriority =
    lowerPriorityHosts.some((value) => host.includes(value)) ||
    lowerPrioritySourceNames.some((value) => name.includes(value));
  if (lowerPriority) return 4;
  if (source.kind === "hls" || source.kind === "video") return 0;
  return 1;
}

function sportSummaryOrFallback(
  key: string,
  label: string,
  sportSummaries: Map<string, SportSummary>,
) {
  return (
    sportSummaries.get(key) ?? {
      key,
      label,
      total: 0,
      live: 0,
      upcoming: 0,
      servers: 0,
    }
  );
}

function sportIconForKey(key: string) {
  const visualKey = sportVisualKey(key);
  if (visualKey === "football") return footballIconUrl;
  if (visualKey === "baseball") return baseballIconUrl;
  if (visualKey === "basketball") return basketballIconUrl;
  if (visualKey === "fight") return fightIconUrl;
  if (visualKey === "cricket") return cricketIconUrl;
  if (visualKey === "tennis") return tennisIconUrl;
  if (visualKey === "volleyball") return volleyballIconUrl;
  return genericSportIconUrl;
}

function sportAccent(key: string) {
  return sportVisualKey(key);
}

function sportVisualKey(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes("football") || normalized.includes("soccer")) return "football";
  if (normalized.includes("baseball") || normalized.includes("mlb")) return "baseball";
  if (normalized.includes("basketball") || normalized.includes("nba") || normalized.includes("wnba")) return "basketball";
  if (normalized.includes("fight") || normalized.includes("boxing") || normalized.includes("mma") || normalized.includes("wwe") || normalized.includes("aew") || normalized.includes("wrestling")) return "fight";
  if (normalized.includes("cricket")) return "cricket";
  if (normalized.includes("tennis") || normalized.includes("atp") || normalized.includes("wta")) return "tennis";
  if (normalized.includes("volleyball")) return "volleyball";
  return "generic";
}

function sportRouteForKey(sportKey: string) {
  if (sportKey === "baseball") return seoRoutes.baseball;
  if (sportKey === "basketball") return seoRoutes.basketball;
  if (sportKey === "fight") return seoRoutes.fight;
  if (sportKey === "cricket") return seoRoutes.cricket;
  if (sportKey === "tennis") return seoRoutes.tennis;
  if (sportKey === "volleyball") return seoRoutes.volleyball;
  return seoRoutes.football;
}

function pageQueueTitle(
  sportFilter: string,
  statusFilter: StatusFilter,
  sportSummaries: Map<string, SportSummary>,
) {
  const sportLabel =
    sportFilter === "all"
      ? "All sports"
      : sportSummaries.get(sportFilter)?.label ?? formatSportKey(sportFilter);

  if (sportFilter !== "all" && statusFilter === "live") return `${sportLabel} Live Games`;
  if (sportFilter !== "all" && statusFilter === "upcoming") return `${sportLabel} Next Matches`;
  if (sportFilter !== "all") return `${sportLabel} Games`;
  if (statusFilter === "live") return "Live Games";
  if (statusFilter === "upcoming") return "Next Matches";
  return "Matches";
}

function pageScopeLabel(
  sportFilter: string,
  statusFilter: StatusFilter,
  sportSummaries: Map<string, SportSummary>,
) {
  const sportLabel =
    sportFilter === "all"
      ? "All sports"
      : sportSummaries.get(sportFilter)?.label ?? formatSportKey(sportFilter);

  if (sportFilter !== "all" && statusFilter === "live") return `${sportLabel} live games`;
  if (sportFilter !== "all" && statusFilter === "upcoming") return `${sportLabel} next matches`;
  if (sportFilter !== "all") return sportLabel;
  if (statusFilter === "live") return "Live";
  if (statusFilter === "upcoming") return "Next";
  return "All games";
}

function formatSportKey(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

function matchTitle(match: Match) {
  return match.awayTeam ? `${match.homeTeam} vs ${match.awayTeam}` : match.homeTeam;
}

function matchPresentation(match: Match, score: SportScoreMatch | null | undefined) {
  const sameDirection = score ? teamNamesMatch(match.homeTeam, score.homeTeam) : true;
  const scoreHomeBadge = score ? (sameDirection ? score.homeLogo : score.awayLogo) : "";
  const scoreAwayBadge = score ? (sameDirection ? score.awayLogo : score.homeLogo) : "";

  return {
    homeBadge: match.homeBadge || scoreHomeBadge,
    awayBadge: match.awayBadge || scoreAwayBadge,
    competition: score?.competition || match.league,
  };
}

function isStreamSelectable(match: Match) {
  return match.status === "live" && match.sources.length > 0;
}

function matchStreamMeta(match: Match) {
  if (!isStreamSelectable(match)) return "Not live yet";
  return `${match.sources.length} live ${match.sources.length === 1 ? "feed" : "feeds"}`;
}

function compactCompetitionLabel(value: string) {
  const label = value.trim();
  const normalized = normalizeSearchValue(label);

  if (/\bwomen'?s national basketball association\b/.test(normalized)) return "WNBA";
  if (/\bnational basketball association\b/.test(normalized)) return "NBA";
  if (/\bmajor league baseball\b/.test(normalized)) return "MLB";
  if (/\bnational football league\b/.test(normalized)) return "NFL";

  return label;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sourceDisplayName(source: StreamSource) {
  const name = source.name.trim();
  if (name && !looksLikeHost(name)) return name;
  return sourceKindLabel(source.kind) === "Web" ? "Web player" : "Stream source";
}

function sourceCompactDisplayName(source: StreamSource) {
  return compactSourceName(sourceDisplayName(source));
}

function compactSourceName(value: string) {
  const compact = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*[\[(][^\])]*(?:1080p|720p|576p|50fps|60fps|hevc|h\.?26[45]|fhd|uhd|hd)[^\])]*[\])]\s*/gi, " ")
    .replace(/\bBBC\s+ONE\b/gi, "BBC 1")
    .replace(/\bBBC\s+TWO\b/gi, "BBC 2")
    .replace(/\bBBC\s+THREE\b/gi, "BBC 3")
    .replace(/\bBBC\s+FOUR\b/gi, "BBC 4")
    .replace(/\bbeIN\s+Sports\b/gi, "beIN")
    .replace(/\bSports\b/gi, "")
    .replace(/\bSport\b/gi, "")
    .replace(/\bChannel\b/gi, "")
    .replace(/\bStream\b/gi, "")
    .replace(/\bTelevision\b/gi, "TV")
    .replace(/\bUnited States\b/gi, "US")
    .replace(/\bUnited Kingdom\b/gi, "UK")
    .replace(/\bPortugal\b/gi, "PT")
    .replace(/\bGermany\b/gi, "DE")
    .replace(/\bFrance\b/gi, "FR")
    .replace(/\bSpain\b/gi, "ES")
    .replace(/\bItaly\b/gi, "IT")
    .replace(/\bCanada\b/gi, "CA")
    .replace(/\bAustralia\b/gi, "AU")
    .replace(/\bBrazil\b/gi, "BR")
    .replace(/\bIndia\b/gi, "IN")
    .replace(/\bServer\s+0+(\d+)\b/gi, "Server $1")
    .replace(/\s+/g, " ")
    .replace(/\s+([:|/-])\s+/g, "$1")
    .trim();

  return compact || value;
}

function sourceKindLabel(kind: StreamSource["kind"]) {
  if (kind === "hls") return "HLS";
  if (kind === "dash") return "DASH";
  if (kind === "video") return "Video";
  if (kind === "iframe") return "Web";
  return "Link";
}

function matchSearchText(match: Match) {
  return normalizeSearchValue([
    match.name,
    match.homeTeam,
    match.awayTeam,
    match.league,
    match.sportLabel,
    match.category,
    match.status,
    match.dateLabel,
    match.timeLabel,
    ...match.sources.flatMap((source) => [source.name, source.kind]),
  ]
    .join(" "));
}

function matchMatchesSearch(match: Match, normalizedSearch: string) {
  const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  const searchText = matchSearchText(match);
  return tokens.every((token) => searchText.includes(token));
}

function searchResultStats(matches: Match[]) {
  return matches.reduce(
    (stats, match) => {
      stats.total += 1;
      if (match.status === "live") stats.live += 1;
      if (match.status === "upcoming") stats.upcoming += 1;
      if (match.sportKey === "football") stats.football += 1;
      if (match.sportKey === "baseball") stats.baseball += 1;
      if (match.sportKey === "basketball") stats.basketball += 1;
      if (match.sportKey === "fight") stats.fight += 1;
      if (match.sportKey === "cricket") stats.cricket += 1;
      if (match.sportKey === "tennis") stats.tennis += 1;
      if (match.sportKey === "volleyball") stats.volleyball += 1;
      return stats;
    },
    {
      total: 0,
      live: 0,
      upcoming: 0,
      football: 0,
      baseball: 0,
      basketball: 0,
      fight: 0,
      cricket: 0,
      tennis: 0,
      volleyball: 0,
    },
  );
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeHost(value: string) {
  return /https?:\/\//i.test(value) || /\.[a-z]{2,}($|[/:?])/i.test(value);
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function sourceHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
