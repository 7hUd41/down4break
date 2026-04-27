// Formate des minutes en libellé humain : 90 → "1h30", 60 → "1h", 45 → "45 min".
// Utilisé pour les sliders et l'affichage du timer.
export function formatMinutes(min: number): string {
  if (min <= 0) return "0";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
