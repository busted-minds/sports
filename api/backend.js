import { readFile } from "node:fs/promises";
import path from "node:path";

const snapshotCacheControl = "public, s-maxage=300, stale-while-revalidate=3600";
const exportDirectory = path.join(process.cwd(), "data", "backend-export");
let snapshotPromise;

export default async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("allow", "GET, HEAD, OPTIONS");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const snapshot = await loadSnapshot();
    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", snapshotCacheControl);
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(JSON.stringify(snapshot));
  } catch {
    sendJson(response, 500, { error: "Backend snapshot is unavailable" });
  }
}

async function loadSnapshot() {
  snapshotPromise ??= Promise.all([
    readJson(path.join(exportDirectory, "supabase-servers.json")),
    readJson(path.join(exportDirectory, "supabase-matches.json")),
    readJson(path.join(exportDirectory, "metadata.json")).catch(() => null),
  ]).then(([servers, matches, metadata]) => {
    if (!Array.isArray(servers) || !Array.isArray(matches)) {
      throw new Error("Backend snapshot files must contain arrays");
    }

    return {
      exported_at: metadata?.exported_at ?? null,
      servers: servers.map(toServerRow).filter(Boolean),
      matches: matches.map(toMatchRow).filter(Boolean),
    };
  });

  return snapshotPromise;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function toServerRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    sport: row.sport,
    server_name: row.server_name,
    server_url: row.server_url,
    position: row.position,
    match_id: row.match_id,
  };
}

function toMatchRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    status: row.status,
    sport: row.sport,
    team_a: row.team_a,
    team_b: row.team_b,
    league: row.league,
    match_time: row.match_time,
    match_date: row.match_date,
    position: row.position,
  };
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,HEAD,OPTIONS");
  response.setHeader("access-control-allow-headers", "accept,content-type");
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}
