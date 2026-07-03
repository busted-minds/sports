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

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: request.headers.accept || "*/*",
      },
    });

    response.statusCode = upstream.status;
    setCors(response);
    upstream.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) response.setHeader(key, value);
    });

    const contentType = upstream.headers.get("content-type") || "";
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
