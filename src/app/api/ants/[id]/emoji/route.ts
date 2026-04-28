import { NextResponse } from "next/server";
import { setEmoji } from "@/lib/store";

// POST /api/ants/[id]/emoji — body { emoji: string }
// Validation : la liste des emojis acceptables est définie côté serveur dans
// lib/emoji.ts (EMOJI_OPTIONS). Un emoji hors-liste renvoie 400.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const emoji = String(body.emoji ?? "");
  const ant = setEmoji(id, emoji);
  if (!ant) return NextResponse.json({ error: "bad_emoji_or_not_found" }, { status: 400 });
  return NextResponse.json({ ant });
}
