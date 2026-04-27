import { NextResponse } from "next/server";
import { createRoom, listPublicRooms } from "@/lib/store";

// POST /api/rooms — body optionnel : { name?: string }
// Le code reste auto-généré ; le nom est juste un libellé humain pour la preview.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as { name?: unknown }));
  const name = typeof body.name === "string" ? body.name : undefined;
  const room = createRoom(name);
  return NextResponse.json({ room });
}

// GET /api/rooms — liste les rooms publiques (nommées + au moins 1 ant actif).
// Pas de cache : la liste change à chaque join/leave/heartbeat.
export async function GET() {
  const rooms = listPublicRooms();
  return NextResponse.json(
    { rooms },
    { headers: { "Cache-Control": "no-store" } },
  );
}
