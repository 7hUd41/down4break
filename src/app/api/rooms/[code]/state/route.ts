import { NextResponse } from "next/server";
import { getRoomState, getOrCreateRoom } from "@/lib/store";

// GET /api/rooms/[code]/state
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  // Auto-crée la room si elle n'existe pas (simplifie le flow "rejoindre via lien").
  getOrCreateRoom(code);
  const state = getRoomState(code);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
