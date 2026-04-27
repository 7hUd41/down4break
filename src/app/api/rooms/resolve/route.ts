import { NextResponse } from "next/server";
import { resolveRoom } from "@/lib/store";

// POST /api/rooms/resolve
// body: { input: string }  (un code 4 chars OU un nom humain)
// resp: { room, created }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as { input?: unknown }));
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) {
      return NextResponse.json({ error: "input_required" }, { status: 400 });
    }
    if (input.length > 60) {
      return NextResponse.json({ error: "input_too_long" }, { status: 400 });
    }
    const { room, created } = resolveRoom(input);
    return NextResponse.json({ room, created });
  } catch (e) {
    // Log côté serveur pour pouvoir débugger si ça repète, et renvoie un JSON
    // au client (le client fait .text() sur les erreurs et l'affiche).
    console.error("[/api/rooms/resolve] crash:", e);
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", message }, { status: 500 });
  }
}
