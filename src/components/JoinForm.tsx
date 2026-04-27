"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom } from "@/lib/api";

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "join" | "create">(null);
  const [err, setErr] = useState<string | null>(null);

  function goToRoom(roomCode: string) {
    router.push(`/r/${encodeURIComponent(roomCode.toUpperCase())}`);
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy("join");
    setErr(null);
    goToRoom(code.trim());
  }

  async function onCreate() {
    setBusy("create");
    setErr(null);
    try {
      const room = await createRoom();
      goToRoom(room.code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erreur inconnue");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <form onSubmit={onJoin} className="flex gap-2">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          placeholder="CODE DE ROOM"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground tracking-widest font-mono uppercase placeholder:text-muted/60 focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!code.trim() || busy !== null}
          className="px-5 py-3 rounded-lg bg-foreground text-background font-medium disabled:opacity-40 hover:opacity-90 transition"
        >
          {busy === "join" ? "…" : "rejoindre"}
        </button>
      </form>

      <div className="text-xs text-muted">— ou —</div>

      <button
        onClick={onCreate}
        disabled={busy !== null}
        className="px-5 py-3 rounded-lg border border-border bg-card hover:border-accent disabled:opacity-40 transition"
      >
        {busy === "create" ? "création…" : "créer une nouvelle room"}
      </button>

      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  );
}
