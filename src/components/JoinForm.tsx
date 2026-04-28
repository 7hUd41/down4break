"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resolveRoom } from "@/lib/api";
import { generateRoomName } from "@/lib/roomName";

// Formulaire unifié de la landing :
//  - un seul input "nom de ta room" pré-rempli avec un nom auto-généré
//    (ex. "ruche_paisible") — visible et inspirant plutôt qu'un code 4 chars
//  - un bouton dice côte à côté (même pattern que le pseudo dans JoinRoomForm)
//    qui re-tire un nom à chaque clic
//  - un bouton "rejoindre"
//
// Logique de résolution déléguée au serveur via POST /api/rooms/resolve.
// Le serveur décide : code → get-or-create par code ; nom → lookup ou création.

export default function JoinForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Champ vide par défaut — l'utilisateur peut taper son propre nom de room
  // librement. Le placeholder "NOM DE TA ROOM" sert de prompt visuel.
  // Click sur 🎲 = pré-remplir avec un nom auto-généré (cf. rollDice).
  // autoFocus en useEffect pour éviter un hydration mismatch JSX.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submitDisabled: boolean = input.trim().length === 0 || busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      const { room } = await resolveRoom(trimmed);
      router.push(`/r/${encodeURIComponent(room.code)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erreur inconnue");
      setBusy(false);
    }
  }

  function rollDice() {
    setInput(generateRoomName());
    setErr(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  return (
    <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
      {/* Input + dice côte à côte — même pattern que le champ pseudo dans
          JoinRoomForm, pour rester cohérent visuellement à travers l'app. */}
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          placeholder="NOM DE TA ROOM"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={60}
          className="flex-1 min-w-0 px-4 py-4 rounded-xl border border-border bg-card text-foreground text-lg placeholder:text-muted/60 placeholder:text-base placeholder:tracking-wider focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={rollDice}
          aria-label="re-tirer un nom de room"
          title="pas d'inspi ? clique pour un autre nom"
          className="px-4 rounded-xl border border-border bg-card hover:border-accent transition text-2xl"
        >
          🎲
        </button>
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        className="px-5 py-4 rounded-xl bg-foreground text-background font-medium text-lg disabled:opacity-40 hover:opacity-90 transition"
      >
        {busy ? "…" : "rejoindre"}
      </button>

      <p className="text-xs text-muted/70 text-center">
        rejoint la room si elle existe, en crée une sinon.
      </p>

      {err && <p className="text-sm text-red-500 text-center">{err}</p>}
    </form>
  );
}
