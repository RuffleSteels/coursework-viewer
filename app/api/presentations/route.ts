/**
 * GET /api/presentations
 *
 * Returns a list of all processed presentations (reads meta.json files).
 * Cached at CDN for 1 hour, stale-while-revalidate for 24h.
 */

import { NextResponse } from "next/server";
import { listPresentations } from "@/app/lib/pdf-processor";

export async function GET() {
    const presentations = listPresentations();
    return NextResponse.json(presentations, {
        headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}