import { getOrCreateRoom, getRoomState, subscribe } from "@/lib/store";
import type { RoomState } from "@/lib/types";

// GET /api/rooms/[code]/stream — Server-Sent Events
//
// Le client reçoit :
//   - un event initial avec l'état complet
//   - un event à chaque changement (join, action, etc.)
//   - un ping toutes les 20s pour garder la connexion ouverte
//
// On envoie aussi des "tick" périodiques (1s) parce que l'auto-progression
// des phases n'est calculée qu'à la lecture du store : sans tick, les pauses
// ne déclencheraient pas de notify et les autres clients verraient un compte
// à rebours figé à zéro avant de basculer brutalement.

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  getOrCreateRoom(code);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const pushState = (state: RoomState) => send("state", state);

      // 1. snapshot initial
      const initial = getRoomState(code);
      if (initial) pushState(initial);

      // 2. abonnement aux changements
      const unsub = subscribe(code, pushState);

      // 3. tick auto-progression (1s) + heartbeat SSE (20s)
      const tickInterval = setInterval(() => {
        const s = getRoomState(code);
        if (s) pushState(s);
      }, 1000);

      const pingInterval = setInterval(() => send("ping", { t: Date.now() }), 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(tickInterval);
        clearInterval(pingInterval);
        unsub();
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };

      // L'AbortSignal de la requête se déclenche quand le client ferme l'onglet.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
