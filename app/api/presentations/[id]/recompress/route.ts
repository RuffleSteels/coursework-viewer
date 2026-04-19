import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { getPresentationMeta } from "@/app/lib/pdf-processor";

export const maxDuration = 300; // Allow time for many slides

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
        
        // We look for source-XXXX.webp files (high-res WebP)
        const sourceFiles = fs.readdirSync(dir).filter(f => f.startsWith("source-") && f.endsWith(".webp"));

        if (sourceFiles.length === 0) {
            return NextResponse.json({ 
                error: "High-quality source files not found. Re-upload the PDF to generate new source files." 
            }, { status: 400 });
        }

        console.log(`Recompressing ${sourceFiles.length} slides for ${id} from source WebP at quality ${quality}...`);

        for (const file of sourceFiles) {
            const sourcePath = path.join(dir, file);
            const padNum = file.match(/source-(\d+)\.webp/)?.[1];
            if (!padNum) continue;

            const slidePath = path.join(dir, `slide-${padNum}.webp`);
            
            // Re-encode from the high-res source WebP to the target quality
            await sharp(sourcePath)
                .webp({ quality: Math.min(100, Math.max(1, quality)), effort: 6 })
                .toFile(slidePath + ".tmp");
            
            // Replace the active slide file
            if (fs.existsSync(slidePath)) fs.unlinkSync(slidePath);
            fs.renameSync(slidePath + ".tmp", slidePath);
        }

        return NextResponse.json({ success: true, count: sourceFiles.length });
    } catch (err) {
        console.error("Recompression error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}