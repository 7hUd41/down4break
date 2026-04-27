"use client";

// Vérifie si l'utilisateur a déjà un antId pour cette room (localStorage).
// Si oui : affiche RoomView. Sinon : affiche JoinRoomForm.
//
// On stocke `antId` par room dans localStorage : clé `down4break:ant:<CODE>`.
// On lit le storage via useSyncExternalStore (pattern React 19 recommandé
// pour les sources externes) — ça évite les setState-dans-effect et le
// hydration mismatch en gérant proprement le snapshot serveur.

import { useCallback, useState, useSyncExternalStore } from "react";
import RoomView from "@/components/RoomView";
import JoinRoomForm from "@/components/JoinRoomForm";
import type { Ant } from "@/lib/types";

const storageKey = (code: string) => `down4break:ant:${code}`;

// Pas d'abonnement nécessaire : la valeur ne change qu'au join, et on
// rafraîchit alors via setState locale.
function noopSubscribe(): () => void {
  return () => {};
}

export default function RoomGate({ code }: { code: string }) {
  // Tampon local pour propager le résultat d'un join sans recharger.
  const [overrideId, setOverrideId] = useState<string | null>(null);

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
    () => null // côté serveur : on ne sait rien -> rendu = JoinForm
  );

  const antId = overrideId ?? storedId;

  function onJoined(ant: Ant) {
    try {
      localStorage.setItem(storageKey(code), ant.id);
    } catch {
      /* private mode : on garde juste en mémoire */
    }
    setOverrideId(ant.id);
  }

  if (!antId) {
    return <JoinRoomForm code={code} onJoined={onJoined} />;
  }

  return <RoomView code={code} meId={antId} />;
}
