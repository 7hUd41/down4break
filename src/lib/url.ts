import { headers } from "next/headers";

// Reconstruit l'origin (https://host) depuis les headers de la requête.
// Indispensable pour les Open Graph tags : og:url et og:image doivent être
// des URLs absolues, sinon WhatsApp/iMessage ne fetchent pas la preview.
//
// Railway/Vercel/Fly.io renseignent x-forwarded-* via leur proxy. On lit
// dans cet ordre : x-forwarded-* > host > fallback localhost.
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "localhost:3000";
  return `${proto}://${host}`;
}
