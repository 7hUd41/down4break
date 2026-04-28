"use client";

// Ligne d'un ant dans une liste (la room en bas de RoomView, preview "déjà
// dans la room" du JoinRoomForm). Composant partagé pour garantir le même
// rendu/comportement partout — emoji, mode social, barre de progression
// double et expand début/restant/fin.

import { useState } from "react";
import type { Ant } from "@/lib/types";
import { deriveSessionDisplay } from "@/lib/sessionDisplay";

interface Props {
  ant: Ant;
  serverNow: number;
  isMe?: boolean;  // pastille "toi" + bordure accent
}

export default function AntRow({ ant, serverNow, isMe = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const remaining = computeRemainingMs(ant, serverNow);
  // L'expand n'a du sens que si une phase est en cours ou en pause.
  const hasTimingInfo = ant.status !== "idle";
  const display = deriveSessionDisplay(ant.sessionMode, ant.status);

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
        <div className="min-w-0 sm:w-56 sm:shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate min-w-0">{ant.name}</p>
            {isMe && (
              <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-accent-fg font-bold">
                toi
              </span>
            )}
          </div>
          <p className="text-xs text-muted flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: display.color }} aria-hidden />
            {display.label}
          </p>
        </div>
        {/* Barre inline desktop. */}
        <div className="hidden sm:block flex-1 mx-3 min-w-[3rem]">
          <DualProgressBar ant={ant} serverNow={serverNow} />
        </div>
        {/* Timer : largeur fixe sm+ pour réserver la place même quand idle
            (placeholder invisible avec espace insécable). En mobile, on ne
            l affiche pas du tout si idle pour ne pas laisser un trou. */}
        <div
          className={
            "font-mono text-lg tabular-nums shrink-0 ml-auto sm:ml-0 sm:w-[4.5rem] sm:text-right " +
            (ant.status === "idle" ? "hidden sm:block" : "")
          }
          aria-hidden={ant.status === "idle"}
        >
          {ant.status !== "idle" ? fmt(remaining) : "\u00A0"}
        </div>
      </button>

      {/* Barre full-width sous la row sur mobile. */}
      <div className="sm:hidden px-4 pb-3">
        <DualProgressBar ant={ant} serverNow={serverNow} />
      </div>

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

// --- helpers exportés (réutilisés par RoomView pour le grand timer) --------

export function computeRemainingMs(ant: Ant, serverNow: number): number {
  if (ant.status === "paused") return ant.remainingMs ?? 0;
  if (ant.status === "idle") return ant.focusMin * 60_000;
  if (!ant.currentPhaseEnd) return 0;
  return Math.max(0, ant.currentPhaseEnd - serverNow);
}

export function fmt(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --- internes --------------------------------------------------------------

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-border/30 py-2 px-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="font-mono tabular-nums text-sm mt-0.5">{value}</p>
    </div>
  );
}

function phaseStartTs(ant: Ant): number | null {
  if (ant.status === "focus" || ant.status === "break" || ant.status === "paused") {
    return ant.currentPhaseStart;
  }
  return null;
}

function phaseEndTs(ant: Ant, serverNow: number): number | null {
  if (ant.status === "focus" || ant.status === "break") return ant.currentPhaseEnd;
  if (ant.status === "paused" && ant.remainingMs != null) {
    return serverNow + ant.remainingMs;
  }
  return null;
}

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

function fmtClock(ts: number | null): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// --- barre de progression double (focus | pause) ---------------------------

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
  if (ant.status === "break") return 1;
  if (ant.status === "paused" && ant.pausedFrom === "focus" && ant.remainingMs != null) {
    return clamp01((total - ant.remainingMs) / total);
  }
  if (ant.status === "paused" && ant.pausedFrom === "break") return 1;
  return 0;
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
  return 0;
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }
