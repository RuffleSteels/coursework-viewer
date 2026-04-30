"use client";

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION GUIDE — read this first, then copy what you need.
//
// 1. Save THIS file as:  app/components/EditorTextBlocks.tsx
//    (contains OverlayTextBox + TextBlockPropertiesPanel)
//
// 2. In your existing EditorContent (app/components/EditorPage.tsx):
//    a) Add the import at the top:
//       import { OverlayTextBox, TextBlockPropertiesPanel } from "./EditorTextBlocks";
//       import type { TextBlock } from "@/app/lib/text-blocks";
//
//    b) Add state + helpers (see SECTION A below)
//
//    c) In the stage JSX, after the {currentOverlays.map(...)} block, add
//       the text-block overlays (see SECTION B below)
//
//    d) In the right-panel <aside className="editor-props">, add the tab
//       switcher + TextBlockPropertiesPanel (see SECTION C below)
//
// 3. Add the Google Fonts link for Ubuntu to your layout/head:
//    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap" rel="stylesheet" />
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import type { TextBlock } from "@/app/lib/text-blocks";
import type { VideoOverlay } from "@/app/lib/video-overlays";

// ─── Types re-exported for convenience ───────────────────────────────────────
type DragMode =
    | { type: "move" }
    | { type: "resize"; handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" };

const MIN_SIZE_PCT = 8;

// ═════════════════════════════════════════════════════════════════════════════
// SECTION A — paste these lines inside EditorContent(), with your other state
// ═════════════════════════════════════════════════════════════════════════════
export function useTextBlocks(presentationId: string) {
    const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

    // Load
    const loadTextBlocks = useCallback(() => {
        fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/textblocks`
        )
            .then((r) => r.json())
            .then((data: TextBlock[]) => setTextBlocks(data))
            .catch(() => setTextBlocks([]));
    }, [presentationId]);

    // Save
    const saveTextBlocks = useCallback(
        async (updated: TextBlock[]) => {
            setTextBlocks(updated);
            await fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH}/api/presentations/${presentationId}/textblocks`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ textBlocks: updated }),
                }
            );
        },
        [presentationId]
    );

    const addTextBlock = useCallback(
        (slideNumber: number) => {
            const newBlock: TextBlock = {
                id: Math.random().toString(36).substr(2, 9),
                slideNumber,
                title: "Note",
                content: "Add your text here...",
                x: 2,
                y: 2,
                width: 28,
                fontSize: 13,
                color: '#3b82f6', // ← add this
            };
            const updated = [...textBlocks, newBlock];
            saveTextBlocks(updated);
            setSelectedTextId(newBlock.id);
        },
        [textBlocks, saveTextBlocks]
    );

    const updateTextBlock = useCallback(
        (id: string, patch: Partial<TextBlock>, autosave = false) => {
            setTextBlocks((prev) => {
                const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
                if (autosave) saveTextBlocks(next);
                return next;
            });
        },
        [saveTextBlocks]
    );

    const deleteTextBlock = useCallback(
        (id: string) => {
            const updated = textBlocks.filter((b) => b.id !== id);
            saveTextBlocks(updated);
            setSelectedTextId(null);
        },
        [textBlocks, saveTextBlocks]
    );

    return {
        textBlocks,
        setTextBlocks,
        selectedTextId,
        setSelectedTextId,
        loadTextBlocks,
        saveTextBlocks,
        addTextBlock,
        updateTextBlock,
        deleteTextBlock,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION B — drop inside your stage div, after the video overlay .map()
// ═════════════════════════════════════════════════════════════════════════════

export function OverlayTextBox({
                                   block,
                                   isSelected,
                                   onSelect,
                                   onStartInteraction,
                               }: {
    block: TextBlock;
    isSelected: boolean;
    onSelect: () => void;
    onStartInteraction: (
        e: React.PointerEvent,
        block: TextBlock,
        mode: DragMode
    ) => void;
}) {
    return (
        <div
            style={{
                position: "absolute",
                left: `${block.x}%`,
                top: `${block.y}%`,
                width: `${block.width}%`,
                zIndex: isSelected ? 35 : 30,
                fontFamily: "'Ubuntu', sans-serif",
                outline: isSelected
                    ? "2px solid var(--accent, #7c3aed)"
                    : "2px dashed rgba(255,255,255,0.35)",
                borderRadius: "10px",
                cursor: "move",
                boxSizing: "border-box",
            }}
            onPointerDown={(e) => {
                onSelect();
                onStartInteraction(e, block, { type: "move" });
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Title bar */}
            <div
                style={{
                    background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 70%, transparent)`,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: "10px 10px 0 0",
                    padding: "5px 12px",
                    color: "#fff",
                    fontSize: `${Math.max(10, block.fontSize * 1.2)}px`,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    letterSpacing: "0.02em",
                    pointerEvents: "none",
                }}
            >
                <span style={{ fontSize: "9px", opacity: 0.7 }}>▶</span>
                {block.title || <em style={{ opacity: 0.5 }}>Untitled</em>}
            </div>

            {/* Content preview */}
            <div
                style={{
                    background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 35%, transparent)`,
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: "8px 12px",
                    color: "rgba(255,255,255,0.75)",
                    fontSize: `${block.fontSize}px`,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    // maxHeight: "80px",
                    // overflow: "hidden",
                    pointerEvents: "none",
                }}
            >
                {block.content || <em style={{ opacity: 0.4 }}>No content</em>}
            </div>

            {/* Resize handles */}
            {isSelected &&
                (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map(
                    (handle) => (
                        <div
                            key={handle}
                            className={`resize-handle resize-handle--${handle}`}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onStartInteraction(e, block, {
                                    type: "resize",
                                    handle,
                                });
                            }}
                        />
                    )
                )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION C — the properties panel for a selected text block
// ═════════════════════════════════════════════════════════════════════════════
const BLOCK_COLORS = [
    { name: 'Accent', value: 'var(--accent)' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
];
export function TextBlockPropertiesPanel({
                                             block,
                                             totalPages,
                                             onUpdate,
                                             onSave,
                                             onDelete,
                                         }: {
    block: TextBlock;
    totalPages: number;
    onUpdate: (patch: Partial<TextBlock>, andSave?: boolean) => void;
    onSave: () => void;
    onDelete: () => void;
}) {
    const round = (n: number) => Math.round(n * 10) / 10;

    return (
        <div className="props-panel">
            {/* Title */}
            <div className="props-section">
                <div className="props-section-label">Label (shown when collapsed)</div>
                <input
                    type="text"
                    value={block.title}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    onBlur={onSave}
                    placeholder="e.g. Summary, Why this works…"
                    style={{
                        width: "100%",
                        background: "var(--surface, #1a1a1a)",
                        border: "1px solid var(--border, #333)",
                        color: "var(--text, #fff)",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        fontFamily: "'Ubuntu', sans-serif",
                        boxSizing: "border-box",
                    }}
                />
            </div>
            {/* Color — add this section after the Label section */}
            <div className="props-section">
                <div className="props-section-label">Colour</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {BLOCK_COLORS.map((c) => (
                        <button
                            key={c.value}
                            title={c.name}
                            onClick={() => onUpdate({ color: c.value }, true)}
                            style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: c.value,
                                border: block.color === c.value
                                    ? '3px solid var(--text)'
                                    : '2px solid transparent',
                                cursor: 'pointer',
                                flexShrink: 0,
                                outline: block.color === c.value ? '2px solid var(--accent)' : 'none',
                                outlineOffset: '2px',
                            }}
                        />
                    ))}
                </div>
            </div>
            {/* Content */}
            <div className="props-section">
                <div className="props-section-label">Content (shown when expanded)</div>
                <textarea
                    value={block.content}
                    onChange={(e) => onUpdate({ content: e.target.value })}
                    onBlur={onSave}
                    rows={5}
                    placeholder="Write your notes, summary, or explanation here…"
                    style={{
                        width: "100%",
                        background: "var(--surface, #1a1a1a)",
                        border: "1px solid var(--border, #333)",
                        color: "var(--text, #fff)",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "12px",
                        fontFamily: "'Ubuntu', sans-serif",
                        resize: "vertical",
                        lineHeight: 1.5,
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {/* Position */}
            <div className="props-section">
                <div className="props-section-label">Position</div>
                <div className="props-grid">
                    <TextPropInput
                        label="X %"
                        value={round(block.x)}
                        min={0}
                        max={95}
                        onChange={(v) => onUpdate({ x: v })}
                        onBlur={onSave}
                    />
                    <TextPropInput
                        label="Y %"
                        value={round(block.y)}
                        min={0}
                        max={95}
                        onChange={(v) => onUpdate({ y: v })}
                        onBlur={onSave}
                    />
                    <TextPropInput
                        label="Width %"
                        value={round(block.width)}
                        min={MIN_SIZE_PCT}
                        max={100}
                        onChange={(v) => onUpdate({ width: v })}
                        onBlur={onSave}
                    />
                    <TextPropInput
                        label="Font px"
                        value={block.fontSize}
                        min={8}
                        max={32}
                        onChange={(v) => onUpdate({ fontSize: v })}
                        onBlur={onSave}
                    />
                </div>
            </div>

            {/* Slide */}
            <div className="props-section">
                <div className="props-section-label">Slide</div>
                <select
                    className="props-select"
                    value={block.slideNumber}
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

            {/* Preview */}
            <div className="props-section">
                <div className="props-section-label">Preview (viewer appearance)</div>
                <div
                    style={{
                        fontFamily: "'Ubuntu', sans-serif",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.15)",
                    }}
                >
                    <div
                        style={{
                            background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 70%, transparent)`,
                            padding: "5px 12px",
                            color: "#fff",
                            fontSize: `${Math.max(10, block.fontSize * 0.7)}px`,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        <span style={{ fontSize: "9px" }}>▶</span>
                        {block.title || "Untitled"}
                    </div>
                    <div
                        style={{
                            background: `color-mix(in srgb, ${block.color ?? '#3b82f6'} 35%, transparent)`,
                            padding: "8px 12px",
                            color: "rgba(255,255,255,0.85)",
                            fontSize: `${block.fontSize}px`,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            maxHeight: "100px",
                            overflow: "hidden",
                        }}
                    >
                        {block.content || <em style={{ opacity: 0.4 }}>No content</em>}
                    </div>
                </div>
            </div>

            <button className="btn btn--danger" onClick={onDelete}>
                Delete text block
            </button>
        </div>
    );
}

function TextPropInput({
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
                    onChange(v)
                    // if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
                }}
                onBlur={onBlur}
            />
        </label>
    );
}