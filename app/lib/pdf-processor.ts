/**
 * PDF Processing Utility
 * SERVER ONLY — never imported by client components
 *
 * Runs SERVER-SIDE ONLY at upload/build time.
 * - Renders pages to PNG via Ghostscript (CLI) — zero browser deps
 * - Converts PNGs to WebP via sharp
 * - Writes everything to /public/slides/<presentationId>/
 */

import "server-only";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export interface Bookmark {
    id: string;
    name: string;
    slide: number;
    color: string;
}

export interface PresentationMeta {
    id: string;
    title: string;
    totalPages: number;
    aspectRatio: number;
    createdAt: string;
    isPublic?: boolean;
    password?: string;
    bookmarks?: Bookmark[];
}

const RENDER_DPI = 300; // Increased to 300dpi for high-res retina displays
const SOURCE_WEBP_QUALITY = 100; // Original high-res source quality
const THUMB_WIDTH = 400; // px width for thumbnails

// ── Ghostscript: render all pages to PNG files ────────────────────────────────

async function renderPdfToImages(
    pdfPath: string,
    outputDir: string
): Promise<string[]> {
    const outputPattern = path.join(outputDir, "slide-%04d.png");

    // Try `gs` (Linux/Mac homebrew), fall back to `gswin64c` (Windows)
    const gsBin = process.platform === "win32" ? "gswin64c" : "gs";

    await execFileAsync(gsBin, [
        "-dBATCH",
        "-dNOPAUSE",
        "-dNOSAFER",
        "-dQUIET",
        "-sDEVICE=png16m",          // 24-bit PNG
        `-r${RENDER_DPI}`,
        "-dTextAlphaBits=4",        // anti-aliased text
        "-dGraphicsAlphaBits=4",    // anti-aliased graphics
        `-sOutputFile=${outputPattern}`,
        pdfPath,
    ]);

    // Return sorted list of generated PNGs
    return fs
        .readdirSync(outputDir)
        .filter((f) => f.startsWith("slide-") && f.endsWith(".png"))
        .sort()
        .map((f) => path.join(outputDir, f));
}

export async function processPdf(
    pdfBuffer: Buffer,
    presentationId: string,
    title: string
): Promise<PresentationMeta> {
    const outputDir = path.join(process.cwd(), "public", "slides", presentationId);
    fs.mkdirSync(outputDir, { recursive: true });

    // ── Step 1: render pages via Ghostscript ──
    const tmpPdf = path.join(outputDir, "_input.pdf");
    fs.writeFileSync(tmpPdf, pdfBuffer);

    console.log(`  Rendering pages via Ghostscript at ${RENDER_DPI} DPI…`);
    let pngFiles: string[];
    try {
        pngFiles = await renderPdfToImages(tmpPdf, outputDir);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT") || msg.includes("not found")) {
            throw new Error(
                "Ghostscript not found. Install it with: brew install ghostscript  (or apt-get install ghostscript)"
            );
        }
        throw err;
    }

    const totalPages = pngFiles.length;
    if (totalPages === 0) throw new Error("Ghostscript produced no pages");

    const firstMeta = await sharp(pngFiles[0]).metadata();
    const aspectRatio = (firstMeta.width ?? 16) / (firstMeta.height ?? 9);

    // ── Step 2: convert to WebP ──
    console.log(`  Converting ${totalPages} pages to WebP…`);

    for (let i = 0; i < pngFiles.length; i++) {
        const pageNum = i + 1;
        const pngPath = pngFiles[i];

        const padNum = String(pageNum).padStart(4, "0");
        const sourcePath = path.join(outputDir, `source-${padNum}.webp`);
        const slidePath = path.join(outputDir, `slide-${padNum}.webp`);
        const thumbPath = path.join(outputDir, `thumb-${padNum}.webp`);
        
        const sharpInstance = sharp(pngPath);
        
        // 1. Save "Source" WebP at Quality 100
        await sharpInstance.clone()
            .webp({ quality: SOURCE_WEBP_QUALITY, effort: 6 })
            .toFile(sourcePath);

        // 2. Save "Slide" WebP (initially the same as source)
        fs.copyFileSync(sourcePath, slidePath);
        
        // 3. Save thumbnail
        await sharpInstance.clone()
            .resize(THUMB_WIDTH)
            .webp({ quality: 75 })
            .toFile(thumbPath);

        // Delete temporary PNG
        fs.unlinkSync(pngPath);

        console.log(`  Page ${pageNum}/${totalPages}`);
    }

    fs.unlinkSync(tmpPdf);

    const meta: PresentationMeta = {
        id: presentationId,
        title,
        totalPages,
        aspectRatio,
        createdAt: new Date().toISOString(),
        isPublic: false,
        bookmarks: []
    };
    fs.writeFileSync(path.join(outputDir, "meta.json"), JSON.stringify(meta));

    return meta;
}

export function updatePresentationMeta(presentationId: string, updates: Partial<PresentationMeta>): PresentationMeta | null {
    const p = path.join(
        process.cwd(), "public", "slides", presentationId, "meta.json"
    );
    if (!fs.existsSync(p)) return null;
    const current = JSON.parse(fs.readFileSync(p, "utf-8"));
    const updated = { ...current, ...updates };
    fs.writeFileSync(p, JSON.stringify(updated));
    return updated;
}

export function getPresentationMeta(presentationId: string): PresentationMeta | null {
    const p = path.join(
        process.cwd(), "public", "slides", presentationId, "meta.json"
    );
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function listPresentations(): PresentationMeta[] {
    const slidesDir = path.join(process.cwd(), "public", "slides");
    if (!fs.existsSync(slidesDir)) return [];
    return fs
        .readdirSync(slidesDir)
        .map((id) => getPresentationMeta(id))
        .filter((m): m is PresentationMeta => m !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}