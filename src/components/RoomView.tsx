"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from "react";
import { sendAction, sendHeartbeat, setSessionMode, subscribeRoom, fetchRoomState } from "@/lib/api";
import { SESSION_MODE_OPTIONS, deriveSessionDisplay } from "@/lib/sessionDisplay";
import type { Ant, RoomState, SessionMode } from "@/lib/types";
import ShareButton from "@/components/ShareButton";

interface Props {
  code: string;
  meId: string;          // id du ant local
  initialState?: RoomState;
  // onLeave reçoit l'ant courant pour permettre au parent de pré-remplir
  // le re-join form avec ses valeurs.
  onLeave?: (ant: Ant) => void;  // bouton "modifier"
  onExit?: () => void;           // bouton "quitter la room"
}

export default function RoomView({ code, meId, initialState, onLeave, onExit }: Props) {
  const [state, setState] = useState<RoomState | null>(initialState ?? null);
  const [now, setNow] = useState(() => Date.now());
  // Drift entre l'horloge serveur et celle du client (en ms). En state plutôt
  // qu'en ref parce que lu pendant le render.
  const [drift, setDrift] = useState(0);
  // Re-render chaque seconde pour faire avancer les compteurs locaux.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // URL absolue de la room pour le partage. Lue via useSyncExternalStore
  // pour rester propre côté React 19 (pas de setState dans un effect, et
  // pas de hydration mismatch puisqu'on déclare explicitement la valeur server).
  const getShareUrl = useCallback(
    () => `${window.location.origin}/r/${code}`,
    [code]
  );
  const shareUrl = useSyncExternalStore(
    () => () => {},  // pas d'abonnement : window.location.origin est constant pendant la vie du tab
    getShareUrl,
    () => ""         // côté serveur : pas d'URL absolue, on rend rien (le bouton est masqué)
  );

  // SSE.
  useEffect(() => {
    let mounted = true;
    fetchRoomState(code).then((s) => {
      if (!mounted) return;
      setState(s);
      setDrift(s.serverNow - Date.now());
    }).catch(() => {});

    const cleanup = subscribeRoom(code, (s) => {
      if (!mounted) return;
      setState(s);
      setDrift(s.serverNow - Date.now());
    });
    return () => {
      mounted = false;
      cleanup();
    };
  }, [code]);

  // Heartbeat toutes les 20s pour rester visible.
  useEffect(() => {
    sendHeartbeat(meId).catch(() => {});
    const id = setInterval(() => {
      sendHeartbeat(meId).catch(() => {});
    }, 20_000);
    return () => clearInterval(id);
  }, [meId]);

  const me = useMemo(() => state?.ants.find((a) => a.id === meId) ?? null, [state, meId]);
  const others = useMemo(() => state?.ants.filter((a) => a.id !== meId) ?? [], [state, meId]);

  if (!state) {
    return <div className="p-12 text-center text-muted">connexion à la room…</div>;
  }

  const serverNow = now + drift;
  const roomName = state.room.name;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 flex flex-col gap-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Petit logo cliquable qui ramène à la home */}
          <Link href="/" className="shrink-0 hover:opacity-80 transition" aria-label="retour à l'accueil">
            <Image src="/logo.png" alt="" width={48} height={48} className="object-contain" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-muted uppercase tracking-wider">room</p>
            {roomName ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold truncate">{roomName}</h1>
                <p className="text-xs font-mono text-muted tracking-widest mt-0.5">{code}</p>
              </>
            ) : (
              <h1 className="text-xl sm:text-2xl font-mono tracking-widest">{code}</h1>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {shareUrl && (
            <ShareButton
              url={shareUrl}
              title={roomName ? `${roomName} · down4break?` : `room ${code} · down4break?`}
              text={`Rejoins-moi sur down4break? — code ${code}`}
            />
          )}
          <p className="text-xs text-muted">
            {state.ants.length} {state.ants.length > 1 ? "antz" : "ant"}
          </p>
        </div>
      </header>

      {me && <MyTimer ant={me} serverNow={serverNow} onEdit={onLeave ? () => onLeave(me) : undefined} />}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3">la room</h2>
        <ul className="flex flex-col gap-2">
          {state.ants.map((a) => (
            <AntRow
              key={a.id}
              ant={a}
              serverNow={serverNow}
              isMe={a.id === meId}
            />
          ))}
        </ul>
        {/* Footer de la liste : hint "personne d'autre" si seul (1ère ligne)
            puis lien "quitter la room" en dessous (2e ligne). */}
        <div className="mt-3 text-sm text-muted flex flex-col gap-2">
          {others.length === 0 && (
            <p className="italic">
              personne d&apos;autre pour l&apos;instant. partage le code{" "}
              <span className="font-mono">{code}</span>.
            </p>
          )}
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="self-start underline underline-offset-4 hover:text-foreground transition"
              title="quitter cette room et revenir à l'accueil"
            >
              quitter la room
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

// --- mon timer -------------------------------------------------------------

function MyTimer({ ant, serverNow, onEdit }: { ant: Ant; serverNow: number; onEdit?: () => void }) {
  const [busy, setBusy] = useState(false);

  async function act(action: "start" | "pause" | "resume" | "skip" | "reset") {
    setBusy(true);
    try {
      await sendAction(ant.id, action);
    } catch {
      /* l'erreur sera visible via la non-mise-à-jour de l'état */
    } finally {
      setBusy(false);
    }
  }

  const phase = ant.status;
  const remaining = computeRemainingMs(ant, serverNow);
  const total =
    phase === "focus" ? ant.focusMin * 60_000 :
    phase === "break" ? ant.breakMin * 60_000 :
    phase === "paused" ? (ant.remainingMs ?? 0) :
    ant.focusMin * 60_000;
  const progress = total > 0 ? 1 - remaining / total : 0;

  return (
    <section className="flex flex-col items-center gap-6 py-6">
      <SessionModeChip
        mode={ant.sessionMode}
        status={phase}
        onChange={(next) => { setSessionMode(ant.id, next).catch(() => {}); }}
      />
      <div className="text-7xl sm:text-8xl font-mono tabular-nums tracking-tight">
        {fmt(remaining)}
      </div>
      <ProgressBar progress={progress} status={phase} />

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {phase === "idle" && (
          <Btn onClick={() => act("start")} primary disabled={busy}>démarrer session</Btn>
        )}
        {(phase === "focus" || phase === "break") && (
          <>
            <IconBtn label="reset" onClick={() => act("reset")} disabled={busy}>
              <ResetIcon />
            </IconBtn>
            <IconBtn label="break" onClick={() => act("pause")} disabled={busy}>
              <PauseIcon />
            </IconBtn>
            <IconBtn label="phase suivante" onClick={() => act("skip")} disabled={busy}>
              <NextIcon />
            </IconBtn>
          </>
        )}
        {phase === "paused" && (
          <>
            <IconBtn label="reset" onClick={() => act("reset")} disabled={busy}>
              <ResetIcon />
            </IconBtn>
            <IconBtn label="reprendre" onClick={() => act("resume")} disabled={busy} primary>
              <PlayIcon />
            </IconBtn>
            <IconBtn label="phase suivante" onClick={() => act("skip")} disabled={busy}>
              <NextIcon />
            </IconBtn>
          </>
        )}
      </div>

      {/* Sous-texte : durées du cycle + lien "modifier" qui clear le ant
          local et re-affiche le form de join (pseudo, emoji, durées, mode). */}
      <p className="text-xs text-muted">
        {ant.focusMin} min focus · {ant.breakMin} min break
        {onEdit && (
          <>
          {' · '}
            <button
              type="button"
              onClick={onEdit}
              className="underline underline-offset-4 hover:text-foreground transition"
              title="modifier pseudo, emoji ou durées"
            >
              modifier
            </button>
          </>
        )}
      </p>
    </section>
  );
}

// --- ligne pour chaque autre ant -------------------------------------------

// isMe : ligne mise en avant (bordure accent + fond très léger + chip "toi").
// Cliquer sur la row toggle un panneau qui détaille le timing : restant en
// format humain (1h 28 min), heure de début et heure de fin de la phase.
function AntRow({
  ant,
  serverNow,
  isMe = false,
}: {
  ant: Ant;
  serverNow: number;
  isMe?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const remaining = computeRemainingMs(ant, serverNow);
  // L'expand n'a du sens que si une phase est en cours ou en pause — sinon
  // rien à montrer. On laisse quand même la row cliquable pour rester cohérent.
  const hasTimingInfo = ant.status !== "idle";

  return (
    <li
      className={
        "rounded-xl border transition " +
        (isMe ? "border-accent bg-accent/5" : "border-border bg-card")
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-2xl shrink-0" aria-hidden>{ant.emoji}</span>
        <div className="min-w-0 max-w-[12rem] sm:max-w-[16rem]">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{ant.name}</p>
            {isMe && (
              <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-accent-fg font-bold">
                toi
              </span>
            )}
          </div>
          {(() => {
            const d = deriveSessionDisplay(ant.sessionMode, ant.status);
            return (
              <p className="text-xs text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.color }} aria-hidden />
                {d.label}
              </p>
            );
          })()}
        </div>
        {/* Barre de progression double : focus + pause, largeur proportionnelle
            à focusMin/breakMin. Cachée sur très petit écran pour ne pas
            écraser le pseudo et le timer. */}
        <div className="hidden sm:block flex-1 mx-3 min-w-[3rem]">
          <DualProgressBar ant={ant} serverNow={serverNow} />
        </div>
        {ant.status !== "idle" && (
          <div className="font-mono text-lg tabular-nums shrink-0 ml-auto sm:ml-0">{fmt(remaining)}</div>
        )}
      </button>

      {expanded && hasTimingInfo && (
        <div className="px-4 pb-3 -mt-1 grid grid-cols-3 gap-3 text-center text-xs">
          <Detail label="début" value={fmtClock(phaseStartTs(ant))} />
          <Detail label="restant" value={fmtHumanDuration(remaining)} />
          <Detail label="fin" value={fmtClock(phaseEndTs(ant, serverNow))} />
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-border/30 py-2 px-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="font-mono tabular-nums text-sm mt-0.5">{value}</p>
    </div>
  );
}

// Heure de début de la phase courante. On la garde même si la phase est en
// pause — la session a commencé à cet instant, le pause n'invalide pas l'info.
// La fin par contre est recalculée (cf. phaseEndTs) puisqu'elle se décale.
function phaseStartTs(ant: Ant): number | null {
  if (ant.status === "focus" || ant.status === "break" || ant.status === "paused") {
    return ant.currentPhaseStart;
  }
  return null;
}
function phaseEndTs(ant: Ant, serverNow: number): number | null {
  if (ant.status === "focus" || ant.status === "break") return ant.currentPhaseEnd;
  if (ant.status === "paused" && ant.remainingMs != null) {
    // Pour un ant en pause, on projette l'heure de fin théorique = maintenant + restant.
    return serverNow + ant.remainingMs;
  }
  return null;
}

// Format ms → "1h 28 min" / "45 min" / "30 s". Lisible plutôt que "01:28:00".
function fmtHumanDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} s`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m} min`;
}

// Format ts ms → "14:32" en locale FR. null → "—".
function fmtClock(ts: number | null): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// --- helpers UI ------------------------------------------------------------

function Btn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 " +
        (primary
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border bg-card hover:border-accent")
      }
    >
      {children}
    </button>
  );
}

// --- chip dropdown : mode social déclaré -----------------------------------
// Indépendant du timer (status). Permet à l'utilisateur de signaler aux autres
// "je suis en focus / ouvert à la discussion / ne pas déranger". Stocké côté
// serveur via setSessionMode et propagé via SSE.

function SessionModeChip({
  mode,
  status,
  onChange,
}: {
  mode: SessionMode;
  status: Ant["status"];
  onChange: (next: SessionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside pour fermer le menu — pattern classique, rien d'exotique.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const baseOption = SESSION_MODE_OPTIONS.find((o) => o.key === mode) ?? SESSION_MODE_OPTIONS[0];
  // Source unique de vérité pour le label/color affiché — partagé avec les rows.
  const derived = deriveSessionDisplay(mode, status);
  const current = { ...baseOption, label: derived.label, color: derived.color };
  // Le dropdown est désactivé quand le label est imposé par le timer (Pause /
  // Interrupted) — pas pertinent de changer son mode social à ces moments.
  const locked = status === "break" || status === "paused";

  return (
    <div ref={ref} className="relative">
      {/* Quand le timer impose le label (Pause / Interrupted), on locke le
          dropdown : pas de menu ouvrable, pas de caret. Le mode social n'a
          pas de sens à ce moment, le label affiché vient du timer. */}
      <button
        type="button"
        onClick={() => { if (!locked) setOpen((o) => !o); }}
        disabled={locked}
        aria-haspopup={locked ? undefined : "listbox"}
        aria-expanded={locked ? undefined : open}
        className={
          "inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-sm transition " +
          (locked ? "cursor-default" : "hover:border-accent")
        }
      >
        <span className="w-2 h-2 rounded-full" style={{ background: current.color }} aria-hidden />
        {current.label}
        {!locked && <span className="text-muted text-xs">▾</span>}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-2 left-0 min-w-[14rem] rounded-xl border border-border bg-card shadow-lg p-1"
        >
          {SESSION_MODE_OPTIONS.map((o) => {
            const active = o.key === mode;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(o.key); setOpen(false); }}
                  className={
                    "w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition " +
                    (active ? "bg-border/40" : "hover:bg-border/30")
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: o.color }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className={"text-sm " + (active ? "font-medium" : "")}>{o.label}</p>
                    <p className="text-xs text-muted">{o.hint}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- icônes inline pour les boutons d'action ------------------------------
// SVG inline (pas de dépendance lucide-react à ajouter pour 4 icônes).

function IconBtn({
  children,
  onClick,
  label,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "w-11 h-11 inline-flex items-center justify-center rounded-full transition disabled:opacity-40 " +
        (primary
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border bg-card hover:border-accent")
      }
    >
      {children}
    </button>
  );
}

function ResetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5l12 7-12 7V5z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 5l10 7-10 7V5z" />
      <rect x="16" y="5" width="3" height="14" rx="1" />
    </svg>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: Ant["status"] }) {
  const { color } = phaseStyle(status);
  return (
    <div className="w-full max-w-sm h-1.5 rounded-full bg-border/60 overflow-hidden">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, background: color }}
      />
    </div>
  );
}

function phaseStyle(status: Ant["status"]): { color: string; label: string } {
  switch (status) {
    case "focus": return { color: "var(--focus)", label: "focus" };
    case "break": return { color: "var(--break)", label: "break" };
    case "paused": return { color: "var(--muted)", label: "en break" };
    case "idle":
    default:      return { color: "var(--idle)", label: "en attente" };
  }
}


// --- barre de progression double (focus | pause) ---------------------------
// Deux segments collés, largeurs proportionnelles à focusMin/breakMin.
// Le segment focus se remplit pendant la phase focus (ou paused-from-focus),
// est plein quand on passe en break ; le segment pause se remplit pendant la
// phase break (ou paused-from-break). Donne une vue d'ensemble du cycle.

function DualProgressBar({ ant, serverNow }: { ant: Ant; serverNow: number }) {
  const total = ant.focusMin + ant.breakMin;
  const focusFlex = ant.focusMin / total;
  const breakFlex = ant.breakMin / total;
  const fp = focusProgress(ant, serverNow);
  const bp = breakProgress(ant, serverNow);
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden border border-border">
      <div
        className="relative"
        style={{
          flexGrow: focusFlex,
          flexBasis: 0,
          // Fond = couleur de la phase à 18% d'opacité (color-mix). Donne
          // un teint léger qui prévisualise la couleur du fill, plutôt que
          // le gris uniforme — chaque segment garde son identité visuelle.
          background: "color-mix(in oklab, var(--focus) 18%, transparent)",
        }}
        aria-label={`focus ${Math.round(fp * 100)}%`}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500"
          style={{ width: `${fp * 100}%`, background: "var(--focus)" }}
        />
      </div>
      <div
        className="relative"
        style={{
          flexGrow: breakFlex,
          flexBasis: 0,
          background: "color-mix(in oklab, var(--break) 18%, transparent)",
        }}
        aria-label={`break ${Math.round(bp * 100)}%`}
      >
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500"
          style={{ width: `${bp * 100}%`, background: "var(--break)" }}
        />
      </div>
    </div>
  );
}

function focusProgress(ant: Ant, serverNow: number): number {
  const total = ant.focusMin * 60_000;
  if (total <= 0) return 0;
  if (ant.status === "focus") {
    if (!ant.currentPhaseEnd) return 0;
    return clamp01((total - Math.max(0, ant.currentPhaseEnd - serverNow)) / total);
  }
  if (ant.status === "break") return 1; // focus terminé, on est passé à la pause
  if (ant.status === "paused" && ant.pausedFrom === "focus" && ant.remainingMs != null) {
    return clamp01((total - ant.remainingMs) / total);
  }
  if (ant.status === "paused" && ant.pausedFrom === "break") return 1;
  return 0; // idle
}

function breakProgress(ant: Ant, serverNow: number): number {
  const total = ant.breakMin * 60_000;
  if (total <= 0) return 0;
  if (ant.status === "break") {
    if (!ant.currentPhaseEnd) return 0;
    return clamp01((total - Math.max(0, ant.currentPhaseEnd - serverNow)) / total);
  }
  if (ant.status === "paused" && ant.pausedFrom === "break" && ant.remainingMs != null) {
    return clamp01((total - ant.remainingMs) / total);
  }
  return 0; // idle, focus, paused-from-focus → la pause n'est pas commencée
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

// --- temps -----------------------------------------------------------------

function computeRemainingMs(ant: Ant, serverNow: number): number {
  if (ant.status === "paused") return ant.remainingMs ?? 0;
  if (ant.status === "idle") return ant.focusMin * 60_000;
  if (!ant.currentPhaseEnd) return 0;
  return Math.max(0, ant.currentPhaseEnd - serverNow);
}

function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
