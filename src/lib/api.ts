// Couche client — toute communication avec le backend passe ici.
// On la garde isolée pour pouvoir swap vers Django DRF plus tard sans
// toucher aux composants React.

import type { Ant, Room, RoomState } from "./types";

export type TimerAction = "start" | "pause" | "resume" | "skip" | "reset";

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function createRoom(): Promise<Room> {
  const res = await fetch("/api/rooms", { method: "POST" });
  const { room } = await asJson<{ room: Room }>(res);
  return room;
}

export async function joinRoom(
  code: string,
  args: { name: string; focusMin?: number; breakMin?: number }
): Promise<Ant> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const { ant } = await asJson<{ ant: Ant }>(res);
  return ant;
}

export async function fetchRoomState(code: string): Promise<RoomState> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/state`);
  return asJson<RoomState>(res);
}

export async function sendAction(antId: string, action: TimerAction): Promise<Ant> {
  const res = await fetch(`/api/ants/${encodeURIComponent(antId)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const { ant } = await asJson<{ ant: Ant }>(res);
  return ant;
}

export async function sendHeartbeat(antId: string): Promise<void> {
  await fetch(`/api/ants/${encodeURIComponent(antId)}/heartbeat`, { method: "POST" });
}

// Hook très simple pour s'abonner à la SSE d'une room.
// Renvoie un cleanup à appeler dans le return du useEffect.
export function subscribeRoom(
  code: string,
  onState: (s: RoomState) => void,
  onError?: (err: Event) => void
): () => void {
  const url = `/api/rooms/${encodeURIComponent(code)}/stream`;
  const es = new EventSource(url);
  es.addEventListener("state", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data);
      onState(data);
    } catch {
      /* ignore parse errors */
    }
  });
  if (onError) es.onerror = onError;
  return () => es.close();
}
