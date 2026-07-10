const defaultUpstreamUrl = "https://sportsx-26.vercel.app/api/dami";
const catalogCacheControl = "public, s-maxage=30, stale-while-revalidate=300";

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

  let upstreamUrl;
  try {
    upstreamUrl = resolveUpstreamUrl();
  } catch {
    sendJson(response, 500, { error: "Catalog upstream is not configured correctly" });
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "busted-minds-sports/0.1 catalog-fetcher",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      sendJson(response, 502, { error: `Catalog upstream returned HTTP ${upstream.status}` });
      return;
    }

    const payload = await upstream.json();
    if (!isCatalog(payload)) {
      sendJson(response, 502, { error: "Catalog upstream returned an invalid payload" });
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", catalogCacheControl);
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(JSON.stringify(payload));
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut ? "Catalog upstream timed out" : "Catalog upstream request failed",
    });
  }
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
