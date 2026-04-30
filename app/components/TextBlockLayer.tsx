"use client";

// app/components/TextBlockLayer.tsx
// Drop this inside the slide's inner <div> (the same one that holds VideoLayer).
// It renders collapsible text dropdowns positioned over the slide.

import { useState } from "react";
import type { TextBlock } from "@/app/lib/text-blocks";

interface Props {
    blocks: TextBlock[];
    currentPage: number;
}

export function TextBlockLayer({ blocks, currentPage }: Props) {
    const visible = blocks.filter((b) => b.slideNumber === currentPage);
    if (visible.length === 0) return null;

    return (
        <>
            {visible.map((block) => (
                <TextBlockPill key={block.id} block={block} />
            ))}
        </>
    );
}

function TextBlockPill({ block }: { block: TextBlock }) {
    const [open, setOpen] = useState(false);

    return (
        <div
            style={{
                position: "absolute",
                left: `${block.x}%`,
                top: `${block.y}%`,
                width: open ? `${block.width}%` : 'fit-content',
                maxWidth: `${block.width}%`,
                transition: 'width 0.2s ease',
                zIndex: 40,
                fontFamily: "'Ubuntu', sans-serif",
                userSelect: open ? "text" : "none",
            }}
        >
            {/* ── Title pill / trigger ── */}
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 70%, transparent)`,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: open ? "10px 10px 0 0" : "10px",
                    padding: "5px 12px",
                    color: "#fff",
                    fontSize: `${Math.max(10, block.fontSize * 0.7)}px`,
                    fontFamily: "'Ubuntu', sans-serif",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    width: open ? "100%" : "auto",
                    textAlign: "left",
                    transition: "background 0.15s",
                    letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${block.color ?? '#3b82f6'} 90%, transparent)`)}

                onMouseLeave={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${block.color ?? '#3b82f6'} 70%, transparent)`)}

            >
                {/* Arrow */}
                <span
                    style={{
                        display: "inline-block",
                        transform: open ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        fontSize: "9px",
                        opacity: 0.8,
                        flexShrink: 0,
                    }}
                >
                    ▶
                </span>
                <span style={{                         fontSize: `${block.fontSize * 1.2}px`,
                    overflow: "hidden", textOverflow: "ellipsis" }}>
                    {block.title}
                </span>
            </button>

            {/* ── Dropdown content ── */}
            {open && (
                <div
                    style={{
                        background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 35%, transparent)`,
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderTop: "none",
                        borderRadius: "0 0 10px 10px",
                        padding: "6px 8px 8px",
                        color: "rgba(255,255,255,0.92)",
                        fontSize: `${block.fontSize}px`,
                        fontFamily: "'Ubuntu', sans-serif",
                        fontWeight: 400,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        userSelect: "text",
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {block.content}
                </div>
            )}
        </div>
    );
}