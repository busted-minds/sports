import {
  Activity,
  CalendarDays,
  CircleDot,
  Clock3,
  Flame,
  Grid3X3,
  ListFilter,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trophy,
  Users,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logoUrl from "../Busted-Minds-Logo.png";
import { Player } from "./components/Player";
import { useSportsCatalog } from "./hooks/useSportsCatalog";
import type { Match } from "./lib/catalog";

type SportFilter = {
  key: string;
  label: string;
  icon: LucideIcon;
};

const primarySports = ["football", "cricket", "basketball", "baseball"];

export default function App() {
  const { matches, loading, error, updatedAt, fromCache, refresh } = useSportsCatalog();
  const [selectedId, setSelectedId] = useState("");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [activeSport, setActiveSport] = useState("all");
  const [query, setQuery] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  const liveMatches = useMemo(() => matches.filter((match) => match.status === "live"), [matches]);
  const upcomingMatches = useMemo(
    () => matches.filter((match) => match.status === "upcoming").slice(0, 18),
    [matches],
  );
  const sportKeys = useMemo(
    () => Array.from(new Set(matches.map((match) => match.sportKey))).sort(),
    [matches],
  );

  const sportFilters = useMemo<SportFilter[]>(() => {
    const filters: SportFilter[] = [{ key: "all", label: "All", icon: Grid3X3 }];
    for (const key of primarySports) {
      if (sportKeys.includes(key)) {
        filters.push({ key, label: labelForSport(key), icon: iconForSport(key) });
      }
    }

    const hasMore = sportKeys.some((key) => !primarySports.includes(key));
    if (hasMore) filters.push({ key: "more", label: "More", icon: ListFilter });
    return filters;
  }, [sportKeys]);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedId) ?? null,
    [matches, selectedId],
  );
  const selectedSource = selectedMatch?.sources[sourceIndex] ?? selectedMatch?.sources[0] ?? null;
  const hasNextSource = (selectedMatch?.sources.length ?? 0) > 1;

  const filteredLiveMatches = useMemo(
    () =>
      liveMatches
        .filter((match) => matchesActiveSport(match, activeSport))
        .filter((match) => matchesSearch(match, query)),
    [activeSport, liveMatches, query],
  );

  const filteredUpcomingMatches = useMemo(
    () =>
      upcomingMatches
        .filter((match) => matchesActiveSport(match, activeSport))
        .filter((match) => matchesSearch(match, query)),
    [activeSport, query, upcomingMatches],
  );

  const totalSources = useMemo(
    () => matches.reduce((count, match) => count + match.sources.length, 0),
    [matches],
  );

  useEffect(() => {
    if (!matches.length) return;
    if (selectedId && matches.some((match) => match.id === selectedId)) return;

    const firstLiveWithSource = matches.find(
      (match) => match.status === "live" && match.sources.length > 0,
    );
    const firstWithSource = matches.find((match) => match.sources.length > 0);
    setSelectedId((firstLiveWithSource ?? firstWithSource ?? matches[0]).id);
  }, [matches, selectedId]);

  useEffect(() => {
    setSourceIndex(0);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedMatch) return;
    if (sourceIndex >= selectedMatch.sources.length) setSourceIndex(0);
  }, [selectedMatch, sourceIndex]);

  const isEmpty = !loading && matches.length === 0;
  const useNextSource = () => {
    if (!selectedMatch?.sources.length) return;
    setSourceIndex((currentIndex) => (currentIndex + 1) % selectedMatch.sources.length);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Busted Minds Sports">
          <img src={logoUrl} alt="Busted Minds" />
          <span>
            <strong>Sports</strong>
            <small>Busted Minds</small>
          </span>
        </a>

        <nav className="topnav" aria-label="Sports filters">
          {sportFilters.map((filter) => {
            const Icon = filter.icon;
            const active = activeSport === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                className={active ? "nav-pill is-active" : "nav-pill"}
                aria-pressed={active}
                onClick={() => setActiveSport(filter.key)}
              >
                <Icon size={16} aria-hidden="true" />
                {filter.label}
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams, leagues, sports"
            />
          </label>
          <button
            type="button"
            className="icon-button"
            onClick={() => void refresh(false)}
            title="Refresh catalog"
            aria-label="Refresh catalog"
          >
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </div>
      </header>

      <main className="app-main">
        <aside className="side-rail" aria-label="Live sports">
          <div className="rail-status">
            <span className={error ? "pulse-dot is-warn" : "pulse-dot"} />
            <span>{error ? (fromCache ? "Cached" : "Offline") : "Live Catalog"}</span>
          </div>
          <div className="rail-stack">
            {sportFilters.map((filter) => {
              const Icon = filter.icon;
              const active = activeSport === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  className={active ? "rail-button is-active" : "rail-button"}
                  onClick={() => setActiveSport(filter.key)}
                  title={filter.label}
                  aria-label={filter.label}
                >
                  <Icon size={20} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="content-area">
          <section className="score-strip" aria-label="Catalog overview">
            <MetricTile icon={Flame} label="Live" value={liveMatches.length.toString()} />
            <MetricTile icon={Trophy} label="Sports" value={sportKeys.length.toString()} />
            <MetricTile icon={Server} label="Sources" value={totalSources.toString()} />
            <MetricTile
              icon={CalendarDays}
              label="Next"
              value={upcomingMatches.length.toString()}
            />
          </section>

          <section className="stage-grid">
            <div className="player-section">
              <div className="player-shell">
                <div className="player-topline">
                  <span className={selectedMatch?.status === "live" ? "live-chip" : "soft-chip"}>
                    {selectedMatch?.status === "live" ? <Radio size={14} /> : <Clock3 size={14} />}
                    {selectedMatch?.status === "live" ? "Live" : "Upcoming"}
                  </span>
                  <div className="topline-actions">
                    <span className="source-kind">
                      {selectedSource ? sourceHost(selectedSource.url) || selectedSource.kind : "none"}
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

              <div className="match-header">
                <div className="team-title">
                  {selectedMatch?.homeBadge ? (
                    <img src={selectedMatch.homeBadge} alt="" className="team-badge large" />
                  ) : (
                    <span className="badge-fallback">
                      {initials(selectedMatch?.homeTeam ?? "BM")}
                    </span>
                  )}
                  <div>
                    <p>{selectedMatch?.sportLabel ?? "Busted Minds Sports"}</p>
                    <h1>{selectedMatch ? matchTitle(selectedMatch) : "Live catalog"}</h1>
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
                        title={`${source.name} - ${sourceHost(source.url) || source.kind}`}
                      >
                        <span>{source.name}</span>
                        <small>{sourceHost(source.url) || source.kind}</small>
                      </button>
                    ))
                  ) : (
                    <span className="quiet-text">No servers available</span>
                  )}
                </div>
              </div>
            </div>

            <aside className="live-panel" aria-label="Live matches">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Now</span>
                  <h2>Live Matches</h2>
                </div>
                <span className="count-pill">{filteredLiveMatches.length}</span>
              </div>

              <div className="match-list">
                {loading && matches.length === 0 ? (
                  <LoadingRows />
                ) : filteredLiveMatches.length ? (
                  filteredLiveMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      selected={match.id === selectedId}
                      onSelect={() => setSelectedId(match.id)}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={isEmpty || error ? WifiOff : CircleDot}
                    title={isEmpty ? "Catalog empty" : "No live matches"}
                    detail={error && !fromCache ? error : "Try a different sport filter"}
                  />
                )}
              </div>
            </aside>
          </section>

          <section className="lower-grid">
            <div className="schedule-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Schedule</span>
                  <h2>Next Up</h2>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowSchedule((value) => !value)}
                >
                  {showSchedule ? "Less" : "More"}
                </button>
              </div>
              <div className="schedule-list">
                {(showSchedule ? filteredUpcomingMatches : filteredUpcomingMatches.slice(0, 6)).map(
                  (match) => (
                    <button
                      type="button"
                      key={match.id}
                      className="schedule-row"
                      onClick={() => setSelectedId(match.id)}
                    >
                      <span className="date-box">
                        <strong>{match.dateLabel || "TBA"}</strong>
                        <small>{match.timeLabel || match.sportLabel}</small>
                      </span>
                      <span className="schedule-copy">
                        <strong>{matchTitle(match)}</strong>
                        <small>{match.league}</small>
                      </span>
                      <Play size={16} aria-hidden="true" />
                    </button>
                  ),
                )}
                {!filteredUpcomingMatches.length ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No upcoming matches"
                    detail="Live catalog will refresh automatically"
                  />
                ) : null}
              </div>
            </div>

            <div className="insight-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Signal</span>
                  <h2>Stream Health</h2>
                </div>
                <Activity size={19} aria-hidden="true" />
              </div>
              <div className="health-grid">
                <HealthItem
                  label="Catalog"
                  value={error ? "Degraded" : "Online"}
                  tone={error ? "warn" : "good"}
                />
                <HealthItem
                  label="Cache"
                  value={fromCache ? "Active" : "Fresh"}
                  tone={fromCache ? "warn" : "good"}
                />
                <HealthItem
                  label="Updated"
                  value={updatedAt ? timeAgo(updatedAt) : "Pending"}
                  tone="neutral"
                />
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="metric-tile">
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  return (
    <button
      type="button"
      className={selected ? "match-card is-selected" : "match-card"}
      onClick={onSelect}
    >
      {match.poster ? <img src={match.poster} alt="" className="match-poster" loading="lazy" /> : null}
      <span className="match-shade" />
      <span className="match-card-content">
        <span className="match-card-top">
          <span className="live-tag">
            <span />
            LIVE
          </span>
          <small>{match.timeLabel || match.sportLabel}</small>
        </span>
        <span className="teams">
          <TeamLine badge={match.homeBadge} name={match.homeTeam} />
          {match.awayTeam ? <small>vs</small> : null}
          {match.awayTeam ? <TeamLine badge={match.awayBadge} name={match.awayTeam} /> : null}
        </span>
        <span className="match-foot">
          <small>{match.league}</small>
          <small>{match.sources.length} servers</small>
        </span>
      </span>
    </button>
  );
}

function TeamLine({ badge, name }: { badge: string; name: string }) {
  return (
    <span className="team-line">
      {badge ? <img src={badge} alt="" className="team-badge" loading="lazy" /> : null}
      <strong>{name}</strong>
    </span>
  );
}

function HealthItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`health-item is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
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
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </>
  );
}

function matchesSearch(match: Match, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    match.name,
    match.homeTeam,
    match.awayTeam,
    match.league,
    match.category,
    match.sportLabel,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function matchesActiveSport(match: Match, activeSport: string) {
  if (activeSport === "all") return true;
  if (activeSport === "more") return !primarySports.includes(match.sportKey);
  return match.sportKey === activeSport;
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

function labelForSport(key: string) {
  if (key === "afl") return "AFL";
  return key
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function iconForSport(key: string): LucideIcon {
  if (key === "football") return Trophy;
  if (key === "cricket") return ShieldCheck;
  if (key === "basketball") return CircleDot;
  if (key === "baseball") return Activity;
  return Grid3X3;
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
