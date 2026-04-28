import type { SessionMode, AntStatus } from "./types";

// Source unique de vérité pour les options du mode social et la dérivation
// d'affichage. Utilisé par RoomView (chip principale + rows "la room") et
// par JoinRoomForm (preview "déjà dans la room") pour rester cohérents.

export const SESSION_MODE_OPTIONS: {
  key: SessionMode;
  label: string;
  hint: string;
  color: string;
}[] = [
  { key: "open",  label: "Ouvert à la discussion", hint: "pour les sessions légères",  color: "var(--mode-open)"  },
  { key: "focus", label: "Focus",                  hint: "pour les sessions intenses", color: "var(--mode-focus)" },
  { key: "dnd",   label: "Ne pas déranger",        hint: "pour les sessions extrêmes", color: "var(--mode-dnd)"   },
];

// Dérive ce qu'on affiche pour un ant en combinant son mode social et son
// status timer. Overrides liés au timer (prennent le pas sur le mode déclaré) :
//  - paused → "Interrupted" (timer arrêté manuellement)
//  - break  → "Break" (phase de pause pomodoro en cours)
export function deriveSessionDisplay(mode: SessionMode, status: AntStatus): { label: string; color: string } {
  if (status === "paused") return { label: "Interrupted", color: "var(--muted)" };
  if (status === "break")  return { label: "Break",       color: "var(--break)" };
  const base = SESSION_MODE_OPTIONS.find((o) => o.key === mode) ?? SESSION_MODE_OPTIONS[0];
  return { label: base.label, color: base.color };
}
