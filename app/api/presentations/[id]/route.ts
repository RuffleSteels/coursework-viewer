import { NextRequest, NextResponse } from "next/server";
import { getPresentationMeta } from "@/app/lib/pdf-processor";
import * as fs from "fs";
import * as path from "path";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const meta = getPresentationMeta(id);

    if (!meta) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(meta, {
        headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const dir = path.join(process.cwd(), "public", "slides", id);

    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
}