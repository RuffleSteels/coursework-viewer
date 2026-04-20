"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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

export function SlideViewer({
                                presentationId,
                                totalPages,
                                aspectRatio,
                                title,
                                isPublic: initialIsPublic = false,
                            }: SlideViewerProps) {
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === 'admin';
    
    const [currentPage, setCurrentPage] = useState(1);
    const [videoOverlays, setVideoOverlays] = useState<VideoOverlay[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
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
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const mouseTimer = useRef<NodeJS.Timeout | null>(null);

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

    // Initial check for public access and stored password
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
                if (success) {
                    setIsCheckingAuth(false);
                    return;
                }
            }
            setIsCheckingAuth(false);
        };
        
        checkAccess();
    }, [isAdmin, isPublic, presentationId, verifyPassword]);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/videos`, { cache: "no-store" })
            .then((r) => r.json())
            .then((data: VideoOverlay[]) => setVideoOverlays(data))
            .catch(() => setVideoOverlays([]));
        
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/bookmarks`)
            .then((r) => r.json())
            .then((data: Bookmark[]) => setBookmarks(data))
            .catch(() => setBookmarks([]));
    }, [presentationId]);

    useEffect(() => {
        if (isAuthorized) {
            window.history.replaceState(null, "", `#${currentPage}`);
        }
    }, [currentPage, isAuthorized]);

    useEffect(() => {
        const hash = parseInt(window.location.hash.slice(1));
        if (hash >= 1 && hash <= totalPages) setCurrentPage(hash);
    }, [totalPages]);

    useEffect(() => {
        const activeThumb = sidebarRef.current?.querySelector('.slide-thumb-btn--active');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentPage]);

    const goTo = useCallback((page: number) => {
        setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    }, [totalPages]);

    const next = useCallback(() => goTo(currentPage + 1), [currentPage, goTo]);
    const prev = useCallback(() => goTo(currentPage - 1), [currentPage, goTo]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isAuthorized) return;
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
            else if (e.key === "f") { toggleFullscreen(); }
            else if (e.key === "g") { setShowGrid(prev => !prev); }
            else if (e.key === "Escape" && showGrid) { setShowGrid(false); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [next, prev, showGrid, isAuthorized]);

    const stageWrapRef = useRef<HTMLDivElement>(null);

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
            if (password === null) return; // cancelled
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
                    const url = window.location.href;
                    await navigator.clipboard.writeText(url);
                    alert("Presentation is now public! Password set. URL copied to clipboard.");
                } else {
                    alert("Presentation is now private.");
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSharing(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        const success = await verifyPassword(authPassword);
        if (!success) {
            setAuthError("Incorrect password");
        }
    };

    const saveBookmarks = async (newBookmarks: Bookmark[]) => {
        setBookmarks(newBookmarks);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookmarks: newBookmarks })
        });
    };

    const addBookmark = () => {
        const name = prompt("Enter bookmark name:");
        if (!name) return;
        const newBookmark: Bookmark = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            slide: currentPage,
            color: 'var(--accent)'
        };
        saveBookmarks([...bookmarks, newBookmark]);
    };

    const deleteBookmark = (id: string) => {
        saveBookmarks(bookmarks.filter(b => b.id !== id));
    };

    const updateBookmark = (id: string, patch: Partial<Bookmark>) => {
        saveBookmarks(bookmarks.map(b => b.id === id ? { ...b, ...patch } : b));
    };

    const handleSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const _bookmarks = [...bookmarks];
        const draggedItemContent = _bookmarks.splice(dragItem.current, 1)[0];
        _bookmarks.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        saveBookmarks(_bookmarks);
    };

    if (isCheckingAuth) {
        return (
            <div className="editor-loading">
                <div className="spinner" />
                <p>Verifying access…</p>
            </div>
        );
    }

    if (!isAuthorized && isPublic) {
        return (
            <div className="password-gate" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100vh', gap: '20px', background: 'var(--bg)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ marginBottom: '8px' }}>{title}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>This presentation is password protected.</p>
                </div>
                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px' }}>
                    <input
                        type="password"
                        className="title-field"
                        style={{ width: '100%' }}
                        placeholder="Enter password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        autoFocus
                    />
                    {authError && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{authError}</p>}
                    <button type="submit" className="btn btn--accent">View Presentation</button>
                </form>
            </div>
        );
    }

    const slideUrl = (page: number) => `/slides/${presentationId}/slide-${String(page).padStart(4, "0")}.webp`;

    return (
        <div className="editor-shell" style={{ height: isAdmin ?  'calc(100dvh - 64px)' : '100dvh' }}>
            <div className="editor-body viewer-body-v2">
                <aside className="editor-slides" ref={sidebarRef}>
                    <div className="editor-slides-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Slides</span>
                        <button className="btn" onClick={() => setShowGrid(!showGrid)} title="Grid View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </button>
                    </div>
                    <div className="editor-slides-list">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                            <button key={n} className={`slide-thumb-btn ${n === currentPage ? "slide-thumb-btn--active" : ""}`} onClick={() => goTo(n)}>
                                <div className="slide-thumb-img" style={{ aspectRatio: aspectRatio }}>
                                    <Image src={`/slides/${presentationId}/thumb-${String(n).padStart(4, "0")}.webp`} alt={`Slide ${n}`} fill style={{ objectFit: 'cover' }} />
                                </div>
                                <span className="slide-thumb-num">{n}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="editor-main">
                    {/* Bookmarks Overlay */}
                    {bookmarks.length > 0 && (
                        <div className="bookmarks-bar" style={{
                            position: 'absolute', top: '20px', left: '20px', zIndex: 100,
                            display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '80%'
                        }}>
                            {bookmarks.map(b => (
                                <button
                                    key={b.id}
                                    className="btn"
                                    onClick={() => goTo(b.slide)}
                                    style={{
                                        background: b.color, color: '#fff', border: 'none',
                                        fontSize: '11px', fontWeight: 'bold', padding: '4px 12px',
                                        borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                        opacity: 0.9, transition: 'transform 0.1s'
                                    }}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {b.name}
                                </button>
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
                                    <button key={n} className={`slide-thumb-btn ${n === currentPage ? "slide-thumb-btn--active" : ""}`} onClick={() => { goTo(n); setShowGrid(false); }} style={{ width: '100%', border: 'none', background: 'none', padding: 0 }}>
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: aspectRatio, overflow: 'hidden', borderRadius: '4px', border: n === currentPage ? '2px solid var(--accent)' : '2px solid transparent', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                            <img src={`/slides/${presentationId}/thumb-${String(n).padStart(4, "0")}.webp`} alt={`Slide ${n}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: 'block' }} />
                                            <span className="thumb-num" style={{ right: '8px', bottom: '8px', position: 'absolute', color: 'white', fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{n}</span>
                                        </div>
                                        <span className="slide-thumb-num" style={{ display: 'block', marginTop: '4px', textAlign: 'center', fontSize: '10px' }}>{n}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="editor-stage-wrap">
                        {/*<div style={{ flex: 1 }} />*/}
                        <div className="fullscreen-container" ref={stageWrapRef}>
                            {isFullscreen && mouseMoving && (
                                <button onClick={toggleFullscreen} style={{
                                    position: 'absolute', top: '20px', right: '20px', zIndex: 100,
                                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
                                    width: '40px', height: '40px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '20px', color: '#fff', cursor: 'pointer'
                                }}>×</button>
                            )}
                        <div className="ratio-stage" style={{ "--aspect": aspectRatio } as React.CSSProperties}>

                            <div className="slide-frame">
                                <Image key={currentPage} src={slideUrl(currentPage)} alt={`Slide ${currentPage}`} fill priority sizes="90vw" className="slide-img-full" draggable={false} />
                                <VideoLayer overlays={videoOverlays} currentPage={currentPage} presentationId={presentationId} />
                            </div>
                            <button className="click-zone click-zone--prev" onClick={prev} disabled={currentPage === 1} />
                            <button className="click-zone click-zone--next" onClick={next} disabled={currentPage === totalPages} />
                        </div>
                        </div>

                        {/*<div style={{ flex: 1 }} />*/}
                    </div>

                    <div className="controls" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', justifyContent: 'center', padding: '10px', flexShrink: 0 }}>
                        <button className="ctrl-btn" onClick={prev} disabled={currentPage === 1}>←</button>
                        <div className="page-counter">
                            <input type="number" className="page-input" value={currentPage} min={1} max={totalPages} onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) goTo(v); }} />
                            <span className="page-total">/ {totalPages}</span>
                        </div>
                        <button className="ctrl-btn" onClick={next} disabled={currentPage === totalPages}>→</button>
                        <button className="ctrl-btn ctrl-btn--fullscreen" onClick={toggleFullscreen}>{isFullscreen ? "⤡" : "⤢"}</button>
                        
                        {isAdmin && (
                            <>
                                <button 
                                    className={`ctrl-btn ${showBookmarksEditor ? 'btn--accent' : ''}`}
                                    onClick={() => setShowBookmarksEditor(!showBookmarksEditor)}
                                    style={{ marginLeft: '12px', fontSize: '11px', width: 'auto', padding: '0 10px' }}
                                >
                                    Bookmarks
                                </button>
                                <button 
                                    className={`ctrl-btn ${isPublic ? 'btn--accent' : ''}`} 
                                    onClick={toggleShare} 
                                    disabled={isSharing}
                                    style={{ marginLeft: '12px', fontSize: '11px', width: 'auto', padding: '0 10px' }}
                                >
                                    {isSharing ? "..." : (isPublic ? "Shared ✓" : "Share")}
                                </button>
                                <Link href={`/edit/${presentationId}?page=${currentPage}`} className="ctrl-btn" style={{ marginLeft: '12px', fontSize: '11px', width: 'auto', padding: '0 10px' }}>Edit slide</Link>
                            </>
                        )}
                    </div>

                    {isAdmin && showBookmarksEditor && (
                        <div className="bookmarks-editor" style={{
                            position: 'absolute', bottom: '64px', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '16px', width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 1000
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 'bold' }}>Bookmarks</span>
                                <button className="btn btn--accent" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={addBookmark}>+ Add Current</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {bookmarks.map((b, index) => (
                                    <div
                                        key={b.id}
                                        draggable
                                        onDragStart={() => (dragItem.current = index)}
                                        onDragEnter={() => (dragOverItem.current = index)}
                                        onDragEnd={handleSort}
                                        onDragOver={(e) => e.preventDefault()}
                                        style={{ cursor: 'move', display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}
                                    >
                                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginRight: '4px' }}>⋮⋮</div>
                                        <input
                                            type="text"
                                            value={b.name}
                                            onChange={(e) => updateBookmark(b.id, { name: e.target.value })}
                                            style={{ color: 'var(--text)', flex: 1, background: 'none', border: '1px solid var(--border)', fontSize: '12px', padding: '4px' }}
                                        />
                                        <select
                                            value={b.color}
                                            onChange={(e) => updateBookmark(b.id, { color: e.target.value })}
                                            style={{ color: 'var(--text)', background: 'none', border: '1px solid var(--border)', fontSize: '12px', padding: '4px' }}
                                        >
                                            {BOOKMARK_COLORS.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
                                        </select>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '40px' }}>p.{b.slide}</span>
                                        <button className="btn btn--danger" style={{ padding: '4px' }} onClick={() => deleteBookmark(b.id)}>×</button>
                                    </div>
                                ))}
                                {bookmarks.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No bookmarks yet</p>}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}