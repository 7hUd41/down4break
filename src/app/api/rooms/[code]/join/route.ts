import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/store";

// POST /api/rooms/[code]/join
// body: { name: string, focusMin?: number, breakMin?: number }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const focusMin = clampMin(body.focusMin, 90, 5, 240);
  const breakMin = clampMin(body.breakMin, 20, 1, 120);
  if (!name.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const ant = joinRoom({ name, roomCode: code, focusMin, breakMin });
  return NextResponse.json({ ant });
}

function clampMin(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
