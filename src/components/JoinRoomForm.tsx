"use client";

// Affiché quand on arrive sur /r/[code] mais qu'on n'a pas encore rejoint
// (pas d'antId en localStorage pour cette room).
//
// On fetch l'état de la room au mount pour récupérer son nom (s'il y en a un)
// et l'afficher en gros, plutôt que de montrer juste le code 4 chars.
// Le code reste affiché en sous-titre — c'est ce qu'on continue de partager
// verbalement entre coworkers.

import { useEffect, useRef, useState } from "react";
import DurationSlider from "@/components/DurationSlider";
import { fetchRoomState, joinRoom } from "@/lib/api";
import { generatePseudo } from "@/lib/pseudo";
import type { Ant } from "@/lib/types";

interface Props {
  code: string;
  onJoined: (ant: Ant) => void;
}

export default function JoinRoomForm({ code, onJoined }: Props) {
  const [name, setName] = useState("");
  const [focusMin, setFocusMin] = useState(90);
  const [breakMin, setBreakMin] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  // Focus le champ pseudo au mount (équivalent autoFocus, mais sans le risque
  // d'hydration mismatch que peut causer l'attribut JSX).
  // On pré-remplit aussi un pseudo généré côté client — pas dans le useState
  // initial pour éviter un mismatch SSR/CSR (Math.random différent).
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // setName ici est volontaire : on ne peut pas mettre generatePseudo()
    // dans le useState initial sans casser le SSR (Math.random côté serveur
    // != côté client → mismatch d'hydration). C'est exactement le cas que
    // l'effect doit gérer — on désactive la règle pour cette ligne.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName((current) => current || generatePseudo());
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  // Récupère le nom de la room (s'il existe) pour l'afficher en titre.
  // Pas bloquant : si le fetch échoue, on tombe juste sur le fallback "code en gros".
  useEffect(() => {
    let mounted = true;
    fetchRoomState(code).then((s) => {
      if (mounted) setRoomName(s.room.name ?? null);
    }).catch(() => {
      /* peu importe — on affichera le code seul */
    });
    return () => { mounted = false; };
  }, [code]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const ant = await joinRoom(code, { name: name.trim(), focusMin, breakMin });
      onJoined(ant);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erreur");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto py-12 px-6">
      <p className="text-sm text-muted mb-2">room</p>
      {roomName ? (
        <>
          <h1 className="text-3xl font-semibold mb-1 break-words">{roomName}</h1>
          <p className="text-xs font-mono text-muted tracking-widest mb-8">{code}</p>
        </>
      ) : (
        <h1 className="text-3xl font-mono tracking-widest mb-8">{code}</h1>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">ton pseudo</span>
          {/* Input + bouton dice côte à côte. Le dice re-tire un pseudo style
              "adjectif_bestiole" et re-focus le champ pour rester rapide au clavier. */}
          <div className="flex items-stretch gap-2">
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="ex. thomas"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => {
                setName(generatePseudo());
                requestAnimationFrame(() => {
                  nameInputRef.current?.focus();
                  nameInputRef.current?.select();
                });
              }}
              aria-label="re-tirer un pseudo"
              title="re-tirer un pseudo"
              className="px-3 rounded-xl border border-border bg-card hover:border-accent transition text-lg"
            >
              🎲
            </button>
          </div>
        </label>

        {/* Sliders : focus 5→2h30 (step 5min), pause 1→1h (step 1min). */}
        <div className="flex flex-col gap-5 px-1 py-2">
          <DurationSlider
            label="focus"
            value={focusMin}
            onChange={setFocusMin}
            min={5}
            max={150}
            step={5}
          />
          <DurationSlider
            label="pause"
            value={breakMin}
            onChange={setBreakMin}
            min={1}
            max={60}
            step={1}
          />
        </div>

        <button
          type="submit"
          disabled={name.trim().length === 0 || busy}
          className="px-5 py-3 rounded-xl bg-foreground text-background font-medium disabled:opacity-40 hover:opacity-90 transition"
        >
          {busy ? "…" : "entrer dans la room"}
        </button>

        {err && <p className="text-sm text-red-500">{err}</p>}
      </form>
    </div>
  );
}
