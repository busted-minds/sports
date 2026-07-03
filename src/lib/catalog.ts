export type MatchStatus = "live" | "upcoming" | "other";
export type SourceKind = "iframe" | "hls" | "video" | "dash" | "unknown";

export type StreamSource = {
  id: string;
  name: string;
  url: string;
  playbackUrl: string;
  kind: SourceKind;
};

export type Match = {
  id: string;
  apiId: string;
  name: string;
  status: MatchStatus;
  sportKey: string;
  sportLabel: string;
  category: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string;
  awayBadge: string;
  poster: string;
  startsAt: number | null;
  timeLabel: string;
  dateLabel: string;
  viewers: number;
  sources: StreamSource[];
};

type DamiTeam = {
  name?: unknown;
  badge?: unknown;
};

type DamiSource = {
  name?: unknown;
  embed?: unknown;
  iframe?: unknown;
  url?: unknown;
  src?: unknown;
  source?: unknown;
  file?: unknown;
  link?: unknown;
};

type DamiStream = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  category?: unknown;
  league?: unknown;
  starts_at?: unknown;
  poster?: unknown;
  viewers?: unknown;
  iframe?: unknown;
  embed?: unknown;
  sources?: unknown;
  teams?: {
    home?: DamiTeam;
    away?: DamiTeam;
  };
};

type DamiCategory = {
  category?: unknown;
  streams?: unknown;
};

type DamiCatalog = {
  streams?: unknown;
};

type DbServer = {
  id?: unknown;
  sport?: unknown;
  server_name?: unknown;
  server_url?: unknown;
  position?: unknown;
  match_id?: unknown;
};

type DbMatch = {
  id?: unknown;
  status?: unknown;
  sport?: unknown;
  team_a?: unknown;
  team_b?: unknown;
  league?: unknown;
  match_time?: unknown;
  match_date?: unknown;
  position?: unknown;
};

const mediaParams = ["url", "src", "source", "stream", "file", "link", "u"];
const directMediaPattern = /\.(m3u8|mpd|mp4|webm|m4v|mov)(\?|$)/i;
const fallbackServers: Record<string, Array<{ name: string; url: string }>> = {
  football: [
    { name: "Telemundo", url: "https://telemundo.vercel.app/" },
    { name: "Bein1 IOS", url: "https://footsterss.pages.dev/ios?id=bein1iOS" },
    { name: "cazetv", url: "https://footsterss.pages.dev?id=cazetvprime" },
  ],
  cricket: [
    { name: "Willow", url: "https://techy-kuldeep-cric-liart.vercel.app/WILLOWSPORTS.html" },
    { name: "Fancode", url: "https://gyanibrocricketchannel.github.io/fancode/" },
  ],
};
const supabaseUrl =
  import.meta.env.VITE_SPORTS_SUPABASE_URL || "https://ppozinjnhhfaerswjpuz.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SPORTS_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3ppbmpuaGhmYWVyc3dqcHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDI5MTQsImV4cCI6MjA5NzIxODkxNH0.ZQUJ1QlrJZLexjE9MQTv4-0F1mxOsfxwNZygYel3CWY";

export const defaultCatalogUrl =
  import.meta.env.VITE_SPORTS_CATALOG_URL || "https://sportsx-26.vercel.app/api/dami";

export async function fetchCatalog(endpoint = defaultCatalogUrl, signal?: AbortSignal): Promise<Match[]> {
  const [damiMatches, serverResult, dbMatchResult] = await Promise.all([
    fetchDamiCatalog(endpoint, signal),
    fetchServerCatalog(signal).catch(() => []),
    fetchDbMatches(signal).catch(() => []),
  ]);

  return mergeServerSources(damiMatches, serverResult, dbMatchResult);
}

async function fetchDamiCatalog(endpoint: string, signal?: AbortSignal): Promise<Match[]> {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Catalog request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DamiCatalog;
  return normalizeCatalog(payload);
}

async function fetchServerCatalog(signal?: AbortSignal): Promise<DbServer[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const response = await fetch(
    `${supabaseUrl}/rest/v1/servers?select=id,sport,server_name,server_url,position,match_id&order=position.asc`,
    {
      headers: {
        Accept: "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal,
    },
  );

  if (!response.ok) return [];
  const payload = (await response.json()) as DbServer[];
  return Array.isArray(payload) ? payload : [];
}

async function fetchDbMatches(signal?: AbortSignal): Promise<DbMatch[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const response = await fetch(
    `${supabaseUrl}/rest/v1/matches?select=id,status,sport,team_a,team_b,league,match_time,match_date,position&order=id.asc`,
    {
      headers: {
        Accept: "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal,
    },
  );

  if (!response.ok) return [];
  const payload = (await response.json()) as DbMatch[];
  return Array.isArray(payload) ? payload : [];
}

export function normalizeCatalog(payload: DamiCatalog): Match[] {
  const groups = Array.isArray(payload.streams) ? (payload.streams as DamiCategory[]) : [];
  const matches: Match[] = [];

  for (const group of groups) {
    const category = asText(group.category, "other");
    if (/24\s*[/-]?\s*7/i.test(category)) continue;

    const streams = Array.isArray(group.streams) ? (group.streams as DamiStream[]) : [];

    for (const stream of streams) {
      const name = asText(stream.name, "Untitled match");
      const rawStatus = asText(stream.status, "other").toLowerCase();
      const status: MatchStatus =
        rawStatus === "live" ? "live" : rawStatus === "upcoming" ? "upcoming" : "other";
      if (status === "other") continue;

      const apiId = asText(stream.id, stableHash(`${category}:${name}`));
      const startsAt = normalizeTimestamp(stream.starts_at);
      const teams = normalizeTeams(name, stream.teams);
      const sportKey = normalizeSportKey(category);
      const sourceInputs = normalizeSourceInputs(stream);
      const sources = sourceInputs
        .map((source, index) => normalizeSource(source, `${category}-${apiId}-${index}`, index))
        .filter((source): source is StreamSource => source !== null && isAvailableSource(source));

      matches.push({
        id: `${category}:${apiId}`,
        apiId,
        name,
        status,
        sportKey,
        sportLabel: toTitle(sportKey),
        category,
        league: asText(stream.league, toTitle(category)),
        homeTeam: teams.home,
        awayTeam: teams.away,
        homeBadge: teams.homeBadge,
        awayBadge: teams.awayBadge,
        poster: asText(stream.poster),
        startsAt,
        timeLabel: startsAt ? formatTime(startsAt) : "",
        dateLabel: startsAt ? formatDate(startsAt) : "",
        viewers: normalizeViewers(stream.viewers, `${apiId}:${name}`),
        sources,
      });
    }
  }

  return matches.sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) return a.startsAt - b.startsAt;
    if (a.startsAt && !b.startsAt) return -1;
    if (!a.startsAt && b.startsAt) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function detectSourceKind(rawUrl: string): Pick<StreamSource, "playbackUrl" | "kind"> {
  const playbackUrl = extractMediaUrl(rawUrl);
  const lowerUrl = playbackUrl.toLowerCase();

  if (/\.m3u8(\?|$)/i.test(lowerUrl)) return { playbackUrl, kind: "hls" };
  if (/\.mpd(\?|$)/i.test(lowerUrl)) return { playbackUrl, kind: "dash" };
  if (/\.(mp4|webm|m4v|mov)(\?|$)/i.test(lowerUrl)) return { playbackUrl, kind: "video" };
  if (rawUrl && rawUrl !== playbackUrl && directMediaPattern.test(playbackUrl)) {
    return detectSourceKind(playbackUrl);
  }
  if (rawUrl) return { playbackUrl: rawUrl, kind: "iframe" };
  return { playbackUrl: rawUrl, kind: "unknown" };
}

function mergeServerSources(
  matches: Match[],
  dbServers: DbServer[],
  dbMatches: DbMatch[],
): Match[] {
  const groupedServers = groupDbServers(dbServers);
  addFallbackServers(groupedServers.bySport);

  const channelMatches = Object.entries(groupedServers.bySport).flatMap(([sportKey, sources]) => {
    const match = createChannelMatch(sportKey, sources);
    return match ? [match] : [];
  });

  const normalizedDbMatches = dbMatches
    .map((match) => normalizeDbMatch(match, groupedServers))
    .filter((match): match is Match => Boolean(match));

  return sortMatches(
    dedupeMatches(filterAvailableMatches([...channelMatches, ...matches, ...normalizedDbMatches])),
  );
}

function groupDbServers(dbServers: DbServer[]) {
  const grouped: {
    bySport: Record<string, StreamSource[]>;
    byMatchId: Record<string, StreamSource[]>;
  } = {
    bySport: {},
    byMatchId: {},
  };

  const sortedServers = [...dbServers].sort((a, b) => {
    const positionA = Number(a.position);
    const positionB = Number(b.position);
    if (Number.isFinite(positionA) && Number.isFinite(positionB) && positionA !== positionB) {
      return positionA - positionB;
    }

    return Number(a.id) - Number(b.id);
  });

  for (const server of sortedServers) {
    const sportKey = normalizeSportKey(asText(server.sport));
    const url = asText(server.server_url);
    if (!url) continue;

    const detected = detectSourceKind(url);
    const source: StreamSource = {
      id: `db-${asText(server.id, stableHash(`${sportKey}:${url}`))}`,
      name: asText(server.server_name, "Server"),
      url,
      playbackUrl: detected.playbackUrl,
      kind: detected.kind,
    };
    if (!isAvailableSource(source)) continue;

    if (sportKey === "football" || sportKey === "cricket") {
      grouped.bySport[sportKey] = grouped.bySport[sportKey] ?? [];
      grouped.bySport[sportKey].push(source);
    }

    const matchId = asText(server.match_id);
    if (matchId) {
      grouped.byMatchId[matchId] = grouped.byMatchId[matchId] ?? [];
      grouped.byMatchId[matchId].push(source);
    }
  }

  return grouped;
}

function addFallbackServers(groupedBySport: Record<string, StreamSource[]>) {
  for (const [sportKey, servers] of Object.entries(fallbackServers)) {
    if (groupedBySport[sportKey]?.length) continue;

    groupedBySport[sportKey] = servers
      .map((server, index) => {
        const detected = detectSourceKind(server.url);
        return {
          id: `fallback-${sportKey}-${index}`,
          name: server.name,
          url: server.url,
          playbackUrl: detected.playbackUrl,
          kind: detected.kind,
        };
      })
      .filter(isAvailableSource);
  }
}

function normalizeDbMatch(
  row: DbMatch,
  groupedServers: ReturnType<typeof groupDbServers>,
): Match | null {
  const rawId = asText(row.id, stableHash(JSON.stringify(row)));
  const sportKey = normalizeSportKey(asText(row.sport, "other"));
  const statusValue = asText(row.status, "other").toLowerCase();
  const status: MatchStatus =
    statusValue === "live" ? "live" : statusValue === "upcoming" ? "upcoming" : "other";
  if (status === "other") return null;

  const homeTeam = asText(row.team_a, "Match");
  const awayTeam = asText(row.team_b);
  const sportSources =
    sportKey === "football" || sportKey === "cricket" ? groupedServers.bySport[sportKey] ?? [] : [];
  const matchSources = groupedServers.byMatchId[rawId] ?? [];
  const startsAt = parseDbSchedule(asText(row.match_date), asText(row.match_time));

  return {
    id: `db:${rawId}`,
    apiId: `db:${rawId}`,
    name: awayTeam ? `${homeTeam} vs ${awayTeam}` : homeTeam,
    status,
    sportKey,
    sportLabel: toTitle(sportKey),
    category: sportKey,
    league: asText(row.league, toTitle(sportKey)),
    homeTeam,
    awayTeam,
    homeBadge: "",
    awayBadge: "",
    poster: "",
    startsAt,
    timeLabel: asText(row.match_time, startsAt ? formatTime(startsAt) : ""),
    dateLabel: asText(row.match_date, startsAt ? formatDate(startsAt) : ""),
    viewers: normalizeViewers(undefined, `db:${rawId}:${homeTeam}`),
    sources: mergeSources(matchSources, sportSources),
  };
}

function createChannelMatch(sportKey: string, sources: StreamSource[]): Match | null {
  if (!sources.length) return null;

  const sportLabel = toTitle(sportKey);
  return {
    id: `channel:${sportKey}`,
    apiId: `channel:${sportKey}`,
    name: `${sportLabel} Live Channel`,
    status: "live",
    sportKey,
    sportLabel,
    category: sportKey,
    league: "Live TV Channels",
    homeTeam: `${sportLabel} Live`,
    awayTeam: "",
    homeBadge: "",
    awayBadge: "",
    poster: "",
    startsAt: null,
    timeLabel: "Now",
    dateLabel: "",
    viewers: normalizeViewers(undefined, `channel:${sportKey}`),
    sources,
  } satisfies Match;
}

function mergeSources(primarySources: StreamSource[], secondarySources: StreamSource[]) {
  const seen = new Set<string>();
  const merged: StreamSource[] = [];

  for (const source of [...primarySources, ...secondarySources]) {
    const key = source.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(source);
  }

  return merged;
}

function dedupeMatches(matches: Match[]) {
  const seen = new Set<string>();
  const deduped: Match[] = [];

  for (const match of matches) {
    const identity = `${match.id}:${match.status}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(match);
  }

  return deduped;
}

function sortMatches(matches: Match[]) {
  return [...matches].sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) return a.startsAt - b.startsAt;
    if (a.startsAt && !b.startsAt) return -1;
    if (!a.startsAt && b.startsAt) return 1;
    return a.name.localeCompare(b.name);
  });
}

function filterAvailableMatches(matches: Match[]) {
  return matches
    .map((match) => ({
      ...match,
      sources: match.sources.filter(isAvailableSource),
    }))
    .filter((match) => match.sources.length > 0);
}

function isAvailableSource(source: StreamSource) {
  if (!source.url || !source.playbackUrl || source.kind === "unknown") return false;
  try {
    const parsedUrl = new URL(source.url);
    const parsedPlaybackUrl = new URL(source.playbackUrl);
    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      (parsedPlaybackUrl.protocol === "http:" || parsedPlaybackUrl.protocol === "https:")
    );
  } catch {
    return false;
  }
}

function normalizeSourceInputs(stream: DamiStream): DamiSource[] {
  const sources = Array.isArray(stream.sources) ? (stream.sources as DamiSource[]) : [];
  const direct = firstText(stream.iframe, stream.embed);
  if (!direct) return sources;
  return [...sources, { name: "Primary", embed: direct }];
}

function normalizeSource(source: DamiSource, fallbackId: string, index: number): StreamSource | null {
  const url = firstText(
    source.embed,
    source.iframe,
    source.url,
    source.src,
    source.source,
    source.file,
    source.link,
  );
  if (!url) return null;

  const detected = detectSourceKind(url);

  return {
    id: fallbackId,
    name: asText(source.name, `Server ${index + 1}`),
    url,
    playbackUrl: detected.playbackUrl,
    kind: detected.kind,
  };
}

function normalizeTeams(name: string, teams?: DamiStream["teams"]) {
  const home = asText(teams?.home?.name);
  const away = asText(teams?.away?.name);
  const homeBadge = asText(teams?.home?.badge);
  const awayBadge = asText(teams?.away?.badge);
  if (home || away) return { home: home || name, away, homeBadge, awayBadge };

  const parts = name.split(/\s+vs\.?\s+|\s+v\s+/i).map((part) => part.trim());
  if (parts.length >= 2) {
    return {
      home: parts[0],
      away: parts.slice(1).join(" vs "),
      homeBadge,
      awayBadge,
    };
  }

  return { home: name, away: "", homeBadge, awayBadge };
}

function normalizeSportKey(category: string) {
  const value = category.toLowerCase().trim();
  if (value.includes("soccer")) return "football";
  if (value === "afl") return "afl";
  const normalized = value
    .replace(/[_/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "other";
}

function normalizeTimestamp(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
}

function normalizeViewers(value: unknown, seed: string) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numericValue) && numericValue >= 0) return Math.round(numericValue);
  return 180 + (Math.abs(hashNumber(seed)) % 9000);
}

function extractMediaUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    for (const param of mediaParams) {
      const value = parsed.searchParams.get(param);
      if (!value) continue;

      const decodedValue = safeDecode(value);
      if (directMediaPattern.test(decodedValue)) return decodedValue;
      if (directMediaPattern.test(value)) return value;
    }
  } catch {
    return rawUrl;
  }

  return rawUrl;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
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

function parseDbSchedule(dateLabel: string, timeLabel: string) {
  const date = dateLabel.trim();
  const time = timeLabel.trim();
  if (!date && !time) return null;

  const normalizedDate = date.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const datePart = normalizedDate || new Date().toISOString().slice(0, 10);
  const hasYear = /\b(20\d{2})\b/.test(datePart);
  const withYear = hasYear ? datePart : `${datePart} ${new Date().getFullYear()}`.trim();
  const timestamp = Date.parse(`${withYear} ${time}`.trim());
  if (Number.isFinite(timestamp)) return timestamp;

  const dateOnlyTimestamp = Date.parse(withYear);
  return Number.isFinite(dateOnlyTimestamp) ? dateOnlyTimestamp : null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toTitle(value: string) {
  if (!value) return "Other";
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
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
