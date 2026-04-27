import type { Metadata } from "next";
import { getRoom } from "@/lib/store";
import { getOrigin } from "@/lib/url";
import RoomGate from "./RoomGate";

interface Props {
  params: Promise<{ code: string }>;
}

// Generate per-room metadata pour avoir une preview WhatsApp / iMessage / Slack
// avec le code (et le nom si défini) plutôt que le titre générique.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const room = getRoom(upper);
  const origin = await getOrigin();

  // Le nom n'est connu que si la room a déjà été créée côté serveur.
  // Sinon (lien partagé avant création) on tombe juste sur le code.
  const label = room?.name ?? upper;
  const title = room?.name
    ? `${room.name} · down4break?`
    : `room ${upper} · down4break?`;

  const description = `Rejoins la room ${label} sur down4break? — u down for a break?`;
  const url = `${origin}/r/${upper}`;
  const image = `${origin}/logo.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [image],
      type: "website",
      siteName: "down4break?",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  const upper = code.toUpperCase();
  return <RoomGate code={upper} />;
}
