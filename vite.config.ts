import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-stream-proxy",
      configureServer(server) {
        server.middlewares.use("/api/proxy", async (request: IncomingMessage, response: ServerResponse) => {
          const requestUrl = new URL(request.url || "", "http://localhost");
          const target = requestUrl.searchParams.get("url");
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

          try {
            const upstream = await fetch(targetUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                Accept: request.headers.accept || "*/*",
              },
            });
            response.statusCode = upstream.status;
            response.setHeader("access-control-allow-origin", "*");
            response.setHeader("cache-control", "no-store");

            const contentType = upstream.headers.get("content-type") || "";
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
