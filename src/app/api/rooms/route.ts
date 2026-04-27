import { NextResponse } from "next/server";
import { createRoom } from "@/lib/store";

// POST /api/rooms -> crée une nouvelle room avec code aléatoire
export async function POST() {
  const room = createRoom();
  return NextResponse.json({ room });
}
