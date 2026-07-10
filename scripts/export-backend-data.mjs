import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportDirectory = path.join(projectRoot, "data", "backend-export");

await loadLocalEnv(path.join(projectRoot, ".env"));

const supabaseUrl = requiredEnv("VITE_SPORTS_SUPABASE_URL").replace(/\/$/, "");
const supabaseAnonKey = requiredEnv("VITE_SPORTS_SUPABASE_ANON_KEY");
const catalogUrl =
  process.env.SPORTS_CATALOG_UPSTREAM_URL?.trim() ||
  "https://sportsx-26.vercel.app/api/dami";
const exportedAt = new Date().toISOString();

const supabaseHeaders = {
  Accept: "application/json",
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
};

const [servers, matches, catalog] = await Promise.all([
  getJson(`${supabaseUrl}/rest/v1/servers?select=*&order=id.asc`, supabaseHeaders),
  getJson(`${supabaseUrl}/rest/v1/matches?select=*&order=id.asc`, supabaseHeaders),
  getJson(catalogUrl, { Accept: "application/json" }),
]);

if (!Array.isArray(servers)) throw new Error("Supabase servers response is not an array");
if (!Array.isArray(matches)) throw new Error("Supabase matches response is not an array");
if (!catalog || typeof catalog !== "object" || !Array.isArray(catalog.streams)) {
  throw new Error("Catalog response does not contain a streams array");
}

const catalogJson = JSON.stringify(catalog, null, 2);
const snapshotHash = createHash("sha256").update(catalogJson).digest("hex");
const categoryCounts = Object.fromEntries(
  catalog.streams.map((group) => [
    String(group.category || "unknown"),
    Array.isArray(group.streams) ? group.streams.length : 0,
  ]),
);
const backendSources = {
  exported_at: exportedAt,
  supabase_servers: servers.map((server) => ({
    id: server.id,
    sport: server.sport,
    match_id: server.match_id,
    name: server.server_name,
    url: server.server_url,
    position: server.position,
  })),
  dami_sources: catalog.streams.flatMap((group) =>
    (Array.isArray(group.streams) ? group.streams : []).flatMap((stream) => {
      const sources = Array.isArray(stream.sources) ? stream.sources : [];
      if (!sources.length && (stream.iframe || stream.embed)) {
        return [
          {
            category: group.category,
            stream_id: stream.id,
            stream_name: stream.name,
            source_id: "primary",
            source_name: "Primary",
            source_type: "embed",
            embed_url: stream.iframe || stream.embed,
          },
        ];
      }
      return sources.map((source) => ({
        category: group.category,
        stream_id: stream.id,
        stream_name: stream.name,
        source_id: source.id,
        source_name: source.name,
        source_type: source.source,
        embed_url: source.embed,
      }));
    }),
  ),
};

const metadata = {
  exported_at: exportedAt,
  source: {
    supabase_project_ref: new URL(supabaseUrl).hostname.split(".")[0],
    catalog_url: catalogUrl,
  },
  counts: {
    supabase_servers: servers.length,
    supabase_matches: matches.length,
    catalog_categories: catalog.streams.length,
    catalog_streams: Object.values(categoryCounts).reduce((sum, count) => sum + count, 0),
    backend_source_records:
      backendSources.supabase_servers.length + backendSources.dami_sources.length,
  },
  catalog_categories: categoryCounts,
  catalog_sha256: snapshotHash,
};

await mkdir(exportDirectory, { recursive: true });
await Promise.all([
  writeJson("metadata.json", metadata),
  writeJson("supabase-servers.json", servers),
  writeJson("supabase-matches.json", matches),
  writeJson("backend-sources.json", backendSources),
  writeFile(path.join(exportDirectory, "dami-catalog.json"), `${catalogJson}\n`, "utf8"),
  writeFile(path.join(exportDirectory, "schema.sql"), schemaSql(), "utf8"),
  writeFile(
    path.join(exportDirectory, "seed.sql"),
    seedSql({ servers, matches, catalog, exportedAt, snapshotHash }),
    "utf8",
  ),
]);

console.log(
  JSON.stringify(
    {
      export_directory: exportDirectory,
      ...metadata.counts,
      catalog_sha256: snapshotHash,
    },
    null,
    2,
  ),
);

async function loadLocalEnv(envPath) {
  let content;
  try {
    content = await readFile(envPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getJson(url, headers) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  return response.json();
}

async function writeJson(filename, value) {
  await writeFile(
    path.join(exportDirectory, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function schemaSql() {
  return `-- Generated structure for a user-owned Supabase project.
-- Run this before seed.sql in the Supabase SQL Editor.

begin;

create table if not exists public.matches (
  id bigint generated by default as identity primary key,
  status text not null check (status in ('live', 'upcoming', 'other')),
  sport text not null,
  team_a text not null,
  team_b text,
  score_a integer not null default 0,
  score_b integer not null default 0,
  league text,
  match_time text,
  match_date text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.servers (
  id bigint generated by default as identity primary key,
  sport text not null,
  server_name text not null,
  server_url text not null,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  match_id bigint
);

create table if not exists public.dami_catalog_snapshots (
  snapshot_hash text primary key,
  provider text not null default 'dami',
  fetched_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists matches_sport_status_idx
  on public.matches (sport, status, position);
create index if not exists servers_sport_position_idx
  on public.servers (sport, position);
create index if not exists servers_match_id_idx
  on public.servers (match_id);
create index if not exists dami_catalog_snapshots_fetched_at_idx
  on public.dami_catalog_snapshots (fetched_at desc);

alter table public.matches enable row level security;
alter table public.servers enable row level security;
alter table public.dami_catalog_snapshots enable row level security;

drop policy if exists "Public can read matches" on public.matches;
create policy "Public can read matches"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "Public can read servers" on public.servers;
create policy "Public can read servers"
  on public.servers for select to anon, authenticated using (true);

drop policy if exists "Public can read catalog snapshots" on public.dami_catalog_snapshots;
create policy "Public can read catalog snapshots"
  on public.dami_catalog_snapshots for select to anon, authenticated using (true);

grant select on public.matches, public.servers, public.dami_catalog_snapshots
  to anon, authenticated;
revoke insert, update, delete on public.matches, public.servers, public.dami_catalog_snapshots
  from anon, authenticated;

commit;
`;
}

function seedSql({ servers, matches, catalog, exportedAt, snapshotHash }) {
  const matchColumns = [
    "id",
    "status",
    "sport",
    "team_a",
    "team_b",
    "score_a",
    "score_b",
    "league",
    "match_time",
    "match_date",
    "position",
    "created_at",
    "updated_at",
  ];
  const serverColumns = [
    "id",
    "sport",
    "server_name",
    "server_url",
    "position",
    "updated_at",
    "match_id",
  ];

  return `-- Public-data snapshot exported at ${exportedAt}.
-- Review third-party URLs and usage rights before publishing them.

begin;

${upsertSql("matches", matchColumns, matches)}

${upsertSql("servers", serverColumns, servers)}

insert into public.dami_catalog_snapshots
  (snapshot_hash, provider, fetched_at, payload)
values
  (${sqlValue(snapshotHash)}, 'dami', ${sqlValue(exportedAt)}, $dami_snapshot$${JSON.stringify(catalog)}$dami_snapshot$::jsonb)
on conflict (snapshot_hash) do update set
  provider = excluded.provider,
  fetched_at = excluded.fetched_at,
  payload = excluded.payload;

select setval(
  pg_get_serial_sequence('public.matches', 'id'),
  greatest((select coalesce(max(id), 1) from public.matches), 1),
  true
);
select setval(
  pg_get_serial_sequence('public.servers', 'id'),
  greatest((select coalesce(max(id), 1) from public.servers), 1),
  true
);

commit;
`;
}

function upsertSql(table, columns, rows) {
  if (!rows.length) return `-- No ${table} rows were present in this snapshot.`;
  const values = rows
    .map((row) => `  (${columns.map((column) => sqlValue(row[column])).join(", ")})`)
    .join(",\n");
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `  ${column} = excluded.${column}`)
    .join(",\n");

  return `insert into public.${table} (${columns.join(", ")})
values
${values}
on conflict (id) do update set
${updates};`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot serialize a non-finite number to SQL");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}
