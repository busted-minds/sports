import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Ellipsis,
  ExternalLink,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import type { ComponentType, CSSProperties, Dispatch, SetStateAction } from "react";
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
const cricketIconUrl = "/icons/sport-cricket.png";
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
const featuredSportKeys = ["football", "cricket"];
type PageMode = "home" | "slate" | "scores";
type StatusFilter = "all" | "live" | "upcoming";
type NavigableStatus = Extract<StatusFilter, "live" | "upcoming">;
type SearchScopeKey = "all" | "live" | "upcoming" | "football" | "cricket";
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

export default function App() {
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
  const [sourceIndex, setSourceIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageMode, setPageMode] = useState<PageMode>("home");
  const playerSectionRef = useRef<HTMLDivElement | null>(null);

  const games = useMemo(
    () => matches.filter((match) => match.status === "live" || match.status === "upcoming"),
    [matches],
  );
  const slateStats = useMemo<SlateStats>(() => {
    return games.reduce(
      (stats, match) => {
        if (match.status === "live") stats.live += 1;
        if (match.status === "upcoming") stats.upcoming += 1;
        stats.servers += match.sources.length;
        stats.primarySources += match.sources.filter((source) => sourceRank(source) < 4).length;
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
      current.servers += match.sources.length;
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
        ...sportSummaryOrFallback("cricket", "Cricket", sportSummaries),
        iconSrc: cricketIconUrl,
        accent: "cricket",
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
    () => games.filter((match) => match.status === "live").slice(0, 6),
    [games],
  );
  const upcomingGames = useMemo(
    () => games.filter((match) => match.status === "upcoming").slice(0, 6),
    [games],
  );
  const selectedMatch = useMemo(
    () => games.find((match) => match.id === selectedId) ?? null,
    [games, selectedId],
  );
  const selectedScoreMatch = useMemo(
    () => findSportScoreForMatch(selectedMatch, scoreMatches),
    [scoreMatches, selectedMatch],
  );
  const selectedSource = selectedMatch?.sources[sourceIndex] ?? selectedMatch?.sources[0] ?? null;
  const hasNextSource = (selectedMatch?.sources.length ?? 0) > 1;
  const searchActive = Boolean(normalizedSearch);
  const homePageActive = pageMode === "home";
  const livePageActive = pageMode === "slate" && sportFilter === "all" && statusFilter === "live";
  const scoresPageActive = pageMode === "scores";
  const footballPageActive = pageMode === "slate" && statusFilter === "all" && sportFilter === "football";
  const cricketPageActive = pageMode === "slate" && statusFilter === "all" && sportFilter === "cricket";
  const mobileMoreActive = livePageActive || scoresPageActive;
  const queueTitle = pageQueueTitle(sportFilter, statusFilter, sportSummaries);
  const pageScope = pageScopeLabel(sportFilter, statusFilter, sportSummaries);

  useEffect(() => {
    if (!games.length) {
      if (selectedId) setSelectedId("");
      return;
    }

    const selectableGames = filteredGames.length ? filteredGames : pageGames.length ? pageGames : games;
    if (selectedId && selectableGames.some((match) => match.id === selectedId)) return;

    const nextMatch = pickPreferredMatch(selectableGames, defaultSportKey);
    if (nextMatch) setSelectedId(nextMatch.id);
  }, [filteredGames, games, pageGames, selectedId]);

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

  const clearSearch = () => {
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
  };

  const applySearchScope = (scope: SearchScopeKey) => {
    setPageMode("slate");
    setMobileMoreOpen(false);

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
    setPageMode("home");
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportFilter("all");
    setStatusFilter("all");
  };

  const openStatusPage = (nextStatus: NavigableStatus) => {
    const nextMatch = pickPreferredMatch(
      games.filter((match) => match.status === nextStatus),
      defaultSportKey,
    );
    setPageMode("slate");
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportFilter("all");
    setStatusFilter(nextStatus);
    setSelectedId(nextMatch?.id ?? "");
  };

  const openScores = () => {
    setPageMode("scores");
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportFilter("all");
    setStatusFilter("all");
  };

  const openMatch = (match: Match) => {
    setSelectedId(match.id);
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setStatusFilter(match.status === "upcoming" ? "upcoming" : match.status === "live" ? "live" : "all");
    setPageMode("slate");
    showPlayerOnMobile();
  };

  const selectMatchFromList = (match: Match) => {
    setSelectedId(match.id);
    showPlayerOnMobile();
  };

  const showPlayerOnMobile = () => {
    if (!window.matchMedia("(max-width: 820px)").matches) return;
    window.requestAnimationFrame(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openSport = (sportKey: string) => {
    const nextMatch = pickPreferredMatch(
      games.filter((match) => match.sportKey === sportKey),
      sportKey,
    );
    setSearchTerm("");
    setMobileSearchOpen(false);
    setMobileMoreOpen(false);
    setSportFilter(sportKey);
    setStatusFilter("all");
    setPageMode("slate");
    setSelectedId(nextMatch?.id ?? "");
  };

  const handleSearchChange = (value: string) => {
    const nextSearchActive = Boolean(value.trim());
    const wasSearchActive = Boolean(searchTerm.trim());
    setSearchTerm(value);
    if (nextSearchActive) {
      setPageMode("slate");
      setMobileMoreOpen(false);
      if (!wasSearchActive) {
        setSportFilter("all");
        setStatusFilter("all");
      }
    }
  };
  const toggleMobileSearch = () => {
    setMobileMoreOpen(false);
    setMobileSearchOpen((isOpen) => !isOpen);
  };
  const toggleMobileMore = () => {
    setMobileSearchOpen(false);
    setMobileMoreOpen((isOpen) => !isOpen);
  };
  const selectedHeaderAccent = selectedMatch ? sportAccent(selectedMatch.sportKey) : "generic";
  const selectedSportIcon = selectedMatch ? sportIconForKey(selectedMatch.sportKey) : "";

  return (
    <div className={searchActive ? "app-shell is-searching" : "app-shell"}>
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
          <label className="search-box header-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search teams, leagues"
              aria-label="Search games"
              autoComplete="off"
              enterKeyHint="search"
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
            ) : null}
          </label>

          <div className="header-status-strip" role="group" aria-label="Main pages">
            <HeaderNavButton
              icon={HomeNavIcon}
              label="Home"
              active={homePageActive}
              onClick={openHome}
            />
            <HeaderNavButton
              icon={LiveNavIcon}
              label="Live"
              count={slateStats.live}
              active={livePageActive}
              onClick={() => openStatusPage("live")}
            />
            <HeaderNavButton
              icon={Activity}
              label="Scores"
              count={scoreMatches.length}
              active={scoresPageActive}
              onClick={openScores}
            />
          </div>

          <div className="header-sport-strip" role="group" aria-label="Primary sport pages">
            {sportFocusItems.map((sport) => (
              <HeaderSportButton
                key={sport.key}
                sport={sport}
                active={pageMode === "slate" && statusFilter === "all" && sportFilter === sport.key}
                onSelect={() => openSport(sport.key)}
              />
            ))}
          </div>
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

      <main className="app-main">
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
                      <NextNavIcon size={14} aria-hidden="true" />
                    )}
                    {selectedMatch?.status === "live" ? "Live" : "Upcoming"}
                  </span>
                  <div className="topline-actions">
                    <span className="source-kind">
                      {selectedSource
                        ? `${sourceKindLabel(selectedSource.kind)} · ${sourceDisplayName(selectedSource)}`
                        : "No source"}
                    </span>
                    {hasNextSource ? (
                      <button type="button" className="mini-button" onClick={useNextSource}>
                        Next
                      </button>
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
                      <small>
                        {selectedScoreMatch
                          ? `${selectedScoreMatch.statusText} / ${selectedScoreMatch.competition}`
                          : selectedMatch.league}
                      </small>
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
                    selectedMatch.sources.map((source, index) => (
                      <button
                        key={source.id}
                        type="button"
                        className={index === sourceIndex ? "source-button is-active" : "source-button"}
                        onClick={() => setSourceIndex(index)}
                        aria-pressed={index === sourceIndex}
                        title={`${sourceDisplayName(source)} - ${sourceKindLabel(source.kind)}`}
                      >
                        <span className="source-name">{sourceDisplayName(source)}</span>
                        <span className="source-meta">
                          <small>{sourceKindLabel(source.kind)}</small>
                          <small>{sourceReliabilityLabel(source)}</small>
                        </span>
                      </button>
                    ))
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
                      label="Cricket"
                      count={searchStats.cricket}
                      active={sportFilter === "cricket" && statusFilter === "all"}
                      onClick={() => applySearchScope("cricket")}
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
                ) : filteredGames.length ? (
                  filteredGames.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      score={findSportScoreForMatch(match, scoreMatches)}
                      selected={match.id === selectedId}
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
                      selected={match.id === selectedId}
                      onSelect={() => setSelectedId(match.id)}
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
                  label="Available feeds"
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
          <div id="mobile-more-menu" className="mobile-more-menu" aria-label="More navigation">
            <button
              type="button"
              className={livePageActive ? "mobile-more-action is-active" : "mobile-more-action"}
              onClick={() => openStatusPage("live")}
              aria-current={livePageActive ? "page" : undefined}
            >
              <LiveNavIcon size={18} aria-hidden="true" />
              <span>Live</span>
              <small>{slateStats.live}</small>
            </button>
            <button
              type="button"
              className={scoresPageActive ? "mobile-more-action is-active" : "mobile-more-action"}
              onClick={openScores}
              aria-current={scoresPageActive ? "page" : undefined}
            >
              <Activity size={18} aria-hidden="true" />
              <span>Scores</span>
              <small>{scoreMatches.length}</small>
            </button>
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
          className={footballPageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={() => openSport("football")}
          aria-current={footballPageActive ? "page" : undefined}
        >
          <img src={footballIconUrl} alt="" aria-hidden="true" />
          <span>Football</span>
        </button>
        <button
          type="button"
          className={cricketPageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={() => openSport("cricket")}
          aria-current={cricketPageActive ? "page" : undefined}
        >
          <img src={cricketIconUrl} alt="" aria-hidden="true" />
          <span>Cricket</span>
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
        >
          <Ellipsis size={18} aria-hidden="true" />
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

function HeaderSportButton({
  sport,
  active,
  onSelect,
}: {
  sport: HeaderSportSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? `header-sport is-${sport.accent} is-active` : `header-sport is-${sport.accent}`}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      aria-label={`${sport.label}: ${sport.total} games, ${sport.live} live, ${sport.upcoming} upcoming`}
    >
      <span className="header-sport-icon">
        <img src={sport.iconSrc} alt="" decoding="async" draggable="false" />
      </span>
      <span className="header-sport-copy">
        <strong>{sport.label}</strong>
        <small>
          {sport.live} live · {sport.upcoming} next
        </small>
      </span>
      <span className="header-sport-count">{sport.total}</span>
    </button>
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
  const heroStatus = heroMatch?.status === "upcoming" ? "Next" : "Live";
  const heroAccent = heroMatch ? sportAccent(heroMatch.sportKey) : "generic";
  const heroSportIcon = heroMatch ? sportIconForKey(heroMatch.sportKey) : "";
  const heroMeta = heroMatch
    ? [heroMatch.sportLabel, heroMatch.league, heroMatch.timeLabel || heroMatch.dateLabel]
        .filter(Boolean)
        .join(" / ")
    : "Busted Minds Sports";

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
          {heroMatch ? (
            <span className={heroMatch.status === "live" ? "event-tag is-live" : "event-tag is-upcoming"}>
              <span />
              {heroStatus}
            </span>
          ) : (
            <span className="home-kicker">Home</span>
          )}
          <h1>{heroMatch ? matchTitle(heroMatch) : "Busted Minds Sports"}</h1>
          <p>{heroMeta}</p>
          <div className="home-hero-actions">
            <button type="button" className="home-hero-button is-live" onClick={() => onOpenStatus("live")}>
              <LiveNavIcon size={16} aria-hidden="true" />
              <span>Live</span>
              <small>{slateStats.live}</small>
            </button>
            <button type="button" className="home-hero-button is-next" onClick={() => onOpenStatus("upcoming")}>
              <NextNavIcon size={16} aria-hidden="true" />
              <span>Next</span>
              <small>{slateStats.upcoming}</small>
            </button>
            {heroMatch ? (
              <button type="button" className="home-hero-link" onClick={() => onSelectMatch(heroMatch)}>
                <span>Open</span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        {heroMatch ? (
          <button
            type="button"
            className={`home-feature-card is-${heroAccent}`}
            onClick={() => onSelectMatch(heroMatch)}
            aria-label={`Open ${matchTitle(heroMatch)}`}
          >
            <span className="home-feature-label">Featured match</span>
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
                <small>{heroMatch.status === "live" ? "Live" : "Next"}</small>
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
              <span>{heroMatch.sources.length} feeds</span>
              <ChevronRight size={17} aria-hidden="true" />
            </span>
          </button>
        ) : null}
      </section>

      <section className="home-summary-strip" aria-label="Slate summary">
        <SummaryMetric icon={LiveNavIcon} label="Live now" value={slateStats.live.toLocaleString()} />
        <SummaryMetric icon={NextNavIcon} label="Up next" value={slateStats.upcoming.toLocaleString()} />
        <SummaryMetric icon={ShieldCheck} label="Feeds" value={slateStats.servers.toLocaleString()} />
        <SummaryMetric icon={Activity} label="Scores" value={scoreMatches.length.toLocaleString()} />
      </section>

      <section className="home-dashboard-grid" aria-label="Home slate">
        <section className="home-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">On air</span>
              <h2>Live Matches</h2>
            </div>
            <button type="button" className="home-panel-action" onClick={() => onOpenStatus("live")}>
              <LiveNavIcon size={15} aria-hidden="true" />
              <span>{slateStats.live}</span>
            </button>
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
            <button type="button" className="home-panel-action" onClick={() => onOpenStatus("upcoming")}>
              <NextNavIcon size={15} aria-hidden="true" />
              <span>{slateStats.upcoming}</span>
            </button>
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

      <section className="home-panel home-sports-panel">
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
          <button
            type="button"
            className="mini-button icon-only-button scores-refresh-button"
            onClick={onRefresh}
            aria-label="Refresh scores"
            title="Refresh scores"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
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
          onSelectScore={(score) => setSelectedScoreId(score.id)}
          onRefresh={onRefresh}
        />
        <ScoreInsightPanel
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
  const shownSummary = `${filteredScores.length.toLocaleString()} shown`;
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState("");
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
  const notice = error
    ? fromCache
      ? "Score refresh failed. Showing cached results."
      : error
    : updatedAt
      ? `Updated ${timeAgo(updatedAt)}`
      : "Connecting to scores";

  return (
    <section className="score-panel" aria-label="Scoreboard">
      <div className="panel-heading score-panel-heading">
        <div className="score-title-block">
          <span className="eyebrow">Results</span>
          <h2>Matches</h2>
          <p>{filterSummary}</p>
        </div>
        <div className="score-heading-actions">
          <span className={error ? "score-sync is-warning" : "score-sync"}>{notice}</span>
          <button
            type="button"
            className="mini-button icon-only-button"
            onClick={onRefresh}
            aria-label="Refresh scores"
            title="Refresh scores"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
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
          filteredScores.map((score) => (
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
    </section>
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
  score,
  insight,
  loading,
  error,
  fromCache,
  onRefresh,
}: {
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
      <section className="score-insight-panel" aria-label="Score details">
        <EmptyState icon={Activity} title="No match selected" detail="Choose a score to view match context" />
      </section>
    );
  }

  const detail = insight?.detail ?? null;
  const lineups = detail?.lineups ?? null;
  const standings = insight?.standings ?? null;
  const hasLeaders = Boolean(insight?.goalLeaders?.leaders.length || insight?.assistLeaders?.leaders.length);
  const hasTeams = Boolean(insight?.homeSchedule?.matches.length || insight?.awaySchedule?.matches.length);
  const statusText = loading
    ? fromCache
      ? "Updating context"
      : "Loading context"
    : error
      ? fromCache
        ? "Using cached context"
        : "Context unavailable"
      : insight?.updatedAt
        ? `Updated ${timeAgo(insight.updatedAt)}`
        : "Ready";

  return (
    <section className="score-insight-panel" aria-label="Score details">
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
          <span>{statusText}</span>
          <button
            type="button"
            className="mini-button icon-only-button"
            onClick={onRefresh}
            aria-label="Reload match context"
            title="Reload match context"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading || error || fromCache ? (
        <div className="score-context-status">
          <span>{statusText}</span>
          {error && !fromCache ? <strong>{error}</strong> : null}
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
              <span>
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
}: {
  badge?: string;
  name: string;
  sportIcon?: string;
  accent: string;
  size?: "small" | "regular" | "large";
}) {
  const imageSrc = badge || sportIcon || "";

  return (
    <span className={`team-mark is-${accent} is-${size}`}>
      {imageSrc ? (
        <img src={imageSrc} alt="" loading="lazy" decoding="async" draggable="false" />
      ) : (
        <span>{initials(name || "BM")}</span>
      )}
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
          <small>{sport.servers.toLocaleString()} feeds</small>
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
  const showTrailingMeta = !score || scoreLine.trim().toLowerCase() !== "vs";

  return (
    <button
      type="button"
      className={`match-card is-${match.status} is-${accent}${hasPoster ? " has-poster" : ""}${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      style={cardStyle}
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
            <small className="match-card-channel-label">{match.league}</small>
          )}
        </span>

        <span className="match-card-meta">
          <small>{match.sportLabel} · {score?.competition || match.league}</small>
          {showTrailingMeta ? <small>{score ? scoreLine : `${match.sources.length} feeds`}</small> : null}
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
  count,
  active,
  onClick,
}: {
  icon?: AppIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "header-nav-button is-active" : "header-nav-button"}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className="header-nav-button-label">
        {Icon ? <Icon size={15} className="bm-nav-icon" aria-hidden="true" /> : null}
        <span>{label}</span>
      </span>
      {typeof count === "number" ? <small>{count}</small> : null}
    </button>
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

  return (
    <button
      type="button"
      className={selected ? "schedule-row is-selected" : "schedule-row"}
      onClick={onSelect}
      aria-pressed={selected}
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
          {score ? `${sportScoreLine(score)} / ${score.statusText}` : `${match.league} / ${match.sources.length} feeds`}
        </small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
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
  const preferredSportMatches = matches.filter((match) => match.sportKey === preferredSportKey);

  return (
    preferredSportMatches.find(
      (match) => match.status === "live" && match.sources.some((source) => sourceRank(source) === 0),
    ) ??
    preferredSportMatches.find((match) => match.status === "live" && match.sources.length > 0) ??
    preferredSportMatches.find((match) => match.sources.length > 0) ??
    preferredSportMatches[0] ??
    matches.find(
      (match) => match.status === "live" && match.sources.some((source) => sourceRank(source) === 0),
    ) ??
    matches.find((match) => match.status === "live" && match.sources.length > 0) ??
    matches.find((match) => match.sources.length > 0) ??
    matches[0] ??
    null
  );
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
  if (visualKey === "cricket") return cricketIconUrl;
  return genericSportIconUrl;
}

function sportAccent(key: string) {
  return sportVisualKey(key);
}

function sportVisualKey(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes("football") || normalized.includes("soccer")) return "football";
  if (normalized.includes("cricket")) return "cricket";
  return "generic";
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

function sourceReliabilityLabel(source: StreamSource) {
  return sourceRank(source) >= 4 ? "Backup" : "Primary";
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
      if (match.sportKey === "cricket") stats.cricket += 1;
      return stats;
    },
    { total: 0, live: 0, upcoming: 0, football: 0, cricket: 0 },
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
