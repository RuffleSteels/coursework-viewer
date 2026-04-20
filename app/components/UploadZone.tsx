"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadState =
    | { status: "idle" }
    | { status: "dragging" }
    | { status: "uploading"; progress: string }
    | { status: "error"; message: string };

export function UploadZone() {
    const [state, setState] = useState<UploadState>({ status: "idle" });
    const [title, setTitle] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const upload = useCallback(
        async (file: File) => {
            if (!file.name.toLowerCase().endsWith(".pdf")) {
                setState({ status: "error", message: "Please upload a PDF file." });
                return;
            }
            if (file.size > 200 * 1024 * 1024) {
                setState({ status: "error", message: "File must be under 100MB." });
                return;
            }

            const presentationTitle =
                title || file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");

            setState({ status: "uploading", progress: "Uploading…" });

            const fd = new FormData();
            fd.append("file", file);
            fd.append("title", presentationTitle);

            try {
                setState({ status: "uploading", progress: "Processing pages… (this may take a minute for large PDFs)" });

                const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/upload`, { method: "POST", body: fd });
                const data = await res.json();

                if (!res.ok) {
                    setState({ status: "error", message: data.error || "Upload failed" });
                    return;
                }

                router.push(`${process.env.NEXT_PUBLIC_BASE_PATH}/view/${data.presentationId}`);
            } catch (err) {
                setState({ status: "error", message: String(err) });
            }
        },
        [title, router]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setState({ status: "idle" });
            const file = e.dataTransfer.files[0];
            if (file) upload(file);
        },
        [upload]
    );

    const isUploading = state.status === "uploading";

    return (
        <div className="upload-wrap">
            <div className="title-row">
                <input
                    type="text"
                    className="title-field"
                    placeholder="Presentation title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isUploading}
                />
            </div>

            <div
                className={`drop-zone ${state.status === "dragging" ? "drop-zone--active" : ""} ${isUploading ? "drop-zone--loading" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setState({ status: "dragging" }); }}
                onDragLeave={() => setState({ status: "idle" })}
                onDrop={onDrop}
                onClick={() => !isUploading && fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                aria-label="Upload PDF"
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(file);
                    }}
                />

                {isUploading ? (
                    <div className="upload-status">
                        <div className="spinner" />
                        <p>{(state as { status: "uploading"; progress: string }).progress}</p>
                        <p className="upload-hint">Don't close this tab</p>
                    </div>
                ) : (
                    <div className="upload-idle">
                        <div className="upload-icon">⬆</div>
                        <p className="upload-cta">Drop your PDF here</p>
                        <p className="upload-hint">or click to browse · max 100MB</p>
                    </div>
                )}
            </div>

            {state.status === "error" && (
                <div className="upload-error">
                    ⚠ {state.message}
                    <button onClick={() => setState({ status: "idle" })}>Dismiss</button>
                </div>
            )}
        </div>
    );
}