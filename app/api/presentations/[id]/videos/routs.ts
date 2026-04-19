import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import {
    getVideoOverlays,
    saveVideoOverlays,
    type VideoOverlay,
} from "@/app/lib/video-overlays";

export const maxDuration = 60;

// GET — return all overlays for this presentation
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return NextResponse.json(getVideoOverlays(id), {
        headers: { "Cache-Control": "no-store" },
    });
}

// POST — upload a new video file, create a default overlay entry
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const slideNumber = parseInt((formData.get("slideNumber") as string) ?? "1") || 1;

    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 200 MB limit
    if (file.size > 200 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 200MB)" }, { status: 413 });
    }

    const videoDir = path.join(process.cwd(), "public", "slides", id, "videos");
    fs.mkdirSync(videoDir, { recursive: true });

    const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
    const videoId = `video-${randomBytes(3).toString("hex")}`;
    const filename = `${videoId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(videoDir, filename), buffer);

    const newOverlay: VideoOverlay = {
        id: videoId,
        filename,
        slideNumber,
        x: 25,
        y: 25,
        width: 50,
        height: 50,
        autoplay: false,
        loop: false,
        muted: true,
    };

    const overlays = getVideoOverlays(id);
    overlays.push(newOverlay);
    saveVideoOverlays(id, overlays);

    return NextResponse.json({ success: true, overlay: newOverlay });
}

// PATCH — save updated overlay positions/settings (full replace)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const overlays: VideoOverlay[] = await req.json();
    saveVideoOverlays(id, overlays);
    return NextResponse.json({ success: true });
}

// DELETE — remove a video overlay (and its file)
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { videoId } = await req.json();

    const overlays = getVideoOverlays(id);
    const target = overlays.find((o) => o.id === videoId);

    if (target) {
        const filePath = path.join(
            process.cwd(), "public", "slides", id, "videos", target.filename
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    saveVideoOverlays(id, overlays.filter((o) => o.id !== videoId));
    return NextResponse.json({ success: true });
}