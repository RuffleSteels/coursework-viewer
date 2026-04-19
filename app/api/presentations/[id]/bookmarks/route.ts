import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { updatePresentationMeta, getPresentationMeta } from "@/app/lib/pdf-processor";
import { authOptions } from "@/app/lib/auth";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { bookmarks } = await req.json();

  const updatedMeta = updatePresentationMeta(id, { bookmarks });

  if (!updatedMeta) {
    return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  }

  return NextResponse.json(updatedMeta);
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const meta = getPresentationMeta(id);
    if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(meta.bookmarks || []);
}
