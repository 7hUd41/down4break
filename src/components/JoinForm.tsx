"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resolveRoom, generateClientCode } from "@/lib/api";

// Formulaire unifié de la landing :
//  - un seul input "nom de ta room"
//  - une icône dice à droite qui remplit le champ avec un code 4 chars random
//    (utile quand on n'a pas d'inspi pour le nom)
//  - un seul bouton "rejoindre"
//
// Logique de résolution déléguée au serveur via POST /api/rooms/resolve.
// Le serveur décide : si l'input ressemble à un code, get-or-create par code ;
// si c'est un nom, lookup par nameKey ou création.

export default function JoinForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // autoFocus en attribut JSX peut causer un hydration mismatch dans certains
  // setups (extensions navigateur, dev mode). On le fait via useEffect, c'est
  // le pattern propre côté React 19.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Variable boolean explicite pour `disabled` — évite tout doute côté hydration.
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
    setInput(generateClientCode());
    setErr(null);
  }

  return (
    <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          placeholder="NOM DE TA ROOM"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={60}
          className="w-full pl-4 pr-12 py-4 rounded-xl border border-border bg-card text-foreground text-lg placeholder:text-muted/60 placeholder:text-base placeholder:tracking-wider focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={rollDice}
          aria-label="générer un code aléatoire"
          title="pas d'inspi ? clique pour générer un code"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition"
        >
          <DiceIcon />
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

function DiceIcon() {
  // Petit dé inline : carré arrondi avec 4 points (clin d'œil au code 4 chars).
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="16" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
