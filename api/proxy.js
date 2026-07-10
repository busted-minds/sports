const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const cleanModeResponseHeaders = new Set(["content-security-policy", "x-frame-options"]);
const proxyControlParams = new Set(["clean", "forwardSearch", "upstreamOrigin", "url"]);
const allowedApiOriginsByHost = new Map([
  [
    "footapi-psi.vercel.app",
    new Set([
      "https://footsters-live.pages.dev",
      "https://footsters.pages.dev",
      "https://footsterss.pages.dev",
    ]),
  ],
  ["foott.vercel.app", new Set(["https://footsters-tv.pages.dev"])],
  [
    "football-main-one.vercel.app",
    new Set(["https://footsters-live.pages.dev", "https://footsterss.pages.dev"]),
  ],
]);

export default async function handler(request, response) {
  await proxyRequest(request, response);
}

async function proxyRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    setCors(response);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url || "", "http://localhost");
  const target = requestUrl.searchParams.get("url");
  const cleanMode = requestUrl.searchParams.get("clean");
  const forwardSearch = requestUrl.searchParams.get("forwardSearch") === "1";
  if (!target) {
    sendText(response, 400, "Missing url parameter");
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    sendText(response, 400, "Invalid url parameter");
    return;
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    sendText(response, 400, "Unsupported url protocol");
    return;
  }
  if (forwardSearch) appendForwardedSearchParams(targetUrl, requestUrl);

  const upstreamOrigin = allowedUpstreamOrigin(
    requestUrl.searchParams.get("upstreamOrigin"),
    targetUrl,
  );
  const upstreamHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    Accept: request.headers.accept || "*/*",
  };
  if (upstreamOrigin) {
    upstreamHeaders.Origin = upstreamOrigin;
    upstreamHeaders.Referer = `${upstreamOrigin}/`;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    response.statusCode = upstream.status;
    setCors(response);
    upstream.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (hopByHopHeaders.has(lowerKey)) return;
      if (cleanMode === "stream-popup" && cleanModeResponseHeaders.has(lowerKey)) return;
      response.setHeader(key, value);
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (cleanMode === "stream-popup" && contentType.includes("text/html")) {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(cleanStreamPopupHtml(await upstream.text(), targetUrl));
      return;
    }

    if (contentType.includes("mpegurl") || targetUrl.pathname.toLowerCase().endsWith(".m3u8")) {
      response.setHeader("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
      response.end(rewriteHlsManifest(await upstream.text(), targetUrl));
      return;
    }

    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    sendText(response, 502, error instanceof Error ? error.message : "Proxy request failed");
  }
}

function appendForwardedSearchParams(targetUrl, requestUrl) {
  requestUrl.searchParams.forEach((value, key) => {
    if (proxyControlParams.has(key)) return;
    targetUrl.searchParams.append(key, value);
  });
}

function allowedUpstreamOrigin(value, targetUrl) {
  if (!value) return "";

  const allowedOrigins = allowedApiOriginsByHost.get(targetUrl.hostname.toLowerCase());
  if (!allowedOrigins?.has(value)) return "";

  try {
    const origin = new URL(value).origin;
    return origin === value ? origin : "";
  } catch {
    return "";
  }
}

function cleanStreamPopupHtml(html, pageUrl) {
  const cleanupStyle = `<style id="bm-stream-popup-cleanup">
#tg-overlay,#tg-popup{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
</style>`;
  const redirectGuard = `<script id="bm-stream-redirect-guard">
(() => {
  window.open = () => null;
  document.addEventListener("click", (event) => {
    const target = event.target;
    const link = target && target.closest ? target.closest("a[href]") : null;
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;
    let next;
    try {
      next = new URL(href, location.href);
    } catch {
      return;
    }
    if (next.origin !== location.origin) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
</script>`;
  const cleanupHead = `${cleanupStyle}${redirectGuard}`;
  const cleanedHtml = rewriteFootstersApiUrls(html, pageUrl);

  if (cleanedHtml.includes("bm-stream-popup-cleanup")) return cleanedHtml;
  if (/<\/head>/i.test(cleanedHtml)) return cleanedHtml.replace(/<\/head>/i, `${cleanupHead}</head>`);
  return `${cleanupHead}${cleanedHtml}`;
}

function rewriteFootstersApiUrls(html, pageUrl) {
  const pageOrigin = pageUrl.origin;
  return html
    .replaceAll(
      "https://footapi-psi.vercel.app/main",
      proxiedApiUrl("https://footapi-psi.vercel.app/main", pageOrigin),
    )
    .replaceAll(
      "https://foott.vercel.app/api/op",
      proxiedApiUrl("https://foott.vercel.app/api/op", pageOrigin),
    )
    .replaceAll(
      "https://foott.vercel.app/api/events",
      proxiedApiUrl("https://foott.vercel.app/api/events", pageOrigin),
    )
    .replaceAll(
      "https://football-main-one.vercel.app/main",
      proxiedApiUrl("https://football-main-one.vercel.app/main", pageOrigin),
    );
}

function proxiedApiUrl(apiUrl, upstreamOrigin) {
  const params = new URLSearchParams({
    forwardSearch: "1",
    upstreamOrigin,
    url: apiUrl,
  });
  return `/api/proxy?${params.toString()}`;
}

function rewriteHlsManifest(manifest, playlistUrl) {
  return manifest
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return line;
      if (line.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${proxyUrl(uri, playlistUrl)}"`);
      }
      return proxyUrl(line.trim(), playlistUrl);
    })
    .join("\n");
}

function proxyUrl(value, playlistUrl) {
  try {
    const absoluteUrl = new URL(value, playlistUrl).toString();
    return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
  } catch {
    return value;
  }
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,HEAD,OPTIONS");
  response.setHeader("access-control-allow-headers", "range,accept,origin,content-type");
  response.setHeader("cache-control", "no-store");
}

function sendText(response, status, message) {
  response.statusCode = status;
  setCors(response);
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(message);
}
