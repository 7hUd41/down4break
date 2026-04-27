"use client";

// Bouton partage. Stratégie :
//  1. Mobile / browsers compatibles → Web Share API (navigator.share) qui
//     ouvre le picker système (WhatsApp, iMessage, Mail, etc.) avec le lien
//     ET le titre de la room. Donne la meilleure UX mobile.
//  2. Desktop / fallback → on copie l'URL dans le presse-papier et on flash
//     un petit "lien copié !" pendant 2s.
// Pas de lib externe, juste les Web APIs.

import { useState } from "react";

interface Props {
  url: string;          // L'URL absolue à partager.
  title?: string;       // Titre/texte qui apparaît dans le picker.
  text?: string;        // Description courte.
  className?: string;
}

type Status = "idle" | "copied" | "shared" | "error";

export default function ShareButton({ url, title, text, className }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  async function onClick() {
    // 1. Web Share API si dispo (et seulement pour HTTPS / localhost)
    const canShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function";

    if (canShare) {
      try {
        await navigator.share({ url, title, text });
        setStatus("shared");
        // pas de timer : si l'utilisateur a partagé c'est fini, l'UI peut rester comme ça
        return;
      } catch (e) {
        // L'utilisateur a annulé → AbortError. On ne montre pas d'erreur, on revient idle.
        if (e instanceof DOMException && e.name === "AbortError") {
          setStatus("idle");
          return;
        }
        // Sinon on tombe sur le clipboard fallback.
      }
    }

    // 2. Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const label =
    status === "copied" ? "lien copié ✓" :
    status === "shared" ? "envoyé ✓" :
    status === "error"  ? "raté — copie à la main" :
    "partager le lien";

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-accent transition " +
        (className ?? "")
      }
    >
      <ShareIcon />
      {label}
    </button>
  );
}

function ShareIcon() {
  // Petit icône inline (pas de lib lucide à embarquer pour ça)
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
