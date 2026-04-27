import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/store";

// POST /api/ants/[id]/heartbeat
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ant = heartbeat(id);
  if (!ant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
