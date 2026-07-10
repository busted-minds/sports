import { readFile } from "node:fs/promises";
import path from "node:path";

const defaultUpstreamUrl = "https://sportsx-26.vercel.app/api/dami";
const catalogCacheControl = "public, s-maxage=30, stale-while-revalidate=300";
const snapshotCacheControl = "public, s-maxage=300, stale-while-revalidate=3600";
const snapshotFilename = path.join(
  process.cwd(),
  "data",
  "backend-export",
  "dami-catalog.json",
);
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
    const upstreamUrl = resolveUpstreamUrl();
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "busted-minds-sports/0.1 catalog-fetcher",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      throw new Error(`Catalog upstream returned HTTP ${upstream.status}`);
    }

    const payload = await upstream.json();
    if (!isCatalog(payload)) {
      throw new Error("Catalog upstream returned an invalid payload");
    }

    sendCatalog(response, request.method, payload, "upstream", catalogCacheControl);
  } catch {
    try {
      const snapshot = await loadSnapshot();
      sendCatalog(response, request.method, snapshot, "snapshot", snapshotCacheControl);
    } catch {
      sendJson(response, 502, { error: "Catalog upstream and snapshot are unavailable" });
    }
  }
}

async function loadSnapshot() {
  snapshotPromise ??= readFile(snapshotFilename, "utf8")
    .then(JSON.parse)
    .then((payload) => {
      if (!isCatalog(payload)) {
        throw new Error("Catalog snapshot returned an invalid payload");
      }
      return payload;
    });

  return snapshotPromise;
}

function sendCatalog(response, method, payload, source, cacheControl) {
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", cacheControl);
  response.setHeader("x-catalog-source", source);
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload));
}

function resolveUpstreamUrl() {
  const value = process.env.SPORTS_CATALOG_UPSTREAM_URL?.trim() || defaultUpstreamUrl;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Unsupported catalog upstream protocol");
  }
  if (url.username || url.password) {
    throw new Error("Catalog upstream credentials are not supported in the URL");
  }
  return url;
}

function isCatalog(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.streams));
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
