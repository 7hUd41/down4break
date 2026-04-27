import { NextResponse } from "next/server";
import { applyAction } from "@/lib/store";

const VALID = new Set(["start", "pause", "resume", "skip", "reset"]);

// POST /api/ants/[id]/action — body { action }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!VALID.has(action)) {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }
  const ant = applyAction(id, action as "start" | "pause" | "resume" | "skip" | "reset");
  if (!ant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ant });
}
