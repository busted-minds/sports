import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  MonitorPlay,
  RadioTower,
  RotateCcw,
  Server,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { Match, StreamSource } from "../lib/catalog";

type PlayerProps = {
  match: Match | null;
  source: StreamSource | null;
  canUseNextSource?: boolean;
  onNextSource?: () => void;
};

export function Player({ match, source, canUseNextSource = false, onNextSource }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [videoState, setVideoState] = useState<"loading" | "playing" | "waiting" | "error">(
    "loading",
  );
  const [iframeState, setIframeState] = useState<"loading" | "loaded" | "slow" | "failed">(
    "loading",
  );

  useEffect(() => {
    setIframeState("loading");
    if (!source || source.kind !== "iframe") return;

    const timeoutId = window.setTimeout(() => {
      setIframeState((currentState) => (currentState === "loading" ? "slow" : currentState));
    }, 5500);
    return () => window.clearTimeout(timeoutId);
  }, [retryNonce, source?.kind, source?.url]);

  useEffect(() => {
    const video = videoRef.current;
    setVideoError("");
    setVideoState("loading");
    if (!video || !source) return;

    if (source.kind !== "hls" && source.kind !== "video") return;

    let hls: Hls | null = null;
    let disposed = false;
    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;
    const playbackUrl = proxiedMediaUrl(source.playbackUrl);
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (source.kind === "hls" && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
    } else if (source.kind === "hls") {
      void import("hls.js")
        .then(({ default: HlsPlayer }) => {
          if (disposed) return;
          if (!HlsPlayer.isSupported()) {
            setVideoState("error");
            setVideoError("HLS playback is not supported in this browser.");
            return;
          }

          hls = new HlsPlayer({ lowLatencyMode: true, backBufferLength: 90 });
          hls.on(HlsPlayer.Events.ERROR, (_event, data: { fatal?: boolean; type?: string }) => {
            if (!data.fatal || disposed) return;

            if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR && networkRecoveryAttempts < 1) {
              networkRecoveryAttempts += 1;
              hls?.startLoad();
              return;
            }

            if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 1) {
              mediaRecoveryAttempts += 1;
              hls?.recoverMediaError();
              return;
            }

            setVideoState("error");
            setVideoError("Playback failed for this source.");
          });
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
        })
        .catch(() => {
          if (!disposed) {
            setVideoState("error");
            setVideoError("HLS playback is not supported in this browser.");
          }
        });
    } else if (source.kind === "video") {
      video.src = playbackUrl;
    }

    const play = () => {
      void video.play().catch(() => {
        return;
      });
    };
    const loadTimeoutId = window.setTimeout(() => {
      if (disposed || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
      setVideoState("error");
      setVideoError("This source is taking too long to respond.");
    }, 15_000);
    const clearLoadTimeout = () => window.clearTimeout(loadTimeoutId);

    video.addEventListener("canplay", play);
    video.addEventListener("canplay", clearLoadTimeout);
    video.addEventListener("playing", clearLoadTimeout);

    return () => {
      disposed = true;
      video.removeEventListener("canplay", play);
      video.removeEventListener("canplay", clearLoadTimeout);
      video.removeEventListener("playing", clearLoadTimeout);
      window.clearTimeout(loadTimeoutId);
      hls?.destroy();
    };
  }, [retryNonce, source]);

  const retryCurrentSource = () => {
    setIframeState("loading");
    setVideoError("");
    setVideoState("loading");
    setRetryNonce((current) => current + 1);
  };

  if (!match || !source) {
    return (
      <div className="player-viewport player-empty">
        <MonitorPlay size={34} aria-hidden="true" />
        <div>
          <strong>No active stream</strong>
          <span>Live catalog is ready</span>
        </div>
      </div>
    );
  }

  if (source.kind === "iframe") {
    const iframeSource = cleanedIframeSource(source.url);
    const iframeTitle =
      iframeState === "failed"
        ? "This source refused to connect"
        : iframeState === "slow"
          ? "This source is taking longer than usual"
          : "Waiting for source";

    return (
      <div className="player-viewport">
        <iframe
          key={`${source.url}:${retryNonce}`}
          src={iframeSource.url}
          title={`${match.name} stream`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
          allowFullScreen
          sandbox={iframeSource.sandbox}
          onLoad={() => setIframeState("loaded")}
          onError={() => setIframeState("failed")}
          referrerPolicy="no-referrer"
        />
        {iframeState !== "loaded" ? (
          <div className="player-overlay">
            <div>
              <Server size={20} aria-hidden="true" />
              <strong>{iframeTitle}</strong>
              <span>
                If the frame shows block.opendns.com, this server is blocked by your DNS or network.
              </span>
            </div>
            <div className="player-actions">
              <button type="button" onClick={retryCurrentSource}>
                <RotateCcw size={15} aria-hidden="true" />
                Retry
              </button>
              {canUseNextSource ? (
                <button type="button" onClick={onNextSource}>
                  <RotateCcw size={15} aria-hidden="true" />
                  Next server
                </button>
              ) : null}
              <a href={source.url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} aria-hidden="true" />
                Open tab
              </a>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (source.kind === "hls" || source.kind === "video") {
    return (
      <div className="player-viewport">
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          poster={match.poster || undefined}
          onCanPlay={() => {
            setVideoError("");
            setVideoState("playing");
          }}
          onLoadStart={() => setVideoState("loading")}
          onPlaying={() => {
            setVideoError("");
            setVideoState("playing");
          }}
          onWaiting={() => setVideoState("waiting")}
          onError={() => {
            setVideoState("error");
            setVideoError("Playback failed for this source.");
          }}
        />
        {!videoError && videoState !== "playing" ? (
          <div className="player-buffering" role="status" aria-live="polite">
            <Loader2 className="spin" size={18} aria-hidden="true" />
            <span>{videoState === "waiting" ? "Buffering stream" : "Loading stream"}</span>
          </div>
        ) : null}
        {videoError ? (
          <div className="player-alert" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{videoError}</span>
            <button type="button" onClick={retryCurrentSource}>
              Retry
            </button>
            {canUseNextSource ? (
              <button type="button" onClick={onNextSource}>
                Next server
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="player-viewport player-empty">
      <RadioTower size={34} aria-hidden="true" />
      <div>
        <strong>Source available</strong>
        <a href={source.url} target="_blank" rel="noreferrer">
          Open stream <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function proxiedMediaUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.origin === window.location.origin) return value;
    return `/api/proxy?url=${encodeURIComponent(value)}`;
  } catch {
    return value;
  }
}

const standardIframeSandbox = "allow-scripts allow-same-origin allow-forms allow-presentation";

const popupCleanupHosts = new Set([
  "footsters-live.pages.dev",
  "footsters-tv.pages.dev",
  "footsters.pages.dev",
  "footsterss.pages.dev",
]);

function cleanedIframeSource(value: string) {
  try {
    const parsed = new URL(value);
    if (!popupCleanupHosts.has(parsed.hostname.toLowerCase())) {
      return { url: value, sandbox: standardIframeSandbox };
    }

    const params = new URLSearchParams({
      clean: "stream-popup",
      url: parsed.toString(),
    });

    parsed.searchParams.forEach((paramValue, key) => {
      if (key === "clean" || key === "url") return;
      params.append(key, paramValue);
    });

    return { url: `/api/proxy?${params.toString()}`, sandbox: standardIframeSandbox };
  } catch {
    return { url: value, sandbox: standardIframeSandbox };
  }
}
