import { NextResponse } from "next/server";
import { leaveAnt } from "@/lib/store";

// DELETE /api/ants/[id] — retire l'ant de sa room.
// Utilisé par le bouton "changer de pseudo" du RoomView.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const ok = leaveAnt(id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/ants/[id]] crash:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
