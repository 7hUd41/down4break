// Emoji "animal" attaché à un ant — par défaut déduit du critter présent dans
// son pseudo généré (`stoique_fourmi` → 🐜), modifiable ensuite via le picker
// du JoinRoomForm.
//
// Cohabite avec la pastille de phase : la pastille dit l'état du timer, l'emoji
// dit qui tu es. Les deux ensemble dans la liste donnent un coup d'œil rapide.

// Mapping CRITTER → EMOJI. On regroupe par famille d'apparence quand on n'a
// pas d'emoji dédié (ex. tous les hyménoptères → 🐝). L'emoji par défaut
// (DEFAULT_EMOJI) couvre les cas où on ne match rien.
const CRITTER_TO_EMOJI: Record<string, string> = {
  ant: "🐜", fourmi: "🐜", fourmilier: "🐜", termite: "🐜",
  abeille: "🐝", bee: "🐝", frelon: "🐝", guepe: "🐝",
  criquet: "🦗", grillon: "🦗", sauterelle: "🦗", mante: "🦗",
  coccinelle: "🐞",
  cigale: "🪲", hanneton: "🪲", scarabee: "🪲", tique: "🪲", puceron: "🪲",
  blatte: "🪳", punaise: "🪳",
  araignee: "🕷️",
  scorpion: "🦂",
  moustique: "🦟",
  mouche: "🪰",
  larve: "🪱", ver: "🪱", mille_pattes: "🪱", phasme: "🪱",
  papillon: "🦋", libellule: "🦋", luciole: "🦋",
};

export const DEFAULT_EMOJI = "🐛";

// Liste d'emojis proposés dans le picker du JoinRoomForm. Volontairement courte
// (12 entrées) pour rentrer dans une grille 4×3 sans scroll. Si Thomas veut un
// vrai picker complet plus tard, on swappera vers une lib type `emoji-picker-react`.
export const EMOJI_OPTIONS: readonly string[] = [
  "🐜", "🐝", "🦗", "🐞",
  "🪲", "🪳", "🕷️", "🦂",
  "🦟", "🪰", "🪱", "🦋",
];

// Déduit l'emoji par défaut à partir d'un pseudo. Format attendu : `adj_critter`
// (cf. pseudo.ts). On split sur "_" et on cherche le dernier segment connu
// dans CRITTER_TO_EMOJI. Marche aussi si le user tape un nom libre tant qu'un
// segment matche (ex. "team_fourmi" → 🐜).
export function inferEmojiFromName(name: string): string {
  const parts = name.toLowerCase().split(/[_\s]+/).filter(Boolean);
  // On parcourt en partant de la fin : c'est là qu'on a le critter dans nos
  // pseudos générés (`adjectif_critter`).
  for (let i = parts.length - 1; i >= 0; i--) {
    const e = CRITTER_TO_EMOJI[parts[i]];
    if (e) return e;
  }
  return DEFAULT_EMOJI;
}
