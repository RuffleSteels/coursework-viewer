import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import {
    getVideoOverlays,
    saveVideoOverlays,
    type VideoOverlay,
} from "@/app/lib/video-overlays";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
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

    if (file.size > 300 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 300MB)" }, { status: 413 });
    }

    const videoDir = path.join(process.cwd(), "public", "slides", id, "videos");
    fs.mkdirSync(videoDir, { recursive: true });

    const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
    const videoId = `video-${randomBytes(3).toString("hex")}`;
    const filename = `${videoId}.${ext}`;
    const filePath = path.join(videoDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Generate a poster/thumbnail for the video using ffmpeg
    const posterName = `${videoId}.webp`;
    const posterPath = path.join(videoDir, posterName);
    
    try {
        // Capture frame at 0.5s (or start)
        await execFileAsync("ffmpeg", [
            "-i", filePath,
            "-ss", "00:00:00.500",
            "-vframes", "1",
            "-q:v", "2",
            "-f", "image2",
            "-y",
            path.join(videoDir, `${videoId}.jpg`)
        ]);
        
        // Convert to webp and resize for faster loading
        await sharp(path.join(videoDir, `${videoId}.jpg`))
            .resize(800) // reasonable quality for posters
            .webp({ quality: 80 })
            .toFile(posterPath);
            
        fs.unlinkSync(path.join(videoDir, `${videoId}.jpg`));
    } catch (err) {
        console.warn("Could not generate video poster:", err);
    }

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
        const videoDir = path.join(process.cwd(), "public", "slides", id, "videos");
        const filePath = path.join(videoDir, target.filename);
        const posterPath = path.join(videoDir, `${target.id}.webp`);
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
    }

    saveVideoOverlays(id, overlays.filter((o) => o.id !== videoId));
    return NextResponse.json({ success: true });
}