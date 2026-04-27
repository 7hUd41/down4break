"use client";

// Liste des rooms publiques actives, affichée en bas de la landing.
//
// Refresh polling toutes les 15s — on n'a pas besoin de SSE ici, c'est juste
// une vitrine. L'événement "join" est déjà couvert par la SSE intra-room.
//
// Choix UX assumés :
//  - on n'affiche que les rooms qui ont un nom ET au moins 1 ant actif
//    (filtre déjà fait côté serveur dans listPublicRooms)
//  - vide → on cache toute la section pour ne pas polluer la landing
//  - clic sur une row → /r/<code>, le formulaire join s'ouvre normalement

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPublicRooms, type PublicRoom } from "@/lib/api";

const REFRESH_MS = 15_000;

export default function RoomBrowser() {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const next = await listPublicRooms();
        if (!cancelled) setRooms(next);
      } catch {
        // best-effort : si l'API rate, on garde la liste précédente.
      } finally {
        if (!cancelled) timer = setTimeout(tick, REFRESH_MS);
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Tant qu'on n'a pas la première réponse OU si la liste est vide,
  // on n'affiche rien — éviter le flash "0 rooms" au chargement.
  if (!rooms || rooms.length === 0) return null;

  return (
    <section className="w-full max-w-md mt-20">
      <h2 className="text-sm uppercase tracking-widest text-muted mb-4 text-center">
        rooms en cours
      </h2>
      <ul className="flex flex-col gap-2">
        {rooms.map((r) => (
          <li key={r.code}>
            <Link
              href={`/r/${r.code}`}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-accent transition"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{r.name}</p>
                <p className="text-xs font-mono text-muted tracking-widest">{r.code}</p>
              </div>
              <span className="text-xs text-muted shrink-0">
                {r.antCount} {r.antCount > 1 ? "antz" : "ant"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
