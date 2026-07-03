import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { Player } from "./components/Player";
import { useSportsCatalog } from "./hooks/useSportsCatalog";
import type { Match, StreamSource } from "./lib/catalog";

const parentLogoUrl = "/Busted-Minds-Logo.png";
const sportsLogoUrl = "/busted-minds-sports-logo.png";
const footballIconUrl = "/icons/sport-football.png";
const cricketIconUrl = "/icons/sport-cricket.png";
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
type PageMode = "home" | "slate";
type StatusFilter = "all" | "live" | "upcoming";
type NavigableStatus = Extract<StatusFilter, "live" | "upcoming">;
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
  const { matches, loading, refreshing, error, updatedAt, fromCache, refresh } = useSportsCatalog();
  const [selectedId, setSelectedId] = useState("");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageMode, setPageMode] = useState<PageMode>("home");

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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const pageGames = useMemo(() => {
    return games.filter((match) => {
      if (sportFilter !== "all" && match.sportKey !== sportFilter) return false;
      if (statusFilter !== "all" && match.status !== statusFilter) return false;
      return true;
    });
  }, [games, sportFilter, statusFilter]);
  const filteredGames = useMemo(() => {
    if (!normalizedSearch) return pageGames;
    return pageGames.filter((match) => matchSearchText(match).includes(normalizedSearch));
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
  const selectedSource = selectedMatch?.sources[sourceIndex] ?? selectedMatch?.sources[0] ?? null;
  const hasNextSource = (selectedMatch?.sources.length ?? 0) > 1;
  const isRefreshing = loading || refreshing;
  const searchActive = Boolean(normalizedSearch);
  const homePageActive = pageMode === "home";
  const livePageActive = pageMode === "slate" && sportFilter === "all" && statusFilter === "live";
  const nextPageActive = pageMode === "slate" && sportFilter === "all" && statusFilter === "upcoming";
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
  };

  const openHome = () => {
    setPageMode("home");
    setSearchTerm("");
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
    setSportFilter("all");
    setStatusFilter(nextStatus);
    setSelectedId(nextMatch?.id ?? "");
  };

  const openMatch = (match: Match) => {
    setSelectedId(match.id);
    setStatusFilter(match.status === "upcoming" ? "upcoming" : match.status === "live" ? "live" : "all");
    setPageMode("slate");
  };

  const openSport = (sportKey: string) => {
    const nextMatch = pickPreferredMatch(
      games.filter((match) => match.sportKey === sportKey),
      sportKey,
    );
    setSearchTerm("");
    setSportFilter(sportKey);
    setStatusFilter("all");
    setPageMode("slate");
    setSelectedId(nextMatch?.id ?? "");
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) setPageMode("slate");
  };
  const selectedHeaderAccent = selectedMatch ? sportAccent(selectedMatch.sportKey) : "generic";
  const selectedSportIcon = selectedMatch ? sportIconForKey(selectedMatch.sportKey) : "";

  return (
    <div className="app-shell">
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
              placeholder="Search games"
              aria-label="Search games"
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
              icon={NextNavIcon}
              label="Next"
              count={slateStats.upcoming}
              active={nextPageActive}
              onClick={() => openStatusPage("upcoming")}
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
            className="icon-button"
            onClick={() => void refresh(false)}
            title="Refresh games"
            aria-label="Refresh games"
          >
            {isRefreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </div>
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
              liveGames={liveGames}
              upcomingGames={upcomingGames}
              sportFocusItems={sportFocusItems}
              onOpenStatus={openStatusPage}
              onSelectMatch={openMatch}
              onSelectSport={openSport}
            />
          ) : (
            <>
          <section className="stage-grid">
            <div className="player-section">
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
                <div className="team-title">
                  {selectedMatch?.homeBadge ? (
                    <img src={selectedMatch.homeBadge} alt="" className="team-badge large" />
                  ) : selectedSportIcon ? (
                    <span className={`badge-fallback match-sport-mark is-${selectedHeaderAccent}`}>
                      <img src={selectedSportIcon} alt="" loading="lazy" decoding="async" draggable="false" />
                    </span>
                  ) : (
                    <span className="badge-fallback">
                      {initials(selectedMatch?.homeTeam ?? "BM")}
                    </span>
                  )}
                  <div className="match-title-copy">
                    <div className="match-title-kicker">
                      <p>{selectedMatch?.sportLabel ?? "Busted Minds Sports"}</p>
                      {selectedMatch ? (
                        <span className={selectedMatch.status === "live" ? "match-status-pill is-live" : "match-status-pill is-upcoming"}>
                          <span />
                          {selectedMatch.status === "live" ? "Live" : "Upcoming"}
                        </span>
                      ) : null}
                    </div>
                    <h1>{selectedMatch ? matchTitle(selectedMatch) : "No game selected"}</h1>
                  </div>
                </div>
                <div className="match-meta">
                  <span>
                    <Users size={15} aria-hidden="true" />
                    {selectedMatch ? selectedMatch.viewers.toLocaleString() : "0"}
                  </span>
                  <span>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {selectedMatch?.sources.length ?? 0} servers
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
                  <h2>Servers</h2>
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
                    <span className="quiet-text">No servers available</span>
                  )}
                </div>
              </div>
            </div>

            <aside className="games-panel" aria-label="Games">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Queue</span>
                  <h2>{queueTitle}</h2>
                </div>
                <span className="count-pill">{filteredGames.length}</span>
              </div>

              {searchActive ? (
                <div className="games-controls">
                  <div className="active-filter-line">
                    <span>{filteredGames.length} of {pageGames.length}</span>
                    <strong>Search in {pageScope}</strong>
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
                      selected={match.id === selectedId}
                      onSelect={() => setSelectedId(match.id)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={searchActive ? Search : error ? WifiOff : CalendarDays}
                    title={
                      searchActive
                        ? "No matching games"
                        : error && !fromCache
                          ? "Games unavailable"
                          : "No games right now"
                    }
                    detail={
                      searchActive
                        ? "Try a different search"
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
                  label="Playable servers"
                  value={slateStats.servers.toLocaleString()}
                  state={slateStats.servers ? "good" : "warn"}
                />
                <HealthItem
                  label="Primary servers"
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
          <small>{slateStats.live}</small>
        </button>
        <button
          type="button"
          className={nextPageActive ? "mobile-tabbar-button is-active" : "mobile-tabbar-button"}
          onClick={() => openStatusPage("upcoming")}
          aria-current={nextPageActive ? "page" : undefined}
        >
          <NextNavIcon size={18} aria-hidden="true" />
          <span>Next</span>
          <small>{slateStats.upcoming}</small>
        </button>
        <button
          type="button"
          className="mobile-tabbar-button"
          onClick={() => void refresh(false)}
          aria-label="Refresh games"
        >
          {isRefreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          <span>Refresh</span>
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
  liveGames: Match[];
  upcomingGames: Match[];
  sportFocusItems: HeaderSportSummary[];
  onOpenStatus: (status: NavigableStatus) => void;
  onSelectMatch: (match: Match) => void;
  onSelectSport: (sportKey: string) => void;
}) {
  const heroMatch = pickPreferredMatch(games, defaultSportKey);
  const heroStatus = heroMatch?.status === "upcoming" ? "Next" : "Live";
  const heroMeta = heroMatch
    ? [heroMatch.sportLabel, heroMatch.league, heroMatch.timeLabel || heroMatch.dateLabel]
        .filter(Boolean)
        .join(" - ")
    : "Busted Minds Sports";

  return (
    <section className="home-page" aria-label="Home">
      <section className="home-hero">
        <img className="home-hero-art" src={homeThumbnailUrl} alt="" />
        <span className="home-hero-shade" />
        <div className="home-hero-brandmarks" aria-hidden="true">
          <img className="home-hero-brandmark is-parent" src={parentLogoUrl} alt="" />
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
      </section>

      <section className="home-dashboard-grid" aria-label="Home slate">
        <section className="home-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">Live</span>
              <h2>Live Now</h2>
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
                <MatchCard key={match.id} match={match} selected={false} onSelect={() => onSelectMatch(match)} />
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
              <h2>Up Next</h2>
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
          <small>{sport.servers.toLocaleString()} servers</small>
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
  selected,
  onSelect,
}: {
  match: Match;
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

  return (
    <button
      type="button"
      className={`match-card is-${match.status} is-${accent}${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
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

        <span className="queue-teams">
          <span className="queue-team">
            {match.homeBadge ? (
              <img src={match.homeBadge} alt="" className="queue-team-badge" loading="lazy" />
            ) : useSportMark ? (
              <span className={`queue-badge-fallback queue-sport-mark is-${accent}`}>
                <img src={sportIcon} alt="" loading="lazy" decoding="async" draggable="false" />
              </span>
            ) : (
              <span className="queue-badge-fallback">{initials(match.homeTeam)}</span>
            )}
            <strong>{match.homeTeam}</strong>
          </span>
          {match.awayTeam ? (
            <>
              <small className="queue-vs">vs</small>
              <span className="queue-team">
                {match.awayBadge ? (
                  <img src={match.awayBadge} alt="" className="queue-team-badge" loading="lazy" />
                ) : (
                  <span className="queue-badge-fallback">{initials(match.awayTeam)}</span>
                )}
                <strong>{match.awayTeam}</strong>
              </span>
            </>
          ) : null}
        </span>

        <span className="match-card-meta">
          <small>{match.sportLabel} · {match.league}</small>
          <small>{match.sources.length} servers</small>
        </span>
      </span>
    </button>
  );
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
  selected,
  onSelect,
}: {
  match: Match;
  selected: boolean;
  onSelect: () => void;
}) {
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
      <span className="schedule-copy">
        <strong>{matchTitle(match)}</strong>
        <small>
          {match.league} · {match.sources.length} servers
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
  return "";
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
  return "Game Queue";
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
  return [
    match.name,
    match.homeTeam,
    match.awayTeam,
    match.league,
    match.sportLabel,
    match.category,
    match.status,
  ]
    .join(" ")
    .toLowerCase();
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
