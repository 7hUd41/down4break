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

export async function createRoom(name?: string): Promise<Room> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name ?? null }),
  });
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

// Retire l'ant du store côté serveur. Best-effort : on ignore les erreurs
// (le pire qui arrive est qu'il reste visible 60s aux autres avant purge).
export async function leaveAnt(antId: string): Promise<void> {
  await fetch(`/api/ants/${encodeURIComponent(antId)}`, { method: "DELETE" });
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


// Résout un input du formulaire d'accueil :
//  - code 4 chars (existant ou pas) → get-or-create par code
//  - nom humain → recherche par nameKey ou création
export async function resolveRoom(input: string): Promise<{ room: Room; created: boolean }> {
  const res = await fetch("/api/rooms/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  return asJson<{ room: Room; created: boolean }>(res);
}

// Génère un code 4 chars dans l'alphabet du serveur (sans 0/O/1/I/L pour
// limiter les confusions à l'oral). Utilisé par le bouton "dice" du formulaire.
const ROOM_ALPHABET_CLIENT = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export function generateClientCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_ALPHABET_CLIENT[Math.floor(Math.random() * ROOM_ALPHABET_CLIENT.length)];
  }
  return code;
}

// Liste des rooms publiques (nommées + actives) pour le browser de la landing.
// Mappé sur le PublicRoomEntry du store, mais on garde le type local pour ne
// pas créer de dépendance vers le module serveur depuis du code client.
export interface PublicRoom {
  code: string;
  name: string;
  antCount: number;
  lastSeen: number;
}

export async function listPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch("/api/rooms", { cache: "no-store" });
  const { rooms } = await asJson<{ rooms: PublicRoom[] }>(res);
  return rooms;
}
