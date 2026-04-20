"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoOverlay } from "@/app/lib/video-overlays";

export function VideoLayer({
                               overlays,
                               currentPage,
                               presentationId,
                           }: {
    overlays: VideoOverlay[];
    currentPage: number;
    presentationId: string;
}) {
    const slideOverlays = overlays.filter((o) => o.slideNumber === currentPage);
    if (slideOverlays.length === 0) return null;

    return (
        <>
            {slideOverlays.map((o) => (
                <VideoElement key={o.id} overlay={o} presentationId={presentationId} />
            ))}
        </>
    );
}

function VideoElement({
                          overlay,
                          presentationId,
                      }: {
    overlay: VideoOverlay;
    presentationId: string;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        return () => {
            ref.current?.pause();
        };
    }, []);

    useEffect(() => {
        const video = ref.current;
        if (!video) return;

        const onPlay = () => {
            setIsPlaying(true);
            setHasStarted(true);
        };
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);

        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("ended", onEnded);

        return () => {
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
            video.removeEventListener("ended", onEnded);
        };
    }, []);

    const togglePlay = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        const video = ref.current;
        if (!video) return;

        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    };

    // Object-fit positioning
    const px = overlay.posX ?? 50;
    const py = overlay.posY ?? 50;
    const posterUrl = `${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.id}.webp`;

    return (
        <div
            style={{
                position: "absolute",
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                width: `${overlay.width}%`,
                height: `${overlay.height}%`,
                zIndex: 5,
                pointerEvents: "auto",
                overflow: "hidden",
                background: "#000",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
        >
            <video
                ref={ref}
                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.filename}`}
                poster={posterUrl}
                autoPlay={overlay.autoplay}
                loop={overlay.loop}
                muted={overlay.muted}
                controls={hasStarted}
                playsInline
                preload="metadata"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: "cover",
                    objectPosition: `${px}% ${py}%`,
                    display: "block",
                }}
            />

            {!isPlaying && (
                <button
                    onClick={togglePlay}
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        background: "rgba(0, 0, 0, 0.5)",
                        backdropFilter: "blur(4px)",
                        border: "2px solid rgba(255, 255, 255, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 6,
                        padding: 0,
                    }}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white" style={{ marginLeft: "2px" }}>
                        <path d="M7 6v12l10-6z" />
                    </svg>
                </button>
            )}
        </div>
    );
}