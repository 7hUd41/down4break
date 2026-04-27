// Statuts d'un ant. "idle" = créé/connecté mais pas encore lancé.
export type AntStatus = "idle" | "focus" | "break" | "paused";

export interface Ant {
  id: string;            // UUID stable, stocké aussi côté client (cookie/localStorage).
  name: string;
  roomCode: string;
  focusMin: number;      // Durée d'une phase focus.
  breakMin: number;      // Durée d'une phase break.
  status: AntStatus;
  // Quand status = focus|break, ces deux champs encadrent la phase courante.
  // Quand status = paused, currentPhaseEnd contient le temps restant *en ms*
  // pour pouvoir reprendre proprement (encodé via remainingMs ci-dessous).
  currentPhaseStart: number | null;  // ms epoch
  currentPhaseEnd: number | null;    // ms epoch
  remainingMs: number | null;        // utilisé uniquement quand paused
  joinedAt: number;
  lastSeen: number;
}

export interface Room {
  code: string;          // Court, lisible, partagé verbalement.
  name?: string;         // Nom humain optionnel choisi à la création (max 60 chars).
  createdAt: number;
}

// Forme renvoyée au client. Pas de différences pour l'instant mais on garde
// la séparation pour pouvoir filtrer/transformer plus tard.
export type AntPublic = Ant;

export interface RoomState {
  room: Room;
  ants: AntPublic[];
  serverNow: number;     // Permet au client de calculer le drift d'horloge.
}
