"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VideoOverlay } from "@/app/lib/video-overlays";
import type { Bookmark } from "@/app/lib/pdf-processor";
import { VideoLayer } from "./VideoLayer";
import { useSession } from "next-auth/react";

interface SlideViewerProps {
    presentationId: string;
    totalPages: number;
    aspectRatio: number;
    title: string;
    isPublic?: boolean;
}

const BOOKMARK_COLORS = [
    { name: 'Accent', value: 'var(--accent)' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
];
interface BookmarkFolder {
    id: string;
    name: string;
    color: string;
    bookmarks: Bookmark[];
}
const ZOOMED_SCALE = 2;

export function SlideViewer({
                                presentationId,
                                totalPages,
                                aspectRatio,
                                title,
                                isPublic: initialIsPublic = false,
                            }: SlideViewerProps) {
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === 'admin';
    const [showBookmarkPills, setShowBookmarkPills] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [videoOverlays, setVideoOverlays] = useState<VideoOverlay[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [gridScale, setGridScale] = useState(150);
    const [mouseMoving, setMouseMoving] = useState(true);
    const [isPublic, setIsPublic] = useState(initialIsPublic);
    const [isSharing, setIsSharing] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authPassword, setAuthPassword] = useState("");
    const [authError, setAuthError] = useState("");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [showBookmarksEditor, setShowBookmarksEditor] = useState(false);
// Add these refs back at the top with your other refs:
    const dragFolder = useRef<number | null>(null);
    const dragOverFolder = useRef<number | null>(null);
    const dragBookmark = useRef<{ folderIdx: number; bookmarkIdx: number } | null>(null);
    const dragOverBookmark = useRef<{ folderIdx: number; bookmarkIdx: number } | null>(null);
    // Zoom state
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const lastTouchEnd = useRef<number>(0);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const isPanning = useRef(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const slideFrameRef = useRef<HTMLDivElement>(null);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const mouseTimer = useRef<NodeJS.Timeout | null>(null);
    const stageWrapRef = useRef<HTMLDivElement>(null);

    const slideUrl = (page: number) =>
        `${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/slide-${String(page).padStart(4, "0")}.webp`;
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    const resetZoom = useCallback(() => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    }, []);

    const verifyPassword = useCallback(async (password: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (res.ok) {
                localStorage.setItem(`folium_auth_${presentationId}`, password);
                setIsAuthorized(true);
                return true;
            } else {
                localStorage.removeItem(`folium_auth_${presentationId}`);
                return false;
            }
        } catch (e) {
            return false;
        }
    }, [presentationId]);

    useEffect(() => {
        const checkAccess = async () => {
            if (isAdmin || !isPublic) {
                setIsAuthorized(true);
                setIsCheckingAuth(false);
                return;
            }
            const storedPassword = localStorage.getItem(`folium_auth_${presentationId}`);
            if (storedPassword) {
                const success = await verifyPassword(storedPassword);
                if (success) { setIsCheckingAuth(false); return; }
            }
            setIsCheckingAuth(false);
        };
        checkAccess();
    }, [isAdmin, isPublic, presentationId, verifyPassword]);
// Add these handlers:
    const handleFolderDragEnd = () => {
        if (dragFolder.current === null || dragOverFolder.current === null) return;
        const updated = [...folders];
        const dragged = updated.splice(dragFolder.current, 1)[0];
        updated.splice(dragOverFolder.current, 0, dragged);
        dragFolder.current = null;
        dragOverFolder.current = null;
        saveFolders(updated);
    };

    const handleBookmarkDragEnd = (folderId: string) => {
        if (!dragBookmark.current || !dragOverBookmark.current) return;
        const { folderIdx: fromFolderIdx, bookmarkIdx: fromIdx } = dragBookmark.current;
        const { folderIdx: toFolderIdx, bookmarkIdx: toIdx } = dragOverBookmark.current;
        // Only reorder within same folder
        if (fromFolderIdx !== toFolderIdx) return;
        const updated = folders.map((f, fi) => {
            if (fi !== fromFolderIdx) return f;
            const bms = [...f.bookmarks];
            const dragged = bms.splice(fromIdx, 1)[0];
            bms.splice(toIdx, 0, dragged);
            return { ...f, bookmarks: bms };
        });
        dragBookmark.current = null;
        dragOverBookmark.current = null;
        saveFolders(updated);
    };
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/videos`, { cache: "no-store" })
            .then((r) => r.json())
            .then((data: VideoOverlay[]) => setVideoOverlays(data))
            .catch(() => setVideoOverlays([]));
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/bookmarks`)
            .then((r) => r.json())
            .then((data: BookmarkFolder[]) => setFolders(data))
            .catch(() => setFolders([]));

// save helper:



    }, [presentationId]);

    useEffect(() => {
        if (isAuthorized) window.history.replaceState(null, "", `#${currentPage}`);
    }, [currentPage, isAuthorized]);

    useEffect(() => {
        const hash = parseInt(window.location.hash.slice(1));
        if (hash >= 1 && hash <= totalPages) setCurrentPage(hash);
    }, [totalPages]);

    useEffect(() => {
        const activeThumb = sidebarRef.current?.querySelector('.slide-thumb-btn--active');
        if (!activeThumb) return;
        if (isMobile) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentPage, isMobile]);

    const goTo = useCallback((page: number) => {
        setCurrentPage(Math.max(1, Math.min(totalPages, page)));
        resetZoom();
    }, [totalPages, resetZoom]);

    const next = useCallback(() => goTo(currentPage + 1), [currentPage, goTo]);
    const prev = useCallback(() => goTo(currentPage - 1), [currentPage, goTo]);

    // Ctrl/Cmd + scroll to zoom
    useEffect(() => {
        const el = slideFrameRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();

            const rect = el.getBoundingClientRect();
            // Cursor offset from centre
            const offsetFromCenterX = e.clientX - (rect.left + rect.width / 2);
            const offsetFromCenterY = e.clientY - (rect.top + rect.height / 2);

            setZoom(prevZoom => {
                const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
                const newZoom = Math.min(8, Math.max(1, prevZoom * delta));
                const zoomDiff = newZoom - prevZoom;
                setPanX(px => px - offsetFromCenterX * zoomDiff);
                setPanY(py => py - offsetFromCenterY * zoomDiff);
                return newZoom;
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const handleSlideClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Ignore click events fired synthetically after a touch
        if (Date.now() - lastTouchEnd.current < 500) return;
        if (isPanning.current) return;

        const el = slideFrameRef.current;
        if (!el) return;

        if (zoom > 1) {
            resetZoom();
        } else {
            const rect = el.getBoundingClientRect();
            const offsetFromCenterX = e.clientX - (rect.left + rect.width / 2);
            const offsetFromCenterY = e.clientY - (rect.top + rect.height / 2);
            const newZoom = ZOOMED_SCALE;
            setPanX(-offsetFromCenterX * (newZoom - 1));
            setPanY(-offsetFromCenterY * (newZoom - 1));
            setZoom(newZoom);
        }
    }, [zoom, resetZoom]);

    // Pan while zoomed
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (zoom <= 1) return;
        isPanning.current = false;
        panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
        const onMove = (e: MouseEvent) => {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isPanning.current = true;
            setPanX(panStart.current.panX + dx);
            setPanY(panStart.current.panY + dy);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            // Reset isPanning flag after click handler fires
            setTimeout(() => { isPanning.current = false; }, 0);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [zoom, panX, panY]);
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (isMobile) return; // browser handles everything on mobile
        isPanning.current = false;
        lastPinchDist.current = null;
        if (e.touches.length === 1) {
            panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX, panY };
        }
    }, [isMobile, panX, panY]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (isMobile) {
            // Just handle tap to zoom in/out, browser handles pinch natively
            lastTouchEnd.current = Date.now();
            if (!isPanning.current && e.changedTouches.length === 1 && e.touches.length === 0) {
                if (zoom > 1) {
                    resetZoom();
                } else {
                    const el = slideFrameRef.current;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const offsetFromCenterX = e.changedTouches[0].clientX - (rect.left + rect.width / 2);
                    const offsetFromCenterY = e.changedTouches[0].clientY - (rect.top + rect.height / 2);
                    const newZoom = ZOOMED_SCALE;
                    setPanX(-offsetFromCenterX * (newZoom - 1));
                    setPanY(-offsetFromCenterY * (newZoom - 1));
                    setZoom(newZoom);
                }
            }
            return;
        }

        // Desktop touch end
        if (e.touches.length < 2) lastPinchDist.current = null;
        if (isPanning.current) {
            setPanX(panRef.current.x);
            setPanY(panRef.current.y);
            const inner = slideFrameRef.current?.firstElementChild as HTMLElement;
            if (inner) inner.style.transition = 'transform 0.2s ease';
        }
        if (!isPanning.current && e.changedTouches.length === 1 && e.touches.length === 0) {
            lastTouchEnd.current = Date.now();
            if (zoom > 1) {
                resetZoom();
            } else {
                const el = slideFrameRef.current;
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const offsetFromCenterX = e.changedTouches[0].clientX - (rect.left + rect.width / 2);
                const offsetFromCenterY = e.changedTouches[0].clientY - (rect.top + rect.height / 2);
                const newZoom = ZOOMED_SCALE;
                setPanX(-offsetFromCenterX * (newZoom - 1));
                setPanY(-offsetFromCenterY * (newZoom - 1));
                setZoom(newZoom);
            }
        }
        setTimeout(() => { isPanning.current = false; }, 0);
    }, [isMobile, zoom, resetZoom, panX, panY]);
    const lastPinchDist = useRef<number | null>(null);

    // Clamp pan so you can't drag the slide fully off screen
    useEffect(() => {
        if (zoom <= 1) { setPanX(0); setPanY(0); return; }
        const el = slideFrameRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        // With center origin, max pan in either direction is half the overflow
        const maxX = (width * (zoom - 1)) / 2;
        const maxY = (height * (zoom - 1)) / 2;
        setPanX(px => Math.min(maxX, Math.max(-maxX, px)));
        setPanY(py => Math.min(maxY, Math.max(-maxY, py)));
    }, [zoom, panX, panY]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isAuthorized) return;
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
            else if (e.key === "f") toggleFullscreen();
            else if (e.key === "g") setShowGrid(p => !p);
            else if (e.key === "Escape") { if (showGrid) setShowGrid(false); if (zoom > 1) resetZoom(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [next, prev, showGrid, isAuthorized, zoom, resetZoom]);

    const toggleFullscreen = () => {
        const el = stageWrapRef.current;
        if (!document.fullscreenElement) { el?.requestFullscreen(); setIsFullscreen(true); }
        else { document.exitFullscreen(); setIsFullscreen(false); }
    };

    useEffect(() => {
        const onFsc = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFsc);
        return () => document.removeEventListener("fullscreenchange", onFsc);
    }, []);

    useEffect(() => {
        const handleMove = () => {
            setMouseMoving(true);
            if (mouseTimer.current) clearTimeout(mouseTimer.current);
            mouseTimer.current = setTimeout(() => setMouseMoving(false), 3000);
        };
        window.addEventListener("mousemove", handleMove);
        return () => { window.removeEventListener("mousemove", handleMove); if (mouseTimer.current) clearTimeout(mouseTimer.current); };
    }, []);

    const toggleShare = async () => {
        let password = null;
        if (!isPublic) {
            password = prompt("Enter a password for this shared link:");
            if (password === null) return;
        }
        setIsSharing(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: !isPublic, password })
            });
            if (res.ok) {
                const data = await res.json();
                setIsPublic(data.isPublic);
                if (data.isPublic) {
                    await navigator.clipboard.writeText(window.location.href);
                    alert("Presentation is now public! Password set. URL copied to clipboard.");
                } else {
                    alert("Presentation is now private.");
                }
            }
        } catch (e) { console.error(e); }
        finally { setIsSharing(false); }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        const success = await verifyPassword(authPassword);
        if (!success) setAuthError("Incorrect password");
    };

    const saveFolders = async (newFolders: BookmarkFolder[]) => {
        setFolders(newFolders);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookmarks: newFolders })
        });
    };
    const addFolder = () => {
        const name = prompt("Folder name:");
        if (!name) return;
        const color = BOOKMARK_COLORS[folders.length % BOOKMARK_COLORS.length].value;
        saveFolders([...folders, { id: Math.random().toString(36).substr(2, 9), name, color, bookmarks: [] }]);
    };

    const deleteFolder = (folderId: string) => saveFolders(folders.filter(f => f.id !== folderId));

    const updateFolder = (folderId: string, patch: Partial<BookmarkFolder>) =>
        saveFolders(folders.map(f => f.id === folderId ? { ...f, ...patch } : f));

    const addBookmarkToFolder = (folderId: string) => {
        const name = prompt("Bookmark name:");
        if (!name) return;
        saveFolders(folders.map(f => f.id === folderId ? {
            ...f,
            bookmarks: [...f.bookmarks, {
                id: Math.random().toString(36).substr(2, 9),
                name,
                slide: currentPage,
                color: f.color
            }]
        } : f));
    };

    const deleteBookmarkFromFolder = (folderId: string, bookmarkId: string) =>
        saveFolders(folders.map(f => f.id === folderId ? {
            ...f, bookmarks: f.bookmarks.filter(b => b.id !== bookmarkId)
        } : f));

    const updateBookmarkInFolder = (folderId: string, bookmarkId: string, patch: Partial<Bookmark>) =>
        saveFolders(folders.map(f => f.id === folderId ? {
            ...f, bookmarks: f.bookmarks.map(b => b.id === bookmarkId ? { ...b, ...patch } : b)
        } : f));

    const toggleFolder = (folderId: string) => {
        setOpenFolderIds(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };
    if (isCheckingAuth) return (
        <div className="editor-loading"><div className="spinner" /><p>Verifying access…</p></div>
    );

    if (!isAuthorized && isPublic) return (
        <div className="password-gate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px', background: 'var(--bg)' }}>
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ marginBottom: '8px' }}>{title}</h1>
                <p style={{ color: 'var(--text-muted)' }}>This presentation is password protected.</p>
            </div>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px' }}>
                <input type="password" className="title-field" style={{ width: '100%' }} placeholder="Enter password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} autoFocus />
                {authError && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{authError}</p>}
                <button type="submit" className="btn btn--accent">View Presentation</button>
            </form>
        </div>
    );

    return (
        <div className="editor-shell" style={{ height: isAdmin ? 'calc(100dvh - 64px)' : '100dvh' }}>
            <div className="editor-body viewer-body-v2">
                <aside className="editor-slides" ref={sidebarRef}>
                    <div className="editor-slides-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Slides</span>
                        <button className="btn" onClick={() => setShowGrid(!showGrid)} title="Grid View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </button>
                    </div>
                    <div className="editor-slides-list">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                            <button key={n} className={`slide-thumb-btn ${n === currentPage ? "slide-thumb-btn--active" : ""}`} onClick={() => goTo(n)}>
                                <div className="slide-thumb-img" style={{ aspectRatio: aspectRatio }}>
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/thumb-${String(n).padStart(4, "0")}.webp`}
                                        alt={`Slide ${n}`} loading="lazy" decoding="async"
                                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                </div>
                                <span className="slide-thumb-num">{n}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="editor-main">
                    {showBookmarkPills && folders.length > 0 && (
                        <div className="bookmarks-bar" style={{
                            position: 'absolute', top: '20px', left: '20px', zIndex: 100,
                            display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '80%'
                        }}>
                            {folders.map(folder => (
                                <div key={folder.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {/* Folder pill */}
                                    <button
                                        className="btn"
                                        onClick={() => toggleFolder(folder.id)}
                                        style={{
                                            background: folder.color, color: '#fff', border: 'none',
                                            fontSize: '11px', fontWeight: 'bold', padding: '4px 12px',
                                            borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            alignSelf: 'flex-start', transition: 'transform 0.1s, opacity 0.1s',
                                            opacity: openFolderIds.has(folder.id) ? 1 : 0.85,
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                    <span style={{
                        display: 'inline-block',
                        transform: openFolderIds.has(folder.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        fontSize: '9px',
                    }}>▶</span>
                                        {folder.name}
                                        <span style={{ opacity: 0.7, fontSize: '10px' }}>({folder.bookmarks?.length})</span>
                                    </button>

                                    {/* Children pills */}
                                    {openFolderIds.has(folder.id) && folder.bookmarks?.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '12px' }}>
                                            {folder.bookmarks?.map(b => (
                                                <button
                                                    key={b.id}
                                                    className="btn"
                                                    onClick={() => goTo(b.slide)}
                                                    style={{
                                                        background: folder.color, color: '#fff', border: 'none',
                                                        fontSize: '11px', fontWeight: 'bold', padding: '4px 12px',
                                                        borderRadius: '20px', opacity: 0.75,
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                        transition: 'transform 0.1s, opacity 0.1s',
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
                                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    {b.name}
                                                    <span style={{ opacity: 0.6, fontSize: '9px', marginLeft: '4px' }}>p.{b.slide}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {showGrid && (
                        <div className="slide-grid-overlay" style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                            <div className="grid-toolbar" style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>All Slides</span>
                                <div style={{ flex: 1 }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scale:</span>
                                    <button className="btn" onClick={() => setGridScale(s => Math.max(80, s - 20))}>−</button>
                                    <button className="btn" onClick={() => setGridScale(s => Math.min(400, s + 20))}>+</button>
                                </div>
                                <button className="btn btn--accent" onClick={() => setShowGrid(false)}>Close Grid</button>
                            </div>
                            <div className="grid-content" style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${gridScale}px, 1fr))`, gap: '32px', alignContent: 'start' }}>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                                    <button key={n} className={`slide-thumb-btn ${n === currentPage ? "slide-thumb-btn--active" : ""}`}
                                            onClick={() => { goTo(n); setShowGrid(false); }}
                                            style={{ width: '100%', border: 'none', background: 'none', padding: 0 }}>
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: aspectRatio, overflow: 'hidden', borderRadius: '4px', border: n === currentPage ? '2px solid var(--accent)' : '2px solid transparent', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH}/slides/${presentationId}/thumb-${String(n).padStart(4, "0")}.webp`} alt={`Slide ${n}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: 'block' }} />
                                            <span className="thumb-num" style={{ right: '8px', bottom: '8px', position: 'absolute', color: 'white', fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{n}</span>
                                        </div>
                                        <span className="slide-thumb-num" style={{ display: 'block', marginTop: '4px', textAlign: 'center', fontSize: '10px' }}>{n}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="editor-stage-wrap">
                        <div className="fullscreen-container" ref={stageWrapRef}>
                            {isFullscreen && mouseMoving && (
                                <div style={{
                                    position: 'absolute', top: '16px', right: '16px', zIndex: 200,
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    {/* Bookmark toggle in fullscreen */}
                                    <button
                                        onClick={() => setShowBookmarkPills(p => !p)}
                                        title={showBookmarkPills ? "Hide bookmarks" : "Show bookmarks"}
                                        style={{
                                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                                            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', color: '#fff', cursor: 'pointer'
                                        }}
                                    >
                                        {showBookmarkPills ? (
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                            </svg>
                                        ) : (
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                            </svg>
                                        )}
                                    </button>
                                    {/* Exit fullscreen */}
                                    <button
                                        onClick={toggleFullscreen}
                                        title="Exit fullscreen"
                                        style={{
                                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                                            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', color: '#fff', cursor: 'pointer'
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="4 14 10 14 10 20" />
                                            <polyline points="20 10 14 10 14 4" />
                                            <line x1="10" y1="14" x2="3" y2="21" />
                                            <line x1="21" y1="3" x2="14" y2="10" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* Bookmarks bar — lives here so it's visible in fullscreen */}
                            {showBookmarkPills && folders.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '20px', left: '20px', zIndex: 100,
                                    display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '70%',
                                    pointerEvents: 'auto',
                                }}>
                                    {folders.map(folder => (
                                        <div key={folder.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <button
                                                className="btn"
                                                onClick={() => toggleFolder(folder.id)}
                                                style={{
                                                    background: folder.color, color: '#fff', border: 'none',
                                                    fontSize: '11px', fontWeight: 'bold', padding: '4px 12px',
                                                    borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    alignSelf: 'flex-start', transition: 'transform 0.1s, opacity 0.1s',
                                                    opacity: openFolderIds.has(folder.id) ? 1 : 0.85,
                                                }}
                                                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                        <span style={{
                            display: 'inline-block',
                            transform: openFolderIds.has(folder.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s', fontSize: '9px',
                        }}>▶</span>
                                                {folder.name}
                                                <span style={{ opacity: 0.7, fontSize: '10px' }}>({folder.bookmarks?.length})</span>
                                            </button>
                                            {openFolderIds.has(folder.id) && folder.bookmarks?.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '12px' }}>
                                                    {folder.bookmarks?.map(b => (
                                                        <button
                                                            key={b.id}
                                                            className="btn"
                                                            onClick={() => goTo(b.slide)}
                                                            style={{
                                                                background: folder.color, color: '#fff', border: 'none',
                                                                fontSize: '11px', fontWeight: 'bold', padding: '4px 12px',
                                                                borderRadius: '20px', opacity: 0.75,
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                                                transition: 'transform 0.1s, opacity 0.1s',
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
                                                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                        >
                                                            {b.name}
                                                            <span style={{ opacity: 0.6, fontSize: '9px', marginLeft: '4px' }}>p.{b.slide}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Zoom hint */}
                            {zoom > 1 && (
                                <div style={{
                                    position: 'absolute', top: '8px', right: '8px', zIndex: 50,
                                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                    color: '#fff', fontSize: '11px', padding: '4px 10px',
                                    borderRadius: '20px', pointerEvents: 'none',
                                    display: isMobile ? 'none' : 'block',
                                }}>
                                    {Math.round(zoom * 100)}% — click to reset
                                </div>
                            )}

                            <div className="ratio-stage" style={{ "--aspect": aspectRatio } as React.CSSProperties}>
                                <div
                                    ref={slideFrameRef}
                                    className="slide-frame"
                                    onClick={handleSlideClick}
                                    onMouseDown={handleMouseDown}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={handleTouchEnd}
                                    style={{
                                        cursor: zoom > 1 ? 'grab' : 'zoom-in',
                                        touchAction: isMobile ? 'auto' : 'none',
                                    }}
                                >
                                    <div style={{
                                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                                        transformOrigin: 'center center',
                                        transition: isPanning.current ? 'none' : 'transform 0.2s ease',
                                        width: '100%',
                                        height: '100%',
                                    }}>
                                        <img
                                            key={currentPage}
                                            src={slideUrl(currentPage)}
                                            alt={`Slide ${currentPage}`}
                                            className="slide-img-full"
                                            draggable={false}
                                            decoding="async"
                                            style={{ width: "100%", height: "auto", objectFit: "contain", display: "block", userSelect: 'none' }}
                                        />
                                        <VideoLayer overlays={videoOverlays} currentPage={currentPage} presentationId={presentationId} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="controls" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', justifyContent: 'center', padding: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="ctrl-btn" onClick={prev} disabled={currentPage === 1} title="Previous slide">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>

                        <div className="page-counter">
                            <input type="number" className="page-input" value={currentPage} min={1} max={totalPages}
                                   onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goTo(v); }} />
                            <span className="page-total">/ {totalPages}</span>
                        </div>

                        <button className="ctrl-btn" onClick={next} disabled={currentPage === totalPages} title="Next slide">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                        <button
                            className="ctrl-btn"
                            onClick={() => setShowBookmarkPills(p => !p)}
                            title={showBookmarkPills ? "Hide bookmarks" : "Show bookmarks"}
                        >
                            {showBookmarkPills ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                </svg>
                            ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                </svg>
                            )}
                        </button>
                        {
                            isMobile ? null : <button className="ctrl-btn" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                                {isFullscreen ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="4 14 10 14 10 20" />
                                        <polyline points="20 10 14 10 14 4" />
                                        <line x1="10" y1="14" x2="3" y2="21" />
                                        <line x1="21" y1="3" x2="14" y2="10" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 3 21 3 21 9" />
                                        <polyline points="9 21 3 21 3 15" />
                                        <line x1="21" y1="3" x2="14" y2="10" />
                                        <line x1="3" y1="21" x2="10" y2="14" />
                                    </svg>
                                )}
                            </button>
                        }


                        {/* Grid button — only visible on mobile, lives here next to fullscreen */}
                        {isMobile && (
                            <button className="ctrl-btn" onClick={() => setShowGrid(!showGrid)} title="Grid View">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                            </button>
                        )}

                        {isAdmin && (
                            <>
                                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                                <button className={`ctrl-btn ${showBookmarksEditor ? 'btn--accent' : ''}`} onClick={() => setShowBookmarksEditor(!showBookmarksEditor)} title="Bookmarks" style={{ width: 'auto', padding: '0 10px', fontSize: '11px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={showBookmarksEditor ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Bookmarks
                                </button>
                                <button className={`ctrl-btn ${isPublic ? 'btn--accent' : ''}`} onClick={toggleShare} disabled={isSharing} title="Share" style={{ width: 'auto', padding: '0 10px', fontSize: '11px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                    </svg>
                                    {isSharing ? "..." : (isPublic ? "Shared" : "Share")}
                                </button>
                                <Link href={`/edit/${presentationId}?page=${currentPage}`} className="ctrl-btn" style={{ width: 'auto', padding: '0 10px', fontSize: '11px', gap: '6px', display: 'flex', alignItems: 'center' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Edit slide
                                </Link>
                            </>
                        )}
                    </div>

                    {isAdmin && showBookmarksEditor && (
                        <div className="bookmarks-editor" style={{
                            position: 'absolute', bottom: '64px', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '16px', width: '460px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 1000,
                            display: 'flex', flexDirection: 'column', maxHeight: '420px',
                        }}>
                            {/* Fixed header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                                <span style={{ fontWeight: 'bold' }}>Bookmark Folders</span>
                                <button className="btn btn--accent" style={{ padding: '2px 10px', fontSize: '11px' }} onClick={addFolder}>+ New Folder</button>
                            </div>

                            {/* Scrollable folder list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                {folders.map((folder, folderIdx) => (
                                    <div
                                        key={folder.id}
                                        draggable
                                        onDragStart={() => { dragFolder.current = folderIdx; }}
                                        onDragEnter={() => { dragOverFolder.current = folderIdx; }}
                                        onDragEnd={handleFolderDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        style={{ minHeight:'200px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'scroll', background: 'rgba(255,255,255,0.02)' }}
                                    >
                                        {/* Folder header */}
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.04)' }}>
                                            {/* Drag handle */}
                                            <div style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'grab', flexShrink: 0 }}>⋮⋮</div>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: folder.color, flexShrink: 0 }} />
                                            <input
                                                type="text"
                                                value={folder.name}
                                                onChange={(e) => updateFolder(folder.id, { name: e.target.value })}
                                                style={{ color: 'var(--text)', flex: 1, background: 'none', border: '1px solid var(--border)', fontSize: '12px', padding: '4px', fontWeight: 'bold' }}
                                            />
                                            <select
                                                value={folder.color}
                                                onChange={(e) => updateFolder(folder.id, { color: e.target.value })}
                                                style={{ color: 'var(--text)', background: 'none', border: '1px solid var(--border)', fontSize: '12px', padding: '4px' }}
                                            >
                                                {BOOKMARK_COLORS.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
                                            </select>
                                            <button
                                                className="btn btn--accent"
                                                style={{ padding: '2px 6px', fontSize: '10px', whiteSpace: 'nowrap' }}
                                                onClick={() => addBookmarkToFolder(folder.id)}
                                            >+ Slide</button>
                                            <button className="btn btn--danger" style={{ padding: '4px' }} onClick={() => deleteFolder(folder.id)}>×</button>
                                        </div>

                                        {/* Bookmarks within folder */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: folder.bookmarks.length ? '8px' : '0' }}>
                                            {folder.bookmarks.map((b, bookmarkIdx) => (
                                                <div
                                                    key={b.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.stopPropagation(); // prevent folder drag from firing
                                                        dragBookmark.current = { folderIdx, bookmarkIdx };
                                                    }}
                                                    onDragEnter={(e) => {
                                                        e.stopPropagation();
                                                        dragOverBookmark.current = { folderIdx, bookmarkIdx };
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.stopPropagation();
                                                        handleBookmarkDragEnd(folder.id);
                                                    }}
                                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                    style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '8px', cursor: 'move' }}
                                                >
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', cursor: 'grab', flexShrink: 0 }}>⋮⋮</div>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: folder.color, flexShrink: 0 }} />
                                                    <input
                                                        type="text"
                                                        value={b.name}
                                                        onChange={(e) => updateBookmarkInFolder(folder.id, b.id, { name: e.target.value })}
                                                        style={{ color: 'var(--text)', flex: 1, background: 'none', border: '1px solid var(--border)', fontSize: '11px', padding: '3px' }}
                                                    />
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '36px' }}>p.{b.slide}</span>
                                                    <button className="btn btn--danger" style={{ padding: '2px 4px', fontSize: '10px' }} onClick={() => deleteBookmarkFromFolder(folder.id, b.id)}>×</button>
                                                </div>
                                            ))}
                                            {folder.bookmarks.length === 0 && (
                                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '8px 0' }}>No bookmarks — click + Slide to add current slide</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {folders.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No folders yet</p>}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}