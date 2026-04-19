import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const filePath = path.join(process.cwd(), "public", "slides", id, "text-layers.json");

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "text-layers.json not found", path: filePath });
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    // Return summary: how many pages, how many items per page, and first 3 items of page 1
    return NextResponse.json({
        totalPages: parsed.length,
        itemsPerPage: parsed.map((p: { pageNumber: number; items: unknown[] }) => ({
            page: p.pageNumber,
            itemCount: p.items.length,
        })),
        sampleItems: parsed[0]?.items?.slice(0, 5) ?? [],
        rawFileSize: raw.length,
    });
}