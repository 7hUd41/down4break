import RoomGate from "./RoomGate";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  const upper = code.toUpperCase();
  return <RoomGate code={upper} />;
}
