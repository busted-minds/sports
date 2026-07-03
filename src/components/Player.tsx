import {
  AlertTriangle,
  ExternalLink,
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
  const [iframeState, setIframeState] = useState<"loading" | "loaded" | "slow" | "failed">(
    "loading",
  );

  useEffect(() => {
    setIframeState("loading");
    if (!source || source.kind !== "iframe") return;

    const timeoutId = window.setTimeout(() => setIframeState("slow"), 5500);
    return () => window.clearTimeout(timeoutId);
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    setVideoError("");
    if (!video || !source) return;

    if (source.kind !== "hls" && source.kind !== "video") return;

    let hls: Hls | null = null;
    let disposed = false;
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (source.kind === "hls" && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.playbackUrl;
    } else if (source.kind === "hls") {
      void import("hls.js")
        .then(({ default: HlsPlayer }) => {
          if (disposed) return;
          if (!HlsPlayer.isSupported()) {
            setVideoError("HLS playback is not supported in this browser.");
            return;
          }

          hls = new HlsPlayer({ lowLatencyMode: true, backBufferLength: 90 });
          hls.loadSource(source.playbackUrl);
          hls.attachMedia(video);
        })
        .catch(() => {
          if (!disposed) setVideoError("HLS playback is not supported in this browser.");
        });
    } else if (source.kind === "video") {
      video.src = source.playbackUrl;
    }

    const play = () => {
      void video.play().catch(() => {
        return;
      });
    };

    video.addEventListener("canplay", play);

    return () => {
      disposed = true;
      video.removeEventListener("canplay", play);
      hls?.destroy();
    };
  }, [source]);

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
    return (
      <div className="player-viewport">
        <iframe
          key={source.url}
          src={source.url}
          title={`${match.name} stream`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
          allowFullScreen
          onLoad={() => setIframeState("loaded")}
          onError={() => setIframeState("failed")}
          referrerPolicy="no-referrer"
        />
        {iframeState !== "loaded" ? (
          <div className="player-overlay">
            <div>
              <Server size={20} aria-hidden="true" />
              <strong>
                {iframeState === "failed" ? "This source refused to connect" : "Waiting for source"}
              </strong>
              <span>
                If the frame shows block.opendns.com, this server is blocked by your DNS or network.
              </span>
            </div>
            <div className="player-actions">
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
          onError={() => setVideoError("Playback failed for this source.")}
        />
        {videoError ? (
          <div className="player-alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{videoError}</span>
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
