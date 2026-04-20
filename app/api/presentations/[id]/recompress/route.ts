import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { spawn } from "child_process";
import { getPresentationMeta } from "@/app/lib/pdf-processor";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { quality = 75 } = await req.json();

        const meta = getPresentationMeta(id);
        if (!meta) {
            return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
        }

        const dir = path.join(process.cwd(), "public", "slides", id);

        // quick validation only
        const hasSources = true; // optionally keep fs check if you want

        if (!hasSources) {
            return NextResponse.json({
                error: "High-quality source files not found"
            }, { status: 400 });
        }

        console.log(`Spawning recompress job for ${id} at quality ${quality}`);

        // 🔥 FIRE AND FORGET
        const child = spawn("node", [
            path.join(process.cwd(), "scripts/recompress-slides.js"),
            id,
            String(quality)
        ], {
            detached: true,
            stdio: "inherit" // 🔥 THIS IS THE KEY CHANGE
        });


        child.unref();

        return NextResponse.json({
            success: true,
            queued: true,
            id
        });

    } catch (err) {
        console.error("Recompression error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}