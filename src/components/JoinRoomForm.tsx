"use client";

// Affiché quand on arrive sur /r/[code] mais qu'on n'a pas encore rejoint
// (pas d'antId en localStorage pour cette room).

import { useState } from "react";
import { joinRoom } from "@/lib/api";
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
      <h1 className="text-3xl font-mono tracking-widest mb-8">{code}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">ton pseudo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus
            placeholder="ex. thomas"
            className="px-4 py-3 rounded-lg border border-border bg-card focus:outline-none focus:border-accent"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-sm text-muted">focus (min)</span>
            <input
              type="number"
              min={5}
              max={240}
              value={focusMin}
              onChange={(e) => setFocusMin(Number(e.target.value))}
              className="px-4 py-3 rounded-lg border border-border bg-card focus:outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-sm text-muted">pause (min)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              className="px-4 py-3 rounded-lg border border-border bg-card focus:outline-none focus:border-accent"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="px-5 py-3 rounded-lg bg-foreground text-background font-medium disabled:opacity-40 hover:opacity-90 transition"
        >
          {busy ? "…" : "entrer dans la room"}
        </button>

        {err && <p className="text-sm text-red-500">{err}</p>}
      </form>
    </div>
  );
}
