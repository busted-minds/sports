import type { Match } from "./catalog";

export type SportScoreSport = "football" | "basketball" | "cricket" | "tennis";
export type SportScoreStatus = "live" | "upcoming" | "finished" | "other";
export type SportScoreValue = string | number | null;
export type LeaderStat = "goals" | "assists";

export type SportScoreMatch = {
  id: string;
  slug: string;
  sport: SportScoreSport;
  sportLabel: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: SportScoreValue;
  awayScore: SportScoreValue;
  status: SportScoreStatus;
  statusText: string;
  competition: string;
  competitionSlug: string;
  competitionLogo: string;
  startsAt: number | null;
  timeLabel: string;
  dateLabel: string;
  url: string;
};

export type SportScoreSlate = {
  matches: SportScoreMatch[];
  updatedAt: number;
};

export type SportScoreIncident = {
  minute: string;
  type: string;
  side: "home" | "away" | "neutral";
  player: string;
  detail: string;
  category: "goal" | "card" | "sub" | "other";
  homeScore: SportScoreValue;
  awayScore: SportScoreValue;
};

export type SportScoreStat = {
  label: string;
  home: string;
  away: string;
};

export type SportScoreLineupPlayer = {
  name: string;
  number: string;
  position: string;
  captain: boolean;
  rating: string;
};

export type SportScoreLineups = {
  confirmed: boolean;
  homeFormation: string;
  awayFormation: string;
  homeCoach: string;
  awayCoach: string;
  homeXi: SportScoreLineupPlayer[];
  awayXi: SportScoreLineupPlayer[];
  homeSubs: SportScoreLineupPlayer[];
  awaySubs: SportScoreLineupPlayer[];
};

export type SportScoreTracker = {
  id: string;
  profile: string;
  sport: SportScoreSport;
  embedUrl: string;
};

export type SportScoreMatchDetail = {
  match: SportScoreMatch;
  incidents: SportScoreIncident[];
  stats: SportScoreStat[];
  lineups: SportScoreLineups | null;
  tracker: SportScoreTracker | null;
  updatedAt: number;
};

export type SportScoreStandingRow = {
  position: number | null;
  team: string;
  teamLogo: string;
  teamSlug: string;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
  points: number | null;
  note: string;
};

export type SportScoreStandingTable = {
  group: string;
  rows: SportScoreStandingRow[];
};

export type SportScoreStandings = {
  competition: string;
  competitionLogo: string;
  competitionSlug: string;
  tables: SportScoreStandingTable[];
};

export type SportScoreLeader = {
  rank: number | null;
  player: string;
  playerLogo: string;
  playerSlug: string;
  team: string;
  teamLogo: string;
  goals: number | null;
  assists: number | null;
  matches: number | null;
  minutes: number | null;
  rating: number | null;
};

export type SportScoreLeaders = {
  competition: string;
  competitionLogo: string;
  statType: LeaderStat;
  leaders: SportScoreLeader[];
};

export type SportScoreTeamSchedule = {
  team: {
    name: string;
    logo: string;
    slug: string;
  };
  matches: SportScoreMatch[];
  updatedAt: number;
};

export type SportScoreBracket = {
  title: string;
  rounds: unknown[];
  raw: unknown;
};

type JsonRecord = Record<string, unknown>;

type RawSportScoreMatch = JsonRecord & {
  home?: unknown;
  away?: unknown;
  home_logo?: unknown;
  away_logo?: unknown;
  home_score?: unknown;
  away_score?: unknown;
  status?: unknown;
  status_text?: unknown;
  time?: unknown;
  competition?: unknown;
  competition_logo?: unknown;
  url?: unknown;
  slug?: unknown;
};

type RawSportScoreResponse = {
  matches?: unknown;
  updated?: unknown;
};

export const sportScoreSports: SportScoreSport[] = ["football", "basketball", "cricket", "tennis"];

const sportScoreBaseUrl = "https://sportscore.com";
const defaultSourceName = import.meta.env.VITE_SPORTSCORE_SRC || "busted-minds-sports";
const competitionPageFeeds: Array<{
  sport: SportScoreSport;
  competition: string;
  slug: string;
  path: string;
}> = [
  {
    sport: "football",
    competition: "FIFA World Cup",
    slug: "fifa-world-cup",
    path: "/football/competition/world/fifa-world-cup/kp3glrw7hwqdyjv/",
  },
];

export async function fetchSportScoreSlate(
  signal?: AbortSignal,
  sports: SportScoreSport[] = sportScoreSports,
  limit = 50,
): Promise<SportScoreSlate> {
  const results = await Promise.allSettled([
    ...sports.map((sport) => fetchSportScoreMatches(sport, limit, signal)),
    ...competitionPageFeeds
      .filter((feed) => sports.includes(feed.sport))
      .map((feed) => fetchSportScoreCompetitionPage(feed, signal)),
  ]);
  const fulfilled = results
    .filter((result): result is PromiseFulfilledResult<SportScoreSlate> => result.status === "fulfilled")
    .map((result) => result.value);

  if (!fulfilled.length) {
    const rejection = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw rejection?.reason instanceof Error
      ? rejection.reason
      : new Error("Scores request failed");
  }

  return {
    matches: sortSportScoreMatches(dedupeScoreMatches(fulfilled.flatMap((result) => result.matches))),
    updatedAt: Math.max(...fulfilled.map((result) => result.updatedAt)),
  };
}

export async function fetchSportScoreMatchDetail(
  match: SportScoreMatch,
  signal?: AbortSignal,
): Promise<SportScoreMatchDetail> {
  const payload = await getJson(
    "/api/widget/match/",
    { sport: match.sport, slug: match.slug },
    signal,
  );
  const record = asRecord(payload);
  const rawMatch = asRecord(record.match) as RawSportScoreMatch;
  const normalizedMatch = normalizeSportScoreMatch(match.sport, rawMatch) ?? match;
  const updatedAt = normalizeTimestamp(record.updated) ?? Date.now();

  return {
    match: { ...match, ...normalizedMatch },
    incidents: normalizeIncidents(asArray(rawMatch.incidents)),
    stats: normalizeStats(asArray(rawMatch.stats)),
    lineups: normalizeLineups(asRecord(rawMatch.lineups)),
    tracker: normalizeTracker(match.sport, asRecord(rawMatch.tracker)),
    updatedAt,
  };
}

export async function fetchSportScoreTeamSchedule(
  sport: SportScoreSport,
  slug: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<SportScoreTeamSchedule | null> {
  if (!slug) return null;
  const payload = await getOptionalJson(
    "/api/widget/team/",
    { sport, slug, limit: String(limit) },
    signal,
  );
  if (!payload) return null;

  const record = asRecord(payload);
  const team = asRecord(record.team);
  const matches = asArray(record.matches)
    .map((rawMatch) => normalizeSportScoreMatch(sport, asRecord(rawMatch) as RawSportScoreMatch))
    .filter((match): match is SportScoreMatch => Boolean(match));

  return {
    team: {
      name: asText(team.name, toTitle(slug)),
      logo: asText(team.logo),
      slug: asText(team.slug, slug),
    },
    matches,
    updatedAt: normalizeTimestamp(record.updated) ?? Date.now(),
  };
}

export async function fetchSportScoreStandings(
  sport: SportScoreSport,
  slug: string,
  signal?: AbortSignal,
): Promise<SportScoreStandings | null> {
  if (!slug) return null;
  const payload = await getOptionalJson("/api/widget/standings/", { sport, slug }, signal);
  if (!payload) return null;

  const record = asRecord(payload);
  const competition = asText(record.competition, toTitle(slug));
  return {
    competition,
    competitionLogo: asText(record.competition_logo),
    competitionSlug: asText(record.competition_slug, slug),
    tables: asArray(record.tables)
      .map((table) => {
        const tableRecord = asRecord(table);
        return {
          group: asText(tableRecord.group, competition),
          rows: asArray(tableRecord.rows).map(normalizeStandingRow),
        };
      })
      .filter((table) => table.rows.length > 0),
  };
}

export async function fetchSportScoreLeaders(
  sport: SportScoreSport,
  slug: string,
  stat: LeaderStat,
  signal?: AbortSignal,
  limit = 8,
): Promise<SportScoreLeaders | null> {
  if (!slug) return null;
  const payload = await getOptionalJson(
    "/api/widget/topscorers/",
    { sport, slug, stat, limit: String(limit) },
    signal,
  );
  if (!payload) return null;

  const record = asRecord(payload);
  return {
    competition: asText(record.competition, toTitle(slug)),
    competitionLogo: asText(record.competition_logo),
    statType: stat,
    leaders: asArray(record.scorers).map(normalizeLeader).filter((leader) => leader.player),
  };
}

export async function fetchSportScoreBracket(
  sport: SportScoreSport,
  slug: string,
  signal?: AbortSignal,
): Promise<SportScoreBracket | null> {
  if (!slug) return null;
  const payload = await getOptionalJson("/api/widget/bracket/", { sport, slug }, signal);
  if (!payload) return null;

  const record = asRecord(payload);
  const rounds = firstArray(record.rounds, record.bracket, record.stages, record.matches);
  if (!rounds.length) return null;
  return {
    title: asText(record.competition, toTitle(slug)),
    rounds,
    raw: payload,
  };
}

async function fetchSportScoreMatches(
  sport: SportScoreSport,
  limit: number,
  signal?: AbortSignal,
): Promise<SportScoreSlate> {
  const payload = (await getJson(
    "/api/widget/matches/",
    { sport, limit: String(limit) },
    signal,
  )) as RawSportScoreResponse;
  const matches = Array.isArray(payload.matches) ? (payload.matches as RawSportScoreMatch[]) : [];
  const updatedAt = normalizeTimestamp(payload.updated) ?? Date.now();

  return {
    matches: matches
      .map((match) => normalizeSportScoreMatch(sport, match))
      .filter((match): match is SportScoreMatch => Boolean(match)),
    updatedAt,
  };
}

async function fetchSportScoreCompetitionPage(
  feed: (typeof competitionPageFeeds)[number],
  signal?: AbortSignal,
): Promise<SportScoreSlate> {
  const url = new URL(feed.path, sportScoreBaseUrl).toString();
  const response = await fetch(proxiedPageUrl(url), {
    headers: { Accept: "text/html" },
    signal,
  });
  if (!response.ok) throw new Error(`Competition page request failed with HTTP ${response.status}`);

  const html = await response.text();
  const events = extractSchemaSportsEvents(html);
  return {
    matches: events
      .map((event) => normalizeSchemaSportsEvent(feed, event))
      .filter((match): match is SportScoreMatch => Boolean(match)),
    updatedAt: Date.now(),
  };
}

async function getJson(pathname: string, params: Record<string, string>, signal?: AbortSignal) {
  const url = apiUrl(pathname, params);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`Scores request failed with HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function getOptionalJson(pathname: string, params: Record<string, string>, signal?: AbortSignal) {
  try {
    return await getJson(pathname, params, signal);
  } catch {
    return null;
  }
}

function apiUrl(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, sportScoreBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  url.searchParams.set("src", defaultSourceName);
  return url;
}

function proxiedPageUrl(url: string) {
  if (typeof window === "undefined") return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function normalizeSportScoreMatch(
  sport: SportScoreSport,
  match: RawSportScoreMatch,
): SportScoreMatch | null {
  const homeTeam = asText(match.home);
  const awayTeam = asText(match.away);
  if (!homeTeam && !awayTeam) return null;

  const startsAt = normalizeTimestamp(match.time);
  const relativeUrl = asText(match.url);
  const slug = asText(match.slug, slugFromUrl(relativeUrl) || stableHash(`${homeTeam}:${awayTeam}:${asText(match.time)}`));
  const competition = asText(match.competition, toTitle(sport));
  const absoluteUrl = relativeUrl
    ? new URL(relativeUrl, sportScoreBaseUrl).toString()
    : new URL(`/${sport}/match/${slug}/`, sportScoreBaseUrl).toString();

  return {
    id: `${sport}:${slug}`,
    slug,
    sport,
    sportLabel: toTitle(sport),
    homeTeam: homeTeam || "Home",
    awayTeam: awayTeam || "Away",
    homeTeamSlug: slugify(homeTeam),
    awayTeamSlug: slugify(awayTeam),
    homeLogo: asText(match.home_logo),
    awayLogo: asText(match.away_logo),
    homeScore: normalizeScore(match.home_score),
    awayScore: normalizeScore(match.away_score),
    status: normalizeStatus(match.status, match.status_text),
    statusText: asText(match.status_text, toTitle(asText(match.status, "Match"))),
    competition,
    competitionSlug: slugify(competition),
    competitionLogo: asText(match.competition_logo),
    startsAt,
    timeLabel: startsAt ? formatTime(startsAt) : "",
    dateLabel: startsAt ? formatDate(startsAt) : "",
    url: absoluteUrl,
  };
}

function extractSchemaSportsEvents(html: string) {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const events: JsonRecord[] = [];

  for (const script of scripts) {
    const source = decodeHtmlText(script[1]).trim();
    if (!source) continue;

    try {
      collectSchemaSportsEvents(JSON.parse(source), events);
    } catch {
      continue;
    }
  }

  return events;
}

function collectSchemaSportsEvents(value: unknown, events: JsonRecord[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaSportsEvents(item, events));
    return;
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) return;

  const type = schemaType(record["@type"]);
  if (type.includes("SportsEvent")) {
    events.push(record);
    return;
  }

  if (type.includes("ItemList")) {
    asArray(record.itemListElement).forEach((item) => {
      const listItem = asRecord(item);
      collectSchemaSportsEvents(listItem.item ?? item, events);
    });
  }

  collectSchemaSportsEvents(record["@graph"], events);
}

function normalizeSchemaSportsEvent(
  feed: (typeof competitionPageFeeds)[number],
  event: JsonRecord,
): SportScoreMatch | null {
  const homeTeam = asText(asRecord(event.homeTeam).name);
  const awayTeam = asText(asRecord(event.awayTeam).name);
  if (!homeTeam && !awayTeam) return null;

  const url = asText(event.url);
  const startsAt = normalizeTimestamp(event.startDate);
  const slug = slugFromUrl(url) || slugify(asText(event.name)) || stableHash(`${homeTeam}:${awayTeam}:${startsAt ?? ""}`);
  const images = asArray(event.image).map((image) => asText(image)).filter(Boolean);

  return {
    id: `${feed.sport}:${slug}`,
    slug,
    sport: feed.sport,
    sportLabel: toTitle(feed.sport),
    homeTeam: homeTeam || "Home",
    awayTeam: awayTeam || "Away",
    homeTeamSlug: slugFromSchemaId(asRecord(event.homeTeam)) || slugify(homeTeam),
    awayTeamSlug: slugFromSchemaId(asRecord(event.awayTeam)) || slugify(awayTeam),
    homeLogo: images[0] ?? "",
    awayLogo: images[1] ?? "",
    homeScore: null,
    awayScore: null,
    status: normalizeSchemaEventStatus(event.eventStatus, startsAt),
    statusText: normalizeSchemaEventStatus(event.eventStatus, startsAt) === "finished" ? "Finished" : "Scheduled",
    competition: feed.competition,
    competitionSlug: feed.slug,
    competitionLogo: "",
    startsAt,
    timeLabel: startsAt ? formatTime(startsAt) : "",
    dateLabel: startsAt ? formatDate(startsAt) : "",
    url: url ? new URL(url, sportScoreBaseUrl).toString() : new URL(`/${feed.sport}/match/${slug}/`, sportScoreBaseUrl).toString(),
  };
}

function normalizeIncidents(values: unknown[]): SportScoreIncident[] {
  return values
    .map((value) => {
      const record = asRecord(value);
      const type = asText(record.type, "Event");
      const player = asText(record.player);
      const playerIn = asText(record.player_in);
      const playerOut = asText(record.player_out);
      const isSub = Boolean(record.is_sub) || Boolean(playerIn || playerOut);
      const category: SportScoreIncident["category"] = Boolean(record.is_goal)
        ? "goal"
        : Boolean(record.is_card)
          ? "card"
          : isSub
            ? "sub"
            : "other";
      const detail = isSub
        ? [playerIn ? `In: ${playerIn}` : "", playerOut ? `Out: ${playerOut}` : ""]
            .filter(Boolean)
            .join(" / ")
        : player;

      return {
        minute: minuteLabel(record.time),
        type,
        side: normalizeSide(record.side),
        player,
        detail,
        category,
        homeScore: normalizeScore(record.home_score),
        awayScore: normalizeScore(record.away_score),
      };
    })
    .filter((incident) => incident.type || incident.detail);
}

function normalizeStats(values: unknown[]): SportScoreStat[] {
  return values
    .map((value) => {
      const record = asRecord(value);
      const label = firstText(record.label, record.name, record.type, record.stat);
      const home = firstText(record.home, record.home_value, record.home_stat, record.home_team);
      const away = firstText(record.away, record.away_value, record.away_stat, record.away_team);
      return { label, home, away };
    })
    .filter((stat) => stat.label && (stat.home || stat.away));
}

function normalizeLineups(record: JsonRecord): SportScoreLineups | null {
  const homeXi = asArray(record.home_xi).map(normalizeLineupPlayer).filter((player) => player.name);
  const awayXi = asArray(record.away_xi).map(normalizeLineupPlayer).filter((player) => player.name);
  const homeSubs = asArray(record.home_subs).map(normalizeLineupPlayer).filter((player) => player.name);
  const awaySubs = asArray(record.away_subs).map(normalizeLineupPlayer).filter((player) => player.name);
  if (!homeXi.length && !awayXi.length && !homeSubs.length && !awaySubs.length) return null;

  return {
    confirmed: Boolean(record.confirmed),
    homeFormation: asText(record.home_formation),
    awayFormation: asText(record.away_formation),
    homeCoach: asText(record.home_coach),
    awayCoach: asText(record.away_coach),
    homeXi,
    awayXi,
    homeSubs,
    awaySubs,
  };
}

function normalizeLineupPlayer(value: unknown): SportScoreLineupPlayer {
  const record = asRecord(value);
  return {
    name: asText(record.name),
    number: asText(record.number),
    position: asText(record.position),
    captain: Boolean(record.captain),
    rating: asText(record.rating),
  };
}

function normalizeTracker(sport: SportScoreSport, record: JsonRecord): SportScoreTracker | null {
  const id = asText(record.id);
  if (!id) return null;
  const embedUrl = apiUrl("/api/widget/tracker/", { sport, id }).toString();
  return {
    id,
    profile: asText(record.profile),
    sport,
    embedUrl,
  };
}

function normalizeStandingRow(value: unknown): SportScoreStandingRow {
  const record = asRecord(value);
  return {
    position: asNumber(record.pos),
    team: asText(record.team),
    teamLogo: asText(record.team_logo),
    teamSlug: asText(record.team_slug, slugify(asText(record.team))),
    played: asNumber(record.p),
    won: asNumber(record.w),
    drawn: asNumber(record.d),
    lost: asNumber(record.l),
    goalsFor: asNumber(record.gf),
    goalsAgainst: asNumber(record.ga),
    goalDifference: asNumber(record.gd),
    points: asNumber(record.pts),
    note: asText(record.promo_name),
  };
}

function normalizeLeader(value: unknown): SportScoreLeader {
  const record = asRecord(value);
  return {
    rank: asNumber(record.rank),
    player: asText(record.player),
    playerLogo: asText(record.player_logo),
    playerSlug: asText(record.player_slug, slugify(asText(record.player))),
    team: asText(record.team),
    teamLogo: asText(record.team_logo),
    goals: asNumber(record.goals),
    assists: asNumber(record.assists),
    matches: asNumber(record.matches),
    minutes: asNumber(record.minutes),
    rating: asNumber(record.rating),
  };
}

export function findSportScoreForMatch(
  match: Match | null,
  scoreMatches: SportScoreMatch[],
): SportScoreMatch | null {
  if (!match?.awayTeam) return null;

  const sport = normalizeSportForScore(match.sportKey);
  if (!sport) return null;

  const candidates = scoreMatches.filter((scoreMatch) => scoreMatch.sport === sport);
  const directMatch = candidates.find(
    (scoreMatch) =>
      teamNamesMatch(match.homeTeam, scoreMatch.homeTeam) &&
      teamNamesMatch(match.awayTeam, scoreMatch.awayTeam),
  );
  if (directMatch) return directMatch;

  return (
    candidates.find(
      (scoreMatch) =>
        teamNamesMatch(match.homeTeam, scoreMatch.awayTeam) &&
        teamNamesMatch(match.awayTeam, scoreMatch.homeTeam),
    ) ?? null
  );
}

export function sportScoreLine(match: SportScoreMatch) {
  const homeScore = scoreValueText(match.homeScore);
  const awayScore = scoreValueText(match.awayScore);
  if (!homeScore && !awayScore) return "vs";
  return `${homeScore || "-"} - ${awayScore || "-"}`;
}

export function isMainSportScoreMatch(match: SportScoreMatch) {
  return scoreMatchPriority(match) <= 45;
}

export function scoreMatchPriority(match: SportScoreMatch) {
  const haystack = `${match.competition} ${match.homeTeam} ${match.awayTeam}`.toLowerCase();

  const priority = mainCompetitionPriority.find((entry) => entry.pattern.test(haystack));
  if (priority) return priority.weight;

  if (match.status === "live") return 62;
  if (match.status === "upcoming") return 72;
  return 88;
}

export function scoreValueText(value: SportScoreValue) {
  if (value === null || typeof value === "undefined") return "";
  return String(value).trim();
}

function dedupeScoreMatches(matches: SportScoreMatch[]) {
  const seen = new Set<string>();
  const deduped: SportScoreMatch[] = [];
  for (const match of matches) {
    const key = match.id || `${match.sport}:${match.homeTeam}:${match.awayTeam}:${match.startsAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(match);
  }
  return deduped;
}

function normalizeStatus(statusValue: unknown, statusTextValue: unknown): SportScoreStatus {
  const rawStatus = `${asText(statusValue)} ${asText(statusTextValue)}`.toLowerCase();
  if (/live|in[\s-]?play|1st|2nd|3rd|4th|half|quarter|inning/.test(rawStatus)) return "live";
  if (/upcoming|scheduled|not started|fixture|pre/.test(rawStatus)) return "upcoming";
  if (/finished|ended|final|full time|ft|complete/.test(rawStatus)) return "finished";
  return "other";
}

function normalizeSportForScore(value: string): SportScoreSport | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("football") || normalized.includes("soccer")) return "football";
  if (normalized.includes("basketball")) return "basketball";
  if (normalized.includes("cricket")) return "cricket";
  if (normalized.includes("tennis")) return "tennis";
  return null;
}

function sortSportScoreMatches(matches: SportScoreMatch[]) {
  return [...matches].sort((a, b) => {
    const statusDifference = statusWeight(a.status) - statusWeight(b.status);
    if (statusDifference) return statusDifference;
    const priorityDifference = scoreMatchPriority(a) - scoreMatchPriority(b);
    if (priorityDifference) return priorityDifference;
    const aTime = a.startsAt ?? 0;
    const bTime = b.startsAt ?? 0;
    if (a.status === "finished") return bTime - aTime;
    return aTime - bTime;
  });
}

const mainCompetitionPriority: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\bfifa world cup\b|\bworld cup\b|\buefa euro\b|\bcopa america\b|\bafrica cup\b|\bafc asian cup\b/, weight: 1 },
  { pattern: /\buefa champions league\b|\beuropa league\b|\bconference league\b|\bcopa libertadores\b|\bcopa sudamericana\b/, weight: 6 },
  { pattern: /\benglish premier league\b|\bpremier league\b|\bla liga\b|\bserie a\b|\bbundesliga\b|\bligue 1\b|\beredivisie\b|\bprimeira liga\b/, weight: 10 },
  { pattern: /\bmls\b|\bmajor league soccer\b|\bsaudi pro league\b|\bconcacaf\b|\bliga mx\b|\bbrazilian serie a\b|\bargentine\b/, weight: 18 },
  { pattern: /\bnba\b|\bwnba\b|\beuroleague\b|\bfiba\b|\bncaa\b|\bbasketball world cup\b/, weight: 8 },
  { pattern: /\bicc\b|\bipl\b|\bindian premier league\b|\bashes\b|\bt20 world cup\b|\bodi world cup\b|\bmajor league cricket\b|\bbig bash\b|\bthe hundred\b/, weight: 8 },
  { pattern: /\bwimbledon\b|\bus open\b|\baustralian open\b|\bfrench open\b|\broland garros\b|\batp\b|\bwta\b|\bdavis cup\b|\bbillie jean king cup\b/, weight: 8 },
  { pattern: /\binternational\b|\bfriendly international\b|\bnations league\b|\bolympic\b/, weight: 28 },
  { pattern: /\bcup\b|\bplayoff\b|\bplay-off\b|\bfinal\b|\bsemi[-\s]?final\b|\bquarter[-\s]?final\b/, weight: 38 },
];

function statusWeight(status: SportScoreStatus) {
  if (status === "live") return 0;
  if (status === "upcoming") return 1;
  if (status === "finished") return 2;
  return 3;
}

function teamNamesMatch(left: string, right: string) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = normalizedLeft.split(" ").filter((token) => token.length > 2);
  const rightTokens = normalizedRight.split(" ").filter((token) => token.length > 2);
  if (!leftTokens.length || !rightTokens.length) return false;

  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return overlap / Math.min(leftTokens.length, rightTokens.length) >= 0.67;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(fc|sc|cf|afc|bc|bk|bkb|women|w|men|u\d+|team)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeScore(value: unknown): SportScoreValue {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const textValue = asText(value);
  if (!textValue) return null;
  const timestamp = Date.parse(textValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeSchemaEventStatus(value: unknown, startsAt: number | null): SportScoreStatus {
  const text = asText(value).toLowerCase();
  if (text.includes("eventcancelled") || text.includes("cancelled")) return "other";
  if (text.includes("eventpostponed") || text.includes("postponed")) return "other";
  if (text.includes("eventcompleted") || text.includes("finished")) return "finished";
  if (text.includes("eventinprogress") || text.includes("live")) return "live";
  if (text.includes("eventscheduled") || text.includes("scheduled")) return "upcoming";
  if (startsAt && startsAt > Date.now()) return "upcoming";
  return "other";
}

function normalizeSide(value: unknown): "home" | "away" | "neutral" {
  const text = asText(value).toLowerCase();
  if (text === "home") return "home";
  if (text === "away") return "away";
  return "neutral";
}

function minuteLabel(value: unknown) {
  const text = asText(value);
  if (!text) return "";
  return text.endsWith("'") ? text : `${text}'`;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    const array = asArray(value);
    if (array.length) return array;
  }
  return [];
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function asNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function schemaType(value: unknown) {
  return Array.isArray(value) ? value.map((item) => asText(item)).filter(Boolean) : [asText(value)].filter(Boolean);
}

function slugFromUrl(value: string) {
  if (!value) return "";
  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function slugFromSchemaId(record: JsonRecord) {
  const id = asText(record["@id"]) || asText(record.url);
  if (!id) return "";
  const parts = id.split("/").filter(Boolean);
  const teamIndex = parts.findIndex((part) => part === "team");
  return teamIndex >= 0 ? parts[teamIndex + 1] ?? "" : slugFromUrl(id);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function toTitle(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

function decodeHtmlText(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

function stableHash(input: string) {
  return Math.abs(hashNumber(input)).toString(36);
}

function hashNumber(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
