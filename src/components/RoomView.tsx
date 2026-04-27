"use client";

import { useEffect, useMemo, useState } from "react";
import { sendAction, sendHeartbeat, subscribeRoom, fetchRoomState } from "@/lib/api";
import type { Ant, RoomState } from "@/lib/types";

interface Props {
  code: string;
  meId: string;          // id du ant local
  initialState?: RoomState;
}

export default function RoomView({ code, meId, initialState }: Props) {
  const [state, setState] = useState<RoomState | null>(initialState ?? null);
  const [now, setNow] = useState(() => Date.now());
  // Drift entre l'horloge serveur et celle du client. On le met en *state*
  // (pas en ref) parce qu'il est lu pendant le render — accéder à un ref
  // pendant le render est interdit en React 19 strict.
  const [drift, setDrift] = useState(0);

  // Re-render chaque seconde pour faire avancer les compteurs locaux.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // SSE.
  useEffect(() => {
    let mounted = true;
    // fallback : si la SSE ne monte pas, on fait au moins un fetch initial
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

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col gap-10">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">room</p>
          <h1 className="text-2xl font-mono tracking-widest">{code}</h1>
        </div>
        <p className="text-xs text-muted">
          {state.ants.length} {state.ants.length > 1 ? "antz" : "ant"}
        </p>
      </header>

      {me && <MyTimer ant={me} serverNow={serverNow} />}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3">les autres</h2>
        {others.length === 0 ? (
          <p className="text-sm text-muted italic">
            personne d&apos;autre dans la room. partage le code{" "}
            <span className="font-mono">{code}</span>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {others.map((a) => (
              <AntRow key={a.id} ant={a} serverNow={serverNow} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// --- mon timer -------------------------------------------------------------

function MyTimer({ ant, serverNow }: { ant: Ant; serverNow: number }) {
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
      <PhaseBadge status={phase} large />
      <div className="text-7xl sm:text-8xl font-mono tabular-nums tracking-tight">
        {fmt(remaining)}
      </div>
      <ProgressBar progress={progress} status={phase} />

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {phase === "idle" && (
          <Btn onClick={() => act("start")} primary disabled={busy}>démarrer focus</Btn>
        )}
        {(phase === "focus" || phase === "break") && (
          <>
            <Btn onClick={() => act("pause")} disabled={busy}>pause</Btn>
            <Btn onClick={() => act("skip")} disabled={busy}>skip phase</Btn>
            <Btn onClick={() => act("reset")} disabled={busy}>reset</Btn>
          </>
        )}
        {phase === "paused" && (
          <>
            <Btn onClick={() => act("resume")} primary disabled={busy}>reprendre</Btn>
            <Btn onClick={() => act("reset")} disabled={busy}>reset</Btn>
          </>
        )}
      </div>

      <p className="text-xs text-muted">
        {ant.focusMin} min focus · {ant.breakMin} min pause · {ant.name}
      </p>
    </section>
  );
}

// --- ligne pour chaque autre ant -------------------------------------------

function AntRow({ ant, serverNow }: { ant: Ant; serverNow: number }) {
  const remaining = computeRemainingMs(ant, serverNow);
  return (
    <li className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card">
      <PhaseDot status={ant.status} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{ant.name}</p>
        <p className="text-xs text-muted">{phaseLabel(ant.status)}</p>
      </div>
      {ant.status !== "idle" && (
        <div className="font-mono text-lg tabular-nums">{fmt(remaining)}</div>
      )}
    </li>
  );
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
        "px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 " +
        (primary
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border bg-card hover:border-accent")
      }
    >
      {children}
    </button>
  );
}

function PhaseBadge({ status, large }: { status: Ant["status"]; large?: boolean }) {
  const { color, label } = phaseStyle(status);
  return (
    <span
      className={
        "inline-flex items-center gap-2 px-3 py-1 rounded-full border " +
        (large ? "text-sm" : "text-xs")
      }
      style={{ borderColor: color, color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PhaseDot({ status }: { status: Ant["status"] }) {
  const { color } = phaseStyle(status);
  return (
    <span
      className="w-3 h-3 rounded-full shrink-0"
      style={{ background: color }}
      aria-label={status}
    />
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
    case "break": return { color: "var(--break)", label: "pause" };
    case "paused": return { color: "var(--muted)", label: "en pause" };
    case "idle":
    default:      return { color: "var(--idle)", label: "en attente" };
  }
}

function phaseLabel(s: Ant["status"]): string {
  return phaseStyle(s).label;
}

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
