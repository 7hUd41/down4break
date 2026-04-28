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
import { inferEmojiFromName, EMOJI_OPTIONS, DEFAULT_EMOJI } from "@/lib/emoji";
import AntRow from "@/components/AntRow";
import type { Ant } from "@/lib/types";

interface Props {
  code: string;
  onJoined: (ant: Ant) => void;
  // Valeurs à pré-remplir quand l'utilisateur revient sur ce form via le
  // bouton "modifier" — on conserve son pseudo/emoji/durées au lieu de
  // re-générer du random.
  initial?: { name: string; emoji: string; focusMin: number; breakMin: number };
}

export default function JoinRoomForm({ code, onJoined, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState<string>(initial?.emoji ?? DEFAULT_EMOJI);
  // Si l'utilisateur a choisi un emoji manuellement OU vient de "modifier"
  // (initial fourni), on arrête de re-déduire l'emoji automatiquement.
  const [emojiPicked, setEmojiPicked] = useState(initial != null);
  const [focusMin, setFocusMin] = useState(initial?.focusMin ?? 90);
  const [breakMin, setBreakMin] = useState(initial?.breakMin ?? 20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  // Focus le champ pseudo au mount (équivalent autoFocus, mais sans le risque
  // d'hydration mismatch que peut causer l'attribut JSX).
  // On pré-remplit aussi un pseudo généré côté client — pas dans le useState
  // initial pour éviter un mismatch SSR/CSR (Math.random différent).
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // setName + setEmoji ici sont volontaires : Math.random côté serveur
    // != côté client → mismatch SSR/CSR si on les mettait en useState initial.
    const initialPseudo = generatePseudo();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName((current) => current || initialPseudo);
    setEmoji((current) => current === DEFAULT_EMOJI ? inferEmojiFromName(initialPseudo) : current);
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  // Snapshot de la room : nom + ants déjà présents. Refresh toutes les 5s
  // tant que le user n'est pas entré — assez réactif pour voir un nouveau
  // venu sans saturer en requêtes. Pas de SSE ici : c'est un écran preview.
  // serverNow / fetchedAt servent à recaler l'horloge du serveur côté client
  // pour calculer le temps restant local sans drift.
  const [snapshot, setSnapshot] = useState<{
    ants: Ant[];
    serverNow: number;
    fetchedAt: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      try {
        const s = await fetchRoomState(code);
        if (cancelled) return;
        setRoomName(s.room.name ?? null);
        setSnapshot({ ants: s.ants, serverNow: s.serverNow, fetchedAt: Date.now() });
      } catch {
        /* peu importe — on affichera ce qu'on a déjà */
      } finally {
        if (!cancelled) timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [code]);

  // "now" client mis à jour chaque seconde — on le passe aux enfants pour
  // qu'ils calculent le temps restant sans appeler Date.now() pendant le
  // render (règle react-hooks/purity). On laisse à null tant qu'il n'y a
  // personne à afficher pour éviter un interval inutile.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!snapshot || snapshot.ants.length === 0) return;
    // setNowMs synchrone : on veut une valeur immédiate pour afficher le timer
    // dès le premier render qui suit le fetch, sinon 1s de "rien" avant tick.
    // Cas légitime de l'effect — synchroniser une horloge externe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const ant = await joinRoom(code, { name: name.trim(), focusMin, breakMin, emoji });
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
                const next = generatePseudo();
                setName(next);
                if (!emojiPicked) setEmoji(inferEmojiFromName(next));
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

        {/* Picker d'emoji animal — par défaut déduit du critter dans le
            pseudo (fourmi → 🐜). User peut overrider via le picker, on note
            alors emojiPicked=true pour ne plus re-déduire au dice suivant. */}
        <EmojiPicker
          value={emoji}
          onChange={(e) => { setEmoji(e); setEmojiPicked(true); }}
        />

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
            label="break"
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

      {snapshot && (
        <AntsPreview
          ants={snapshot.ants}
          serverNow={snapshot.serverNow}
          fetchedAt={snapshot.fetchedAt}
          nowMs={nowMs ?? snapshot.fetchedAt}
        />
      )}
    </div>
  );
}

// --- preview des antz déjà dans la room ------------------------------------
// Affiché en bas du JoinRoomForm pour donner du contexte avant de rejoindre :
// "qui est déjà là, dans quel état, combien de temps restant, quels réglages".

function AntsPreview({
  ants,
  serverNow,
  fetchedAt,
  nowMs,
}: {
  ants: Ant[];
  serverNow: number;
  fetchedAt: number;
  nowMs: number;
}) {
  // Décalage horloge client/serveur calculé une fois par fetch — on l'utilise
  // pour estimer "what time is it on the server right now" sans nouveau RTT.
  // nowMs vient du parent (tick toutes les 1s) pour rester pure-render.
  const localOffset = nowMs - fetchedAt;
  const estServerNow = serverNow + localOffset;

  return (
    <div className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-muted mb-3">
        déjà dans la room
      </h2>
      {ants.length === 0 ? (
        <div className="px-4 py-6 rounded-xl border border-dashed border-border text-sm text-muted text-center">
          personne pour l&apos;instant.
          <br />
          tu verras les antz apparaître ici dès qu&apos;ils arrivent.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ants.map((a) => (
            <AntRow key={a.id} ant={a} serverNow={estServerNow} />
          ))}
        </ul>
      )}
    </div>
  );
}






// --- picker d'emoji animal -------------------------------------------------
// Grille 4×3 d'options. Click sur un emoji = sélection + fermeture. Le bouton
// trigger affiche l'emoji actuel, son libellé et une flèche ▾ pour signaler
// qu'il est cliquable.

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">ton emoji</span>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="grid"
          aria-expanded={open}
          className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card hover:border-accent transition"
        >
          <span className="text-2xl leading-none" aria-hidden>{value}</span>
          <span className="text-sm text-muted">choisir</span>
          <span className="text-xs text-muted">▾</span>
        </button>
        {open && (
          <div
            role="grid"
            className="absolute z-10 mt-2 left-0 p-2 rounded-xl border border-border bg-card shadow-lg grid grid-cols-4 gap-1"
          >
            {EMOJI_OPTIONS.map((e) => {
              const active = e === value;
              return (
                <button
                  key={e}
                  type="button"
                  role="gridcell"
                  aria-selected={active}
                  onClick={() => { onChange(e); setOpen(false); }}
                  className={
                    "w-10 h-10 inline-flex items-center justify-center rounded-lg text-xl transition " +
                    (active ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-border/40")
                  }
                >
                  {e}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </label>
  );
}
