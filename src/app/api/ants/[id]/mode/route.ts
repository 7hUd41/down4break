import { NextResponse } from "next/server";
import { setSessionMode } from "@/lib/store";
import type { SessionMode } from "@/lib/types";

const VALID: ReadonlySet<SessionMode> = new Set(["focus", "open", "dnd"]);

// POST /api/ants/[id]/mode — body { mode: SessionMode }
// Met à jour le mode social (focus / open / dnd). Validation stricte côté serveur
// pour ne pas accepter de valeur arbitraire venant du client.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "");
  if (!VALID.has(mode as SessionMode)) {
    return NextResponse.json({ error: "bad_mode" }, { status: 400 });
  }
  const ant = setSessionMode(id, mode as SessionMode);
  if (!ant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ant });
}
