import { NextRequest, NextResponse } from "next/server";
import { getPresentationMeta } from "@/app/lib/pdf-processor";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { password } = await req.json();

  const meta = getPresentationMeta(id);

  if (!meta) {
    return NextResponse.json({ error: "Presentation not found" }, { status: 404 });
  }

  if (meta.password && meta.password === password) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}
