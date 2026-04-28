// Générateur de nom de room — auto-attribué quand une room est créée sans
// nom explicite (par code direct, lien `/r/XXXX` partagé, etc.).
//
// Format : "[lieu]_[adjectif]" — distinct visuellement du pseudo qui est
// "[adjectif]_[creature]". Comme ça quand l'utilisateur voit
// `ruche_paisible` (room) vs `paisible_phasme` (pseudo) dans la même UI,
// il sait immédiatement quoi est quoi.
//
// Pas d'accents : safe en URL/JSON et lisible en mono-space.

const PLACES = [
  "ruche", "fourmiliere", "terrier", "clairiere", "atelier", "salon",
  "refuge", "oasis", "jardin", "verger", "bocage", "lagon", "terrasse",
  "perchoir", "abri", "nid", "halte", "repaire", "cabane", "kiosque",
  "veranda", "patio", "cour", "anse", "crique", "vallon", "bosquet",
  "pavillon", "loggia", "rotonde", "alcove", "donjon", "phare",
];

const VIBES = [
  "paisible", "ensoleille", "fleuri", "ombrage", "bourdonnant", "accueillant",
  "tranquille", "secret", "feutre", "doux", "chaleureux", "lumineux",
  "discret", "serein", "cosy", "douillet", "boise", "joyeux", "vif",
  "calme", "zen", "pimpant", "studieux", "feerique", "estival",
  "automnal", "matinal", "vespéral", "nocturne", "complice",
];

// Combos favoris de Thomas — tirés en priorité avec une proba FAVORITE_BIAS.
// Même mécanique que les FAVORITES de pseudo.ts : pour en ajouter, juste
// pousser dans la liste ; pour faire varier la fréquence, régler le bias.
const FAVORITES: readonly string[] = [
  "lagon_douillet",
  "abri_chaleureux",
  "jardin_pimpant",
  "veranda_estivale",
  "vallon_feerique",
];

const FAVORITE_BIAS = 0.3;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRoomName(): string {
  if (FAVORITES.length > 0 && Math.random() < FAVORITE_BIAS) {
    return pick(FAVORITES);
  }
  return `${pick(PLACES)}_${pick(VIBES)}`;
}
