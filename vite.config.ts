import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

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
]);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-stream-proxy",
      configureServer(server) {
        server.middlewares.use("/api/proxy", async (request: IncomingMessage, response: ServerResponse) => {
          const requestUrl = new URL(request.url || "", "http://localhost");
          const target = requestUrl.searchParams.get("url");
          const cleanMode = requestUrl.searchParams.get("clean");
          const forwardSearch = requestUrl.searchParams.get("forwardSearch") === "1";
          if (!target) {
            response.statusCode = 400;
            response.end("Missing url parameter");
            return;
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(target);
          } catch {
            response.statusCode = 400;
            response.end("Invalid url parameter");
            return;
          }

          if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
            response.statusCode = 400;
            response.end("Unsupported url protocol");
            return;
          }
          if (forwardSearch) appendForwardedSearchParams(targetUrl, requestUrl);

          const upstreamOrigin = allowedUpstreamOrigin(
            requestUrl.searchParams.get("upstreamOrigin"),
            targetUrl,
          );
          const upstreamHeaders: Record<string, string> = {
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
            response.setHeader("access-control-allow-origin", "*");
            response.setHeader("cache-control", "no-store");

            const contentType = upstream.headers.get("content-type") || "";
            if (cleanMode === "stream-popup" && contentType.includes("text/html")) {
              response.setHeader("content-type", "text/html; charset=utf-8");
              response.end(cleanStreamPopupHtml(await upstream.text(), targetUrl));
              return;
            }

            if (
              contentType.includes("mpegurl") ||
              targetUrl.pathname.toLowerCase().endsWith(".m3u8")
            ) {
              response.setHeader("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
              response.end(rewriteHlsManifest(await upstream.text(), targetUrl));
              return;
            }

            if (contentType) response.setHeader("content-type", contentType);
            response.end(Buffer.from(await upstream.arrayBuffer()));
          } catch (error) {
            response.statusCode = 502;
            response.end(error instanceof Error ? error.message : "Proxy request failed");
          }
        });
      },
    },
  ],
});

function appendForwardedSearchParams(targetUrl: URL, requestUrl: URL) {
  requestUrl.searchParams.forEach((value, key) => {
    if (proxyControlParams.has(key)) return;
    targetUrl.searchParams.append(key, value);
  });
}

function allowedUpstreamOrigin(value: string | null, targetUrl: URL) {
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

function rewriteHlsManifest(manifest: string, playlistUrl: URL) {
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

function proxyUrl(value: string, playlistUrl: URL) {
  try {
    const absoluteUrl = new URL(value, playlistUrl).toString();
    return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
  } catch {
    return value;
  }
}

function cleanStreamPopupHtml(html: string, pageUrl: URL) {
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

function rewriteFootstersApiUrls(html: string, pageUrl: URL) {
  const pageOrigin = pageUrl.origin;
  return html
    .replaceAll(
      "https://footapi-psi.vercel.app/main",
      proxiedApiUrl("https://footapi-psi.vercel.app/main", pageOrigin),
    )
    .replaceAll(
      "https://foott.vercel.app/api/op",
      proxiedApiUrl("https://foott.vercel.app/api/op", pageOrigin),
    );
}

function proxiedApiUrl(apiUrl: string, upstreamOrigin: string) {
  const params = new URLSearchParams({
    forwardSearch: "1",
    upstreamOrigin,
    url: apiUrl,
  });
  return `/api/proxy?${params.toString()}`;
}
