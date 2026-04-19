/**
 * POST /api/upload
 *
 * Accepts a multipart form with a PDF file + optional title.
 * Processes it server-side (render pages → WebP, extract text layer).
 * Returns the presentation ID so the client can redirect to the viewer.
 *
 * This route intentionally has NO caching — it's a write operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { processPdf } from "@/app/lib/pdf-processor";
import { randomBytes } from "crypto";

// Next.js 15 App Router config: disable body parsing (we handle the stream)
export const config = {
    api: { bodyParser: false },
};

// Increase timeout for large PDFs — Vercel hobby: 60s, Pro: 300s
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const file = formData.get("file") as File | null;
        const title = (formData.get("title") as string) || "Untitled Presentation";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
        }

        // Max 100MB
        if (file.size > 200 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File too large (max 100MB)" },
                { status: 413 }
            );
        }

        const pdfBuffer = Buffer.from(await file.arrayBuffer());

        // Generate a short unique ID (8 chars is plenty for a personal tool)
        const presentationId = randomBytes(4).toString("hex");

        console.log(`Processing PDF: "${title}" → ${presentationId}`);
        const meta = await processPdf(pdfBuffer, presentationId, title);
        console.log(`Done: ${meta.totalPages} pages`);

        return NextResponse.json({
            success: true,
            presentationId,
            totalPages: meta.totalPages,
            title: meta.title,
        });
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json(
            { error: "Processing failed", detail: String(err) },
            { status: 500 }
        );
    }
}