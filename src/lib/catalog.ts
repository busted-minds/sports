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

const mediaParams = ["url", "src", "source", "stream", "file", "link", "u"];
const directMediaPattern = /\.(m3u8|mpd|mp4|webm|m4v|mov)(\?|$)/i;

export const defaultCatalogUrl =
  import.meta.env.VITE_SPORTS_CATALOG_URL || "https://sportsx-26.vercel.app/api/dami";

export async function fetchCatalog(endpoint = defaultCatalogUrl, signal?: AbortSignal) {
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
        .filter((source): source is StreamSource => Boolean(source));

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
  return value
    .replace(/[_/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
      if (value && directMediaPattern.test(value)) {
        return decodeURIComponent(value);
      }
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
