// Générateur de pseudo style "Docker container name" — adjectif + insecte/bestiole.
// Server-safe (pas de DOM, pas de Date.now côté render) : on l'utilise aussi bien
// côté client (bouton dice) que côté serveur (fallback si quelqu'un join sans pseudo).
//
// Tirage uniforme via Math.random — assez bon pour un MVP. Si on veut éviter
// les collisions visuelles dans une même room on pourra suffixer un nombre,
// mais à l'usage les antz ne sont jamais 100 dans la même room.

const ADJECTIVES = [
  "agile", "alerte", "audacieuse", "bavarde", "bricoleuse", "calme", "curieuse",
  "discrete", "douce", "endurante", "espiegle", "feroce", "fiable", "futee",
  "geniale", "habile", "hardie", "intrepide", "joviale", "loyale", "lucide",
  "maline", "mefiante", "minutieuse", "modeste", "nocturne", "paisible",
  "patiente", "perspicace", "pimpante", "prudente", "rapide", "rebelle",
  "reveuse", "rigoureuse", "rusee", "sagace", "serene", "solaire", "stoique",
  "tenace", "timide", "tranquille", "vaillante", "vigilante", "vive", "zenique",
];

// On reste dans la famille élargie des bestioles "down to break" — des trucs
// qu'on peut s'imaginer co-worker dans une fourmilière.
const CRITTERS = [
  "ant", "fourmi", "abeille", "bee", "araignee", "cigale", "coccinelle",
  "criquet", "fourmilier", "frelon", "grillon", "guepe", "hanneton",
  "larve", "libellule", "luciole", "mante", "mille_pattes", "moustique",
  "mouche", "papillon", "phasme", "puceron", "punaise", "sauterelle",
  "scarabee", "scorpion", "termite", "ver", "tique", "blatte",
];

// Combos favoris de Thomas — tirés en priorité avec une proba FAVORITE_BIAS.
// Pour en ajouter : juste pousser dans la liste. Pour faire varier la fréquence,
// régler FAVORITE_BIAS (0.3 = 30% des pseudos viennent d'ici).
//
// Note : on ne dé-doublonne pas avec ADJECTIVES/CRITTERS — un favori peut très
// bien être recombiné aléatoirement aussi, c'est juste qu'il a plus de chances
// de tomber.
const FAVORITES: readonly string[] = [
  "calme_larve",
  "stoique_ant",
  "zenique_luciole",
  "paisible_phasme",
  "discrete_blatte",
  "tranquille_ver",
  "reveuse_libellule",
];

const FAVORITE_BIAS = 0.3;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Format : "adjectif_creature" — minuscules, séparateur underscore.
// Pas d'accents pour rester sûr en URL/JSON et lisible en mono-space.
export function generatePseudo(): string {
  if (FAVORITES.length > 0 && Math.random() < FAVORITE_BIAS) {
    return pick(FAVORITES);
  }
  return `${pick(ADJECTIVES)}_${pick(CRITTERS)}`;
}
