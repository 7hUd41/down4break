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
  // Index secondaire pour résoudre une room par son nom humain (lowercased + trimmed).
  // Permet à deux personnes qui tapent "team marketing" indépendamment de tomber
  // sur la même room, sans avoir à se passer le code 4 chars.
  roomsByName: Map<string, string>;  // nameKey -> code
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
      roomsByName: new Map(),
      ants: new Map(),
      antsByRoom: new Map(),
      listeners: new Map(),
    };
  }
  const store = g.__down4break_store;
  // Migration HMR-safe : quand on ajoute un champ au store entre deux saves
  // pendant `next dev`, l'objet en mémoire (préservé via globalThis pour
  // survivre au HMR) garde son ancienne shape. On initialise ici pour ne
  // pas crasher avec "Cannot read properties of undefined".
  // À chaque nouveau champ ajouté ci-dessus, ajouter la ligne défensive ici.
  if (!store.roomsByName) store.roomsByName = new Map();
  return store;
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

// Normalisation du nom pour le lookup : trim + lowercase + collapse whitespace.
// Pas de slug agressif (on garde les accents, espaces, etc.) — on veut juste
// que "Team Marketing" et "team  marketing" pointent au même endroit.
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Est-ce que l'input ressemble à un code (4 chars de notre alphabet) ?
const CODE_REGEX = new RegExp(`^[${ROOM_ALPHABET}]{4}$`, "i");
function isCodeShape(input: string): boolean {
  return CODE_REGEX.test(input.trim());
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

export function createRoom(name?: string): Room {
  const store = getStore();
  // Anti-collision : on retente quelques fois si le code existe déjà.
  let code = generateRoomCode();
  for (let i = 0; i < 5 && store.rooms.has(code); i++) {
    code = generateRoomCode();
  }
  // Nettoyage du nom : trim + cap à 60 caractères pour rester lisible
  // dans une preview WhatsApp ou un titre d'onglet.
  const cleanName = typeof name === "string" ? name.trim().slice(0, 60) : "";
  const room: Room = {
    code,
    createdAt: Date.now(),
    ...(cleanName ? { name: cleanName } : {}),
  };
  store.rooms.set(code, room);
  store.antsByRoom.set(code, new Set());
  if (cleanName) {
    store.roomsByName.set(nameKey(cleanName), code);
  }
  return room;
}

export function getOrCreateRoom(code: string): Room {
  const store = getStore();
  const upper = code.toUpperCase();
  const existing = store.rooms.get(upper);
  if (existing) return existing;
  // On crée une room sans nom — elle a juste été visitée par code.
  // Si quelqu'un veut lui donner un nom plus tard, on ajoutera une méthode dédiée.
  const room: Room = { code: upper, createdAt: Date.now() };
  store.rooms.set(upper, room);
  store.antsByRoom.set(upper, new Set());
  return room;
}

// Résout l'input du formulaire d'accueil :
//  - si l'input ressemble à un code (4 chars de notre alphabet) → get-or-create par code
//  - sinon, on traite comme un nom humain :
//     - on cherche une room existante avec ce nameKey
//     - sinon on en crée une nouvelle (code aléatoire) avec ce nom
// Renvoie aussi `created` pour que le client puisse afficher un toast/log si besoin.
export function resolveRoom(input: string): { room: Room; created: boolean } {
  const store = getStore();
  const trimmed = input.trim();

  if (isCodeShape(trimmed)) {
    const upper = trimmed.toUpperCase();
    const existing = store.rooms.get(upper);
    if (existing) return { room: existing, created: false };
    const room = getOrCreateRoom(upper);
    return { room, created: true };
  }

  // Sinon : c'est un nom humain.
  const key = nameKey(trimmed);
  const existingCode = store.roomsByName.get(key);
  if (existingCode) {
    const existing = store.rooms.get(existingCode);
    if (existing) return { room: existing, created: false };
    // Index pourri (room supprimée, key orpheline) → on nettoie et on continue.
    store.roomsByName.delete(key);
  }

  const room = createRoom(trimmed);
  return { room, created: true };
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

// --- Leave (déco) ----------------------------------------------------------

// Retire un ant de la room : utilisé quand l'utilisateur clique "changer de
// pseudo". On supprime aussi son id de l'index antsByRoom et on notifie la
// room pour que les autres voient sa disparition immédiatement (sans attendre
// le timeout de 60s du heartbeat).
export function leaveAnt(id: string): boolean {
  const store = getStore();
  const ant = store.ants.get(id);
  if (!ant) return false;
  store.ants.delete(id);
  store.antsByRoom.get(ant.roomCode)?.delete(id);
  notify(ant.roomCode);
  return true;
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

// --- Liste publique des rooms ----------------------------------------------
// Les rooms "publiques" = celles avec un nom humain ET au moins un ant
// récemment actif. Les rooms créées par code seul (sans nom) restent
// invisibles — le code 4 chars est leur seul moyen d'accès, ce qui les rend
// privées par construction.

export interface PublicRoomEntry {
  code: string;
  name: string;
  antCount: number;
  // Dernière activité observée dans la room (max des lastSeen). Utilisable
  // pour trier "rooms les plus vivantes en premier" côté client.
  lastSeen: number;
}

export function listPublicRooms(): PublicRoomEntry[] {
  const store = getStore();
  const now = Date.now();
  const out: PublicRoomEntry[] = [];
  for (const room of store.rooms.values()) {
    if (!room.name) continue;
    const ids = store.antsByRoom.get(room.code);
    if (!ids || ids.size === 0) continue;
    let antCount = 0;
    let lastSeen = 0;
    for (const id of ids) {
      const ant = store.ants.get(id);
      if (!ant) continue;
      if (now - ant.lastSeen > STALE_MS) continue; // skip stale (cohérent avec getRoomState)
      antCount++;
      if (ant.lastSeen > lastSeen) lastSeen = ant.lastSeen;
    }
    if (antCount === 0) continue;
    out.push({ code: room.code, name: room.name, antCount, lastSeen });
  }
  // Plus actives d'abord, à égalité par nom alpha pour rester stable visuellement.
  out.sort((a, b) => b.lastSeen - a.lastSeen || a.name.localeCompare(b.name));
  return out;
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
