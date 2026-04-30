"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { VideoOverlay } from "@/app/lib/video-overlays";
import type { TextBlock } from "@/app/lib/text-blocks";
import { useSession } from "next-auth/react";
import {
    OverlayTextBox,
    TextBlockPropertiesPanel,
    useTextBlocks,
} from "@/app/components/EditorTextBlocks";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PresentationMeta {
    id: string;
    title: string;
    totalPages: number;
    aspectRatio: number;
}

type DragMode =
    | { type: "move" }
    | { type: "resize"; handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" };

// ─── Constants ────────────────────────────────────────────────────────────────

const HANDLE_SIZE = 10;
const MIN_SIZE_PCT = 5;

// ─── Wrapper for Suspense ───────────────────────────────────────────────────

export default function EditorPage() {
    return (
        <Suspense
            fallback={
                <div className="editor-loading">
                    <div className="spinner" />
                    Loading Editor…
                </div>
            }
        >
            <EditorContent />
        </Suspense>
    );
}

// ─── Right-panel tab ─────────────────────────────────────────────────────────
type PropsTab = "video" | "text";

// ─── Main Editor Content ──────────────────────────────────────────────────────

function EditorContent() {
    const { data: session, status } = useSession();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [meta, setMeta] = useState<PresentationMeta | null>(null);
    const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [compressing, setCompressing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [gridScale, setGridScale] = useState(150);
    const [propsTab, setPropsTab] = useState<PropsTab>("video");

    const stageRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Text block hook
    const {
        textBlocks,
        selectedTextId,
        setSelectedTextId,
        loadTextBlocks,
        saveTextBlocks,
        addTextBlock,
        updateTextBlock,
        deleteTextBlock,
    } = useTextBlocks(id);

    // ── Auth Check ──
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/auth/signin?callbackUrl=/edit/${id}`
            );
        }
    }, [status, router, id]);

    // ── Load meta + overlays + text blocks ──
    useEffect(() => {
        if (status !== "authenticated") return;

        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}`)
            .then((r) => r.json())
            .then((data) => {
                setMeta(data);
                const startPage = parseInt(searchParams.get("page") ?? "1");
                if (startPage >= 1 && startPage <= data.totalPages) {
                    setCurrentSlide(startPage);
                }
            })
            .catch(() => setError("Presentation not found"));

        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}/videos`)
            .then((r) => r.json())
            .then(setOverlays)
            .catch(() => setOverlays([]));

        loadTextBlocks();
    }, [id, searchParams, status, loadTextBlocks]);

    // ── Save video overlays to server ──
    const saveOverlays = useCallback(
        async (updated: VideoOverlay[]) => {
            setSaving(true);
            setSaved(false);
            await fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}/videos`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updated),
                }
            );
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        },
        [id]
    );

    // ── Update a single video overlay field ──
    const updateOverlay = useCallback(
        (videoId: string, patch: Partial<VideoOverlay>, autosave = false) => {
            setOverlays((prev) => {
                const next = prev.map((o) =>
                    o.id === videoId ? { ...o, ...patch } : o
                );
                if (autosave) saveOverlays(next);
                return next;
            });
        },
        [saveOverlays]
    );

    // ── Upload video ──
    const uploadVideo = useCallback(
        async (file: File) => {
            if (!file) return;
            if (file.size > 300 * 1024 * 1024) {
                setError("File too large (max 300MB)");
                return;
            }

            setUploading(true);
            setUploadProgress("Uploading…");
            setError(null);

            const fd = new FormData();
            fd.append("file", file);
            fd.append("slideNumber", String(currentSlide));

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}/videos`,
                    { method: "POST", body: fd }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Upload failed");
                setOverlays((prev) => [...prev, data.overlay]);
                setSelectedId(data.overlay.id);
                setPropsTab("video");
            } catch (err) {
                setError(String(err));
            } finally {
                setUploading(false);
                setUploadProgress("");
            }
        },
        [id, currentSlide]
    );

    // ── Delete video overlay ──
    const deleteOverlay = useCallback(
        async (videoId: string) => {
            if (!confirm("Delete this video overlay?")) return;
            await fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}/videos`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ videoId }),
                }
            );
            setOverlays((prev) => prev.filter((o) => o.id !== videoId));
            if (selectedId === videoId) setSelectedId(null);
        },
        [id, selectedId]
    );

    // ── Delete entire presentation ──
    const deletePresentation = async () => {
        if (
            !confirm(
                "PERMANENTLY delete this entire presentation and all its videos?"
            )
        )
            return;
        setDeleting(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}`,
                { method: "DELETE" }
            );
            if (res.ok) {
                router.push("/");
            } else {
                alert("Failed to delete");
                setDeleting(false);
            }
        } catch (err) {
            alert("Error: " + err);
            setDeleting(false);
        }
    };

    // ── Recompress slides ──
    const recompressSlides = async () => {
        const quality = prompt("Enter target quality (1-100):", "75");
        if (!quality) return;
        setCompressing(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${id}/recompress`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quality: parseInt(quality) }),
                }
            );
            const data = await res.json();
            if (res.ok) {
                alert(`Successfully recompressed ${data.count} slides.`);
                window.location.reload();
            } else {
                alert("Error: " + data.error);
            }
        } catch (err) {
            alert("Failed to recompress: " + err);
        } finally {
            setCompressing(false);
        }
    };

    // ── Pointer-based drag/resize for VIDEO overlays ──
    const startInteraction = useCallback(
        (e: React.PointerEvent, overlay: VideoOverlay, mode: DragMode) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedId(overlay.id);
            setSelectedTextId(null);

            const stage = stageRef.current;
            if (!stage) return;

            const stageRect = stage.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startOverlay = { ...overlay };

            const onMove = (ev: PointerEvent) => {
                const dx = ((ev.clientX - startX) / stageRect.width) * 100;
                const dy = ((ev.clientY - startY) / stageRect.height) * 100;

                if (mode.type === "move") {
                    updateOverlay(overlay.id, {
                        x: Math.max(
                            0,
                            Math.min(100 - startOverlay.width, startOverlay.x + dx)
                        ),
                        y: Math.max(
                            0,
                            Math.min(100 - startOverlay.height, startOverlay.y + dy)
                        ),
                    });
                } else {
                    const h = mode.handle;
                    let { x, y, width, height } = startOverlay;
                    if (h.includes("e")) width = Math.max(MIN_SIZE_PCT, width + dx);
                    if (h.includes("s")) height = Math.max(MIN_SIZE_PCT, height + dy);
                    if (h.includes("w")) {
                        const newW = Math.max(MIN_SIZE_PCT, width - dx);
                        x = x + (width - newW);
                        width = newW;
                    }
                    if (h.includes("n")) {
                        const newH = Math.max(MIN_SIZE_PCT, height - dy);
                        y = y + (height - newH);
                        height = newH;
                    }
                    x = Math.max(0, x);
                    y = Math.max(0, y);
                    if (x + width > 100) width = 100 - x;
                    if (y + height > 100) height = 100 - y;
                    updateOverlay(overlay.id, { x, y, width, height });
                }
            };

            const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                setOverlays((current) => {
                    saveOverlays(current);
                    return current;
                });
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        },
        [updateOverlay, saveOverlays, setSelectedTextId]
    );

    // ── Pointer-based drag/resize for TEXT BLOCKS ──
    const startTextInteraction = useCallback(
        (e: React.PointerEvent, block: TextBlock, mode: DragMode) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedTextId(block.id);
            setSelectedId(null);
            setPropsTab("text");

            const stage = stageRef.current;
            if (!stage) return;

            const stageRect = stage.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startBlock = { ...block };

            const onMove = (ev: PointerEvent) => {
                const dx = ((ev.clientX - startX) / stageRect.width) * 100;
                const dy = ((ev.clientY - startY) / stageRect.height) * 100;

                if (mode.type === "move") {
                    updateTextBlock(block.id, {
                        x: Math.max(0, Math.min(100 - startBlock.width, startBlock.x + dx)),
                        y: Math.max(0, startBlock.y + dy),
                    });
                } else {
                    const h = mode.handle;
                    let { x, y, width } = startBlock;
                    if (h.includes("e")) width = Math.max(8, width + dx);
                    if (h.includes("w")) {
                        const newW = Math.max(8, width - dx);
                        x = x + (width - newW);
                        width = newW;
                    }
                    x = Math.max(0, x);
                    if (x + width > 100) width = 100 - x;
                    updateTextBlock(block.id, { x, y, width });
                }
            };

            const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                // final save
                setTextBlocks_forSave();
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        },
        [updateTextBlock, setSelectedTextId]
    );

    // Helper: trigger save after drag ends (needs current state)
    // We use a ref trick via a callback that reads the latest state
    const setTextBlocks_forSave = useCallback(() => {
        // saveTextBlocks reads textBlocks from closure via hook internals.
        // We trigger it by re-reading state in a useEffect is not ideal here,
        // so instead we call the hook's saveTextBlocks via a small wrapper.
        // The hook's updateTextBlock with autosave=true handles this on each move;
        // for final save we force it via the hook.
        // SIMPLEST: call saveTextBlocks(textBlocks) — but textBlocks may be stale.
        // Better: let the hook track latest via a ref.
        // For now, we trigger save on each move with autosave=true.
    }, []);

    // ── Actually, use autosave=true on each text block move for simplicity ──
    // Override startTextInteraction to use autosave
    const startTextInteractionFinal = useCallback(
        (e: React.PointerEvent, block: TextBlock, mode: DragMode) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedTextId(block.id);
            setSelectedId(null);
            setPropsTab("text");

            const stage = stageRef.current;
            if (!stage) return;

            const stageRect = stage.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startBlock = { ...block };

            const onMove = (ev: PointerEvent) => {
                const dx = ((ev.clientX - startX) / stageRect.width) * 100;
                const dy = ((ev.clientY - startY) / stageRect.height) * 100;

                if (mode.type === "move") {
                    updateTextBlock(block.id, {
                        x: Math.max(0, Math.min(100 - startBlock.width, startBlock.x + dx)),
                        y: Math.max(0, startBlock.y + dy),
                    });
                } else {
                    const h = mode.handle;
                    let { x, y, width } = startBlock;
                    if (h.includes("e")) width = Math.max(8, width + dx);
                    if (h.includes("w")) {
                        const newW = Math.max(8, width - dx);
                        x = x + (width - newW);
                        width = newW;
                    }
                    x = Math.max(0, x);
                    if (x + width > 100) width = 100 - x;
                    updateTextBlock(block.id, { x, y, width });
                }
            };

            const onUp = (ev: PointerEvent) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                // Save final position — we need latest blocks, so read from DOM state
                // We call updateTextBlock with autosave=true one last time with current values
                // The simplest approach: just call saveTextBlocks after a tick
                setTimeout(() => {
                    // The hook exposes saveTextBlocks; textBlocks is in scope from hook
                    // We trigger via a re-read via the update fn with autosave
                    updateTextBlock(block.id, {}, true);
                }, 0);
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        },
        [updateTextBlock, setSelectedTextId]
    );

    const currentOverlays = overlays.filter((o) => o.slideNumber === currentSlide);
    const currentTextBlocks = textBlocks.filter((b) => b.slideNumber === currentSlide);
    const selectedOverlay = overlays.find((o) => o.id === selectedId) ?? null;
    const selectedTextBlock = textBlocks.find((b) => b.id === selectedTextId) ?? null;

    if (status === "loading") {
        return (
            <div className="editor-loading">
                <div className="spinner" />
                Checking authentication…
            </div>
        );
    }

    if (
        status === "unauthenticated" ||
        (session?.user as any)?.role !== "admin"
    ) {
        return null;
    }

    if (error && !meta) {
        return (
            <div className="editor-error">
                <p>{error}</p>
                <button onClick={() => router.push("/")}>← Home</button>
            </div>
        );
    }

    if (!meta) {
        return (
            <div className="editor-loading">
                <div className="spinner" />
                Loading…
            </div>
        );
    }

    return (
        <div className="editor-shell">
            {/* ── Top bar ── */}
            <header className="editor-topbar">
                <a
                    href={`${process.env.NEXT_PUBLIC_BASE_PATH}/`}
                    className="nav-logo"
                >
                    Coursework
                </a>
                <span className="editor-title">{meta.title}</span>
                <div className="editor-topbar-actions">
                    {saving && <span className="save-status">Saving…</span>}
                    {saved && (
                        <span className="save-status save-status--ok">✓ Saved</span>
                    )}

                    <button
                        className="btn btn--danger"
                        style={{ width: "auto", marginTop: 0 }}
                        onClick={deletePresentation}
                        disabled={deleting}
                    >
                        {deleting ? "Deleting..." : "Delete All"}
                    </button>

                    <button
                        className="btn"
                        onClick={recompressSlides}
                        disabled={compressing}
                    >
                        {compressing ? "Compressing..." : "Compress Slides"}
                    </button>
                    <a
                        href={`${process.env.NEXT_PUBLIC_BASE_PATH}/view/${id}#1`}
                        className="btn btn--accent"
                        target="_blank"
                        rel="noopener"
                    >
                        Preview from slide 1 ↗
                    </a>
                    <button
                        className="btn btn--accent"
                        onClick={() => saveOverlays(overlays)}
                        disabled={saving}
                    >
                        Save all
                    </button>
                </div>
            </header>

            <div className="editor-body">
                {/* ── Left panel: slide list ── */}
                <aside className="editor-slides">
                    <div
                        className="editor-slides-label"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span>Slides</span>
                        <button
                            className="btn"
                            style={{ padding: "2px 6px" }}
                            onClick={() => setShowGrid(!showGrid)}
                            title="Grid View"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </button>
                    </div>

                    <div className="editor-slides-list">
                        {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(
                            (n) => {
                                const hasVideo = overlays.some((o) => o.slideNumber === n);
                                const hasText = textBlocks.some((b) => b.slideNumber === n);
                                return (
                                    <button
                                        key={n}
                                        className={`slide-thumb-btn ${n === currentSlide ? "slide-thumb-btn--active" : ""}`}
                                        onClick={() => {
                                            setCurrentSlide(n);
                                            setSelectedId(null);
                                            setSelectedTextId(null);
                                        }}
                                    >
                                        <div
                                            className="slide-thumb-img"
                                            style={{ aspectRatio: meta.aspectRatio }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${id}/thumb-${String(n).padStart(4, "0")}.webp?v=2`}
                                                alt={`Slide ${n}`}
                                                loading="lazy"
                                            />
                                            {hasVideo && (
                                                <span className="slide-has-video">▶</span>
                                            )}
                                            {/* Text block indicator */}
                                            {hasText && (
                                                <span
                                                    style={{
                                                        position: "absolute",
                                                        top: "4px",
                                                        left: "4px",
                                                        background: "rgba(124,58,237,0.85)",
                                                        color: "#fff",
                                                        fontSize: "8px",
                                                        padding: "1px 4px",
                                                        borderRadius: "4px",
                                                        fontWeight: 700,
                                                        lineHeight: 1.4,
                                                    }}
                                                >
                                                    T
                                                </span>
                                            )}
                                        </div>
                                        <span className="slide-thumb-num">{n}</span>
                                    </button>
                                );
                            }
                        )}
                    </div>
                </aside>

                {/* ── Centre: stage + controls ── */}
                <main className="editor-main">
                    {/* Grid Overlay */}
                    {showGrid && (
                        <div
                            className="slide-grid-overlay"
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 100,
                                background: "var(--bg)",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                className="grid-toolbar"
                                style={{
                                    padding: "12px 20px",
                                    borderBottom: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                }}
                            >
                                <span style={{ fontSize: "13px", fontWeight: "bold" }}>
                                    All Slides
                                </span>
                                <div style={{ flex: 1 }} />
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            color: "var(--text-muted)",
                                        }}
                                    >
                                        Scale:
                                    </span>
                                    <button
                                        className="btn"
                                        onClick={() =>
                                            setGridScale((s) => Math.max(80, s - 20))
                                        }
                                    >
                                        −
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={() =>
                                            setGridScale((s) => Math.min(400, s + 20))
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    className="btn btn--accent"
                                    onClick={() => setShowGrid(false)}
                                >
                                    Close Grid
                                </button>
                            </div>
                            <div
                                className="grid-content"
                                style={{
                                    flex: 1,
                                    overflowY: "auto",
                                    padding: "40px",
                                    display: "grid",
                                    gridTemplateColumns: `repeat(auto-fill, minmax(${gridScale}px, 1fr))`,
                                    gap: "32px",
                                    alignContent: "start",
                                }}
                            >
                                {Array.from(
                                    { length: meta.totalPages },
                                    (_, i) => i + 1
                                ).map((n) => {
                                    const hasVideo = overlays.some(
                                        (o) => o.slideNumber === n
                                    );
                                    return (
                                        <button
                                            key={n}
                                            className={`slide-thumb-btn ${n === currentSlide ? "slide-thumb-btn--active" : ""}`}
                                            onClick={() => {
                                                setCurrentSlide(n);
                                                setSelectedId(null);
                                                setShowGrid(false);
                                            }}
                                            style={{
                                                width: "100%",
                                                height: "auto",
                                                border: "none",
                                                background: "none",
                                                padding: 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    position: "relative",
                                                    width: "100%",
                                                    aspectRatio: `${meta.aspectRatio}`,
                                                    overflow: "hidden",
                                                    borderRadius: "4px",
                                                    border:
                                                        n === currentSlide
                                                            ? "2px solid var(--accent)"
                                                            : "2px solid transparent",
                                                    boxShadow:
                                                        "0 4px 12px rgba(0,0,0,0.3)",
                                                }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${id}/thumb-${String(n).padStart(4, "0")}.webp?v=2`}
                                                    alt={`Slide ${n}`}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                        display: "block",
                                                    }}
                                                />
                                                {hasVideo && (
                                                    <span
                                                        className="slide-has-video"
                                                        style={{
                                                            right: "8px",
                                                            bottom: "8px",
                                                        }}
                                                    >
                                                        ▶
                                                    </span>
                                                )}
                                            </div>
                                            <span
                                                className="slide-thumb-num"
                                                style={{
                                                    display: "block",
                                                    marginTop: "4px",
                                                }}
                                            >
                                                {n}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Upload bar */}
                    <div className="editor-upload-bar">
                        <span className="editor-slide-label">
                            Slide {currentSlide} of {meta.totalPages}
                        </span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadVideo(f);
                                e.target.value = "";
                            }}
                        />
                        <button
                            className="btn btn--accent"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <div className="spinner spinner--sm" />
                                    {uploadProgress}
                                </>
                            ) : (
                                "+ Add video"
                            )}
                        </button>

                        {/* Add text block button */}
                        <button
                            className="btn"
                            onClick={() => {
                                addTextBlock(currentSlide);
                                setPropsTab("text");
                            }}
                            style={{
                                gap: "6px",
                                display: "flex",
                                alignItems: "center",
                                fontSize: "12px",
                            }}
                            title="Add a collapsible text note to this slide"
                        >
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="12" y1="18" x2="12" y2="12" />
                                <line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                            + Text block
                        </button>

                        <a
                            href={`${process.env.NEXT_PUBLIC_BASE_PATH}/view/${id}#${currentSlide}`}
                            className="btn"
                            target="_blank"
                            rel="noopener"
                            style={{ fontSize: "11px" }}
                        >
                            Preview ↗
                        </a>

                        {error && (
                            <span className="upload-error-inline">⚠ {error}</span>
                        )}
                    </div>

                    {/* Stage */}
                    <div className="editor-stage-wrap">
                        <div
                            ref={stageRef}
                            className="editor-stage"
                            style={{
                                aspectRatio: meta.aspectRatio,
                                // @ts-ignore
                                "--aspect": meta.aspectRatio,
                            }}
                            onClick={() => {
                                setSelectedId(null);
                                setSelectedTextId(null);
                            }}
                        >
                            {/* Slide image */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${id}/slide-${String(currentSlide).padStart(4, "0")}.webp?v=2`}
                                alt={`Slide ${currentSlide}`}
                                className="editor-slide-img"
                                draggable={false}
                            />

                            {/* Video overlays */}
                            {currentOverlays.map((overlay) => (
                                <OverlayBox
                                    key={overlay.id}
                                    overlay={overlay}
                                    presentationId={id}
                                    isSelected={overlay.id === selectedId}
                                    onStartInteraction={startInteraction}
                                    onSelect={() => {
                                        setSelectedId(overlay.id);
                                        setSelectedTextId(null);
                                        setPropsTab("video");
                                    }}
                                />
                            ))}

                            {/* Text block overlays */}
                            {currentTextBlocks.map((block) => (
                                <OverlayTextBox
                                    key={block.id}
                                    block={block}
                                    isSelected={block.id === selectedTextId}
                                    onSelect={() => {
                                        setSelectedTextId(block.id);
                                        setSelectedId(null);
                                        setPropsTab("text");
                                    }}
                                    onStartInteraction={startTextInteractionFinal}
                                />
                            ))}
                        </div>
                    </div>

                    <p className="editor-hint">
                        Drag to move · Drag edges to resize · Click empty area to
                        deselect
                    </p>
                </main>

                {/* ── Right panel: properties ── */}
                <aside className="editor-props">
                    {/* Tab switcher */}
                    <div
                        style={{
                            display: "flex",
                            borderBottom: "1px solid var(--border)",
                            marginBottom: "12px",
                        }}
                    >
                        {(["video", "text"] as PropsTab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setPropsTab(tab)}
                                style={{
                                    flex: 1,
                                    padding: "8px 4px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    background: "none",
                                    border: "none",
                                    borderBottom:
                                        propsTab === tab
                                            ? "2px solid var(--accent)"
                                            : "2px solid transparent",
                                    color:
                                        propsTab === tab
                                            ? "var(--text)"
                                            : "var(--text-muted)",
                                    cursor: "pointer",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    transition: "color 0.15s",
                                }}
                            >
                                {tab === "video" ? "🎬 Video" : "📝 Text"}
                            </button>
                        ))}
                    </div>

                    {propsTab === "video" ? (
                        <>
                            <div className="editor-props-label">Video Properties</div>
                            {selectedOverlay ? (
                                <PropertiesPanel
                                    overlay={selectedOverlay}
                                    presentationId={id}
                                    totalPages={meta.totalPages}
                                    onUpdate={(patch) =>
                                        updateOverlay(selectedOverlay.id, patch)
                                    }
                                    onSave={() => saveOverlays(overlays)}
                                    onDelete={() => deleteOverlay(selectedOverlay.id)}
                                />
                            ) : (
                                <div className="props-empty">
                                    Select a video overlay to edit its properties
                                </div>
                            )}

                            {currentOverlays.length > 0 && (
                                <div className="overlay-list">
                                    <div className="overlay-list-label">
                                        Videos on this slide
                                    </div>
                                    {currentOverlays.map((o) => (
                                        <button
                                            key={o.id}
                                            className={`overlay-list-item ${o.id === selectedId ? "overlay-list-item--active" : ""}`}
                                            onClick={() => setSelectedId(o.id)}
                                        >
                                            <span className="overlay-list-icon">▶</span>
                                            <span className="overlay-list-name">
                                                {o.filename}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="editor-props-label">Text Block Properties</div>
                            {selectedTextBlock ? (
                                <TextBlockPropertiesPanel
                                    block={selectedTextBlock}
                                    totalPages={meta.totalPages}
                                    onUpdate={(patch, andSave) => updateTextBlock(selectedTextBlock.id, patch, andSave)}

                                    onSave={() =>
                                        saveTextBlocks(textBlocks)
                                    }
                                    onDelete={() =>
                                        deleteTextBlock(selectedTextBlock.id)
                                    }
                                />
                            ) : (
                                <div className="props-empty">
                                    Select a text block to edit it, or click{" "}
                                    <strong>+ Text block</strong> to add one to this slide.
                                </div>
                            )}

                            {currentTextBlocks.length > 0 && (
                                <div className="overlay-list">
                                    <div className="overlay-list-label">
                                        Text blocks on this slide
                                    </div>
                                    {currentTextBlocks.map((b) => (
                                        <button
                                            key={b.id}
                                            className={`overlay-list-item ${b.id === selectedTextId ? "overlay-list-item--active" : ""}`}
                                            onClick={() => {
                                                setSelectedTextId(b.id);
                                                setSelectedId(null);
                                            }}
                                        >
                                            <span className="overlay-list-icon">📝</span>
                                            <span className="overlay-list-name">
                                                {b.title || "Untitled"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

// ─── Video Overlay Box (unchanged from original) ──────────────────────────────

function OverlayBox({
                        overlay,
                        presentationId,
                        isSelected,
                        onStartInteraction,
                        onSelect,
                    }: {
    overlay: VideoOverlay;
    presentationId: string;
    isSelected: boolean;
    onStartInteraction: (
        e: React.PointerEvent,
        o: VideoOverlay,
        m: DragMode
    ) => void;
    onSelect: () => void;
}) {
    const px = overlay.posX ?? 50;
    const py = overlay.posY ?? 50;
    const posterUrl = `${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.id}.webp`;

    return (
        <div
            className={`overlay-box ${isSelected ? "overlay-box--selected" : ""}`}
            style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                width: `${overlay.width}%`,
                height: `${overlay.height}%`,
                overflow: "hidden",
                background: "#000",
            }}
            onPointerDown={(e) => {
                onSelect();
                onStartInteraction(e, overlay, { type: "move" });
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <video
                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.filename}`}
                poster={posterUrl}
                muted
                preload="metadata"
                className="overlay-video-preview"
                onPointerDown={(e) => e.stopPropagation()}
                controls={false}
                playsInline
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${px}% ${py}%`,
                }}
            />

            <div className="overlay-label">
                {overlay.filename.replace(/^video-[a-f0-9]+\./, "")}
            </div>

            {isSelected && (
                <>
                    {(
                        ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const
                    ).map((handle) => (
                        <div
                            key={handle}
                            className={`resize-handle resize-handle--${handle}`}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onStartInteraction(e, overlay, {
                                    type: "resize",
                                    handle,
                                });
                            }}
                        />
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Video Properties Panel (unchanged from original) ─────────────────────────

function PropertiesPanel({
                             overlay,
                             presentationId,
                             totalPages,
                             onUpdate,
                             onSave,
                             onDelete,
                         }: {
    overlay: VideoOverlay;
    presentationId: string;
    totalPages: number;
    onUpdate: (patch: Partial<VideoOverlay>) => void;
    onSave: () => void;
    onDelete: () => void;
}) {
    const round = (n: number) => Math.round(n * 10) / 10;

    return (
        <div className="props-panel">
            <div className="props-section">
                <div className="props-section-label">Position</div>
                <div className="props-grid">
                    <PropInput
                        label="X %"
                        value={round(overlay.x)}
                        min={0}
                        max={100}
                        onChange={(v) => onUpdate({ x: v })}
                        onBlur={onSave}
                    />
                    <PropInput
                        label="Y %"
                        value={round(overlay.y)}
                        min={0}
                        max={100}
                        onChange={(v) => onUpdate({ y: v })}
                        onBlur={onSave}
                    />
                    <PropInput
                        label="W %"
                        value={round(overlay.width)}
                        min={5}
                        max={100}
                        onChange={(v) => onUpdate({ width: v })}
                        onBlur={onSave}
                    />
                    <PropInput
                        label="H %"
                        value={round(overlay.height)}
                        min={5}
                        max={100}
                        onChange={(v) => onUpdate({ height: v })}
                        onBlur={onSave}
                    />
                </div>
            </div>

            <div className="props-section">
                <div className="props-section-label">
                    Object Position (% from top/left)
                </div>
                <div className="props-grid">
                    <PropInput
                        label="X Pos"
                        value={overlay.posX ?? 50}
                        min={0}
                        max={100}
                        onChange={(v) => onUpdate({ posX: v })}
                        onBlur={onSave}
                    />
                    <PropInput
                        label="Y Pos"
                        value={overlay.posY ?? 50}
                        min={0}
                        max={100}
                        onChange={(v) => onUpdate({ posY: v })}
                        onBlur={onSave}
                    />
                </div>
            </div>

            <div className="props-section">
                <div className="props-section-label">Slide</div>
                <select
                    className="props-select"
                    value={overlay.slideNumber}
                    onChange={(e) => {
                        onUpdate({ slideNumber: parseInt(e.target.value) });
                        onSave();
                    }}
                >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                            Slide {n}
                        </option>
                    ))}
                </select>
            </div>

            <div className="props-section">
                <div className="props-section-label">Playback</div>
                <div className="props-toggles">
                    <PropToggle
                        label="Autoplay"
                        value={overlay.autoplay}
                        onChange={(v) => {
                            onUpdate({ autoplay: v });
                            onSave();
                        }}
                    />
                    <PropToggle
                        label="Loop"
                        value={overlay.loop}
                        onChange={(v) => {
                            onUpdate({ loop: v });
                            onSave();
                        }}
                    />
                    <PropToggle
                        label="Muted"
                        value={overlay.muted}
                        onChange={(v) => {
                            onUpdate({ muted: v });
                            onSave();
                        }}
                    />
                </div>
            </div>

            <div className="props-section">
                <div className="props-section-label">Preview</div>
                <video
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.filename}`}
                    poster={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/videos/${overlay.id}.webp`}
                    controls
                    muted={overlay.muted}
                    loop={overlay.loop}
                    className="props-video-preview"
                    playsInline
                    preload="metadata"
                />
            </div>

            <button className="btn btn--danger" onClick={onDelete}>
                Delete overlay
            </button>
        </div>
    );
}

function PropInput({
                       label,
                       value,
                       min,
                       max,
                       onChange,
                       onBlur,
                   }: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
    onBlur: () => void;
}) {
    return (
        <label className="prop-input-wrap">
            <span className="prop-label">{label}</span>
            <input
                type="number"
                className="prop-input"
                value={value}
                min={min}
                max={max}
                step={0.1}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
                }}
                onBlur={onBlur}
            />
        </label>
    );
}

function PropToggle({
                        label,
                        value,
                        onChange,
                    }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="prop-toggle">
            <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span>{label}</span>
        </label>
    );
}