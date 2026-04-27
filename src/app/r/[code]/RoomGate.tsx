"use client";

// Vérifie si l'utilisateur a déjà un antId pour cette room (localStorage).
// Si oui : affiche RoomView. Sinon : affiche JoinRoomForm.
//
// Storage key : `down4break:ant:<CODE>`.
//
// On lit le storage via useSyncExternalStore (pattern React 19 propre, sans
// hydration mismatch). Le state local `overrideId` propage le résultat d'un
// join sans avoir à recharger ; le state `forcedOut` permet d'invalider
// immédiatement l'antId stocké quand l'user clique "changer de pseudo"
// (sinon useSyncExternalStore re-lirait l'ancien id avant qu'il ne soit
// effacé du localStorage).

import { useCallback, useState, useSyncExternalStore } from "react";
import RoomView from "@/components/RoomView";
import JoinRoomForm from "@/components/JoinRoomForm";
import { leaveAnt } from "@/lib/api";
import type { Ant } from "@/lib/types";

const storageKey = (code: string) => `down4break:ant:${code}`;

function noopSubscribe(): () => void {
  return () => {};
}

export default function RoomGate({ code }: { code: string }) {
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [forcedOut, setForcedOut] = useState(false);

  const getStoredId = useCallback((): string | null => {
    try {
      return localStorage.getItem(storageKey(code));
    } catch {
      return null;
    }
  }, [code]);

  const storedId = useSyncExternalStore(
    noopSubscribe,
    getStoredId,
    () => null
  );

  const antId = forcedOut ? null : (overrideId ?? storedId);

  function onJoined(ant: Ant) {
    try {
      localStorage.setItem(storageKey(code), ant.id);
    } catch {
      /* private mode : on garde juste en mémoire */
    }
    setForcedOut(false);
    setOverrideId(ant.id);
  }

  async function onLeave(currentId: string) {
    // Best-effort backend : on supprime l'ant côté serveur (permet aux autres
    // de voir sa disparition immédiate via SSE plutôt que d'attendre la purge
    // de 60s). Si le call échoue on continue, l'ant disparaîtra naturellement.
    leaveAnt(currentId).catch(() => {});
    try {
      localStorage.removeItem(storageKey(code));
    } catch {
      /* idem private mode */
    }
    setOverrideId(null);
    setForcedOut(true);
  }

  if (!antId) {
    return <JoinRoomForm code={code} onJoined={onJoined} />;
  }

  return <RoomView code={code} meId={antId} onLeave={() => onLeave(antId)} />;
}
