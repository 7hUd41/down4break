import { randomUUID } from "node:crypto";
import type { Ant, Room, RoomState, AntStatus } from "./types";

// --- In-memory store -------------------------------------------------------
// Single-process Next.js dev/prod : une Map suffit. Pour passer en distribué
// ou en multi-instance, il suffira de réimplémenter cette interface (Postgres,
// Redis, Django DRF...) sans toucher aux routes API.
//
// On utilise globalThis pour survivre au HMR de Next.js en dev (chaque
// rebuild rejoue ce module ; sans ce trick on perdrait toutes les rooms).

interface StoreShape {
  rooms: Map<string, Room>;
  ants: Map<string, Ant>;            // id -> Ant
  antsByRoom: Map<string, Set<string>>; // roomCode -> ant ids
  // Bus pub/sub très simple pour notifier les SSE quand une room change.
  listeners: Map<string, Set<(state: RoomState) => void>>;
}

const g = globalThis as unknown as { __down4break_store?: StoreShape };

function getStore(): StoreShape {
  if (!g.__down4break_store) {
    g.__down4break_store = {
      rooms: new Map(),
      ants: new Map(),
      antsByRoom: new Map(),
      listeners: new Map(),
    };
  }
  return g.__down4break_store;
}

// --- Helpers ---------------------------------------------------------------

const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // sans 0/O/1/I/L : moins d'erreurs à l'oral.

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

function notify(roomCode: string) {
  const state = getRoomState(roomCode);
  if (!state) return;
  const listeners = getStore().listeners.get(roomCode);
  if (!listeners) return;
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {
      // ne casse jamais le store sur un listener qui throw
    }
  }
}

// --- Rooms -----------------------------------------------------------------

export function createRoom(): Room {
  const store = getStore();
  // Anti-collision : on retente quelques fois si le code existe déjà.
  let code = generateRoomCode();
  for (let i = 0; i < 5 && store.rooms.has(code); i++) {
    code = generateRoomCode();
  }
  const room: Room = { code, createdAt: Date.now() };
  store.rooms.set(code, room);
  store.antsByRoom.set(code, new Set());
  return room;
}

export function getOrCreateRoom(code: string): Room {
  const store = getStore();
  const upper = code.toUpperCase();
  const existing = store.rooms.get(upper);
  if (existing) return existing;
  const room: Room = { code: upper, createdAt: Date.now() };
  store.rooms.set(upper, room);
  store.antsByRoom.set(upper, new Set());
  return room;
}

export function getRoom(code: string): Room | undefined {
  return getStore().rooms.get(code.toUpperCase());
}

// --- Ants ------------------------------------------------------------------

interface JoinArgs {
  name: string;
  roomCode: string;
  focusMin?: number;
  breakMin?: number;
}

export function joinRoom({ name, roomCode, focusMin = 90, breakMin = 20 }: JoinArgs): Ant {
  const store = getStore();
  const room = getOrCreateRoom(roomCode);
  const now = Date.now();
  const ant: Ant = {
    id: randomUUID(),
    name: name.trim().slice(0, 32) || "anonyme",
    roomCode: room.code,
    focusMin,
    breakMin,
    status: "idle",
    currentPhaseStart: null,
    currentPhaseEnd: null,
    remainingMs: null,
    joinedAt: now,
    lastSeen: now,
  };
  store.ants.set(ant.id, ant);
  store.antsByRoom.get(room.code)!.add(ant.id);
  notify(room.code);
  return ant;
}

export function getAnt(id: string): Ant | undefined {
  return getStore().ants.get(id);
}

export function heartbeat(id: string): Ant | undefined {
  const ant = getStore().ants.get(id);
  if (!ant) return undefined;
  ant.lastSeen = Date.now();
  // Pas de notify ici : un heartbeat seul ne change pas l'état visible.
  return ant;
}

// --- Actions sur le timer --------------------------------------------------

type Action = "start" | "pause" | "resume" | "skip" | "reset";

export function applyAction(id: string, action: Action): Ant | undefined {
  const store = getStore();
  const ant = store.ants.get(id);
  if (!ant) return undefined;
  const now = Date.now();

  switch (action) {
    case "start": {
      // Démarre toujours sur un focus. Si déjà en cours, on ignore.
      if (ant.status === "focus" || ant.status === "break") break;
      ant.status = "focus";
      ant.currentPhaseStart = now;
      ant.currentPhaseEnd = now + ant.focusMin * 60_000;
      ant.remainingMs = null;
      break;
    }
    case "pause": {
      if (ant.status !== "focus" && ant.status !== "break") break;
      ant.remainingMs = Math.max(0, (ant.currentPhaseEnd ?? now) - now);
      // On garde le status précédent dans currentPhaseStart négatif ? Non, plus simple :
      // on stocke le status pré-pause via une convention sur currentPhaseStart.
      // On utilise un trick : le sign de currentPhaseStart distingue focus/break.
      // -> pour rester lisible, on stocke le status via un champ dédié en pause :
      ant.currentPhaseStart = ant.status === "focus" ? -1 : -2;
      ant.currentPhaseEnd = null;
      ant.status = "paused";
      break;
    }
    case "resume": {
      if (ant.status !== "paused" || ant.remainingMs == null) break;
      const previousWasFocus = ant.currentPhaseStart === -1;
      ant.status = previousWasFocus ? "focus" : "break";
      ant.currentPhaseStart = now;
      ant.currentPhaseEnd = now + ant.remainingMs;
      ant.remainingMs = null;
      break;
    }
    case "skip": {
      // Saute à la phase suivante (focus -> break, break -> focus).
      const next: AntStatus =
        ant.status === "focus" ? "break" :
        ant.status === "break" ? "focus" :
        "focus"; // si idle/paused on lance un focus
      const durMs = (next === "focus" ? ant.focusMin : ant.breakMin) * 60_000;
      ant.status = next;
      ant.currentPhaseStart = now;
      ant.currentPhaseEnd = now + durMs;
      ant.remainingMs = null;
      break;
    }
    case "reset": {
      ant.status = "idle";
      ant.currentPhaseStart = null;
      ant.currentPhaseEnd = null;
      ant.remainingMs = null;
      break;
    }
  }

  ant.lastSeen = now;
  notify(ant.roomCode);
  return ant;
}

// --- Auto-progression : focus -> break -> focus ---------------------------
// Quand on lit l'état d'une room, on fait avancer les ants qui ont fini leur
// phase. Évite d'avoir besoin d'un scheduler côté serveur.

function advancePhases(now: number) {
  const store = getStore();
  for (const ant of store.ants.values()) {
    if ((ant.status === "focus" || ant.status === "break") && ant.currentPhaseEnd && now >= ant.currentPhaseEnd) {
      const next: AntStatus = ant.status === "focus" ? "break" : "focus";
      const durMs = (next === "focus" ? ant.focusMin : ant.breakMin) * 60_000;
      ant.status = next;
      ant.currentPhaseStart = ant.currentPhaseEnd;
      ant.currentPhaseEnd = ant.currentPhaseEnd + durMs;
    }
  }
}

// --- Lecture de l'état d'une room ------------------------------------------

const STALE_MS = 60_000; // un ant qui n'a pas fait de heartbeat depuis 1 min disparaît.

export function getRoomState(code: string): RoomState | undefined {
  const store = getStore();
  const upper = code.toUpperCase();
  const room = store.rooms.get(upper);
  if (!room) return undefined;
  const now = Date.now();
  advancePhases(now);
  const antIds = store.antsByRoom.get(upper) ?? new Set();
  const ants: Ant[] = [];
  for (const id of antIds) {
    const ant = store.ants.get(id);
    if (!ant) continue;
    if (now - ant.lastSeen > STALE_MS) {
      // soft-remove : on cache au client mais on garde l'objet pour reconnect rapide
      continue;
    }
    ants.push(ant);
  }
  // tri stable par join time
  ants.sort((a, b) => a.joinedAt - b.joinedAt);
  return { room, ants, serverNow: now };
}

// --- Pub/sub pour SSE ------------------------------------------------------

export function subscribe(roomCode: string, fn: (state: RoomState) => void): () => void {
  const store = getStore();
  const upper = roomCode.toUpperCase();
  if (!store.listeners.has(upper)) store.listeners.set(upper, new Set());
  store.listeners.get(upper)!.add(fn);
  return () => {
    store.listeners.get(upper)?.delete(fn);
  };
}
