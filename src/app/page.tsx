import JoinForm from "@/components/JoinForm";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          down4break<span className="text-accent">?</span>
        </h1>
        <div className="space-y-1">
          <p className="text-lg text-foreground/80">
            t&apos;es-tu down for a break?
          </p>
          <p className="text-sm text-muted italic">u down for a break?</p>
        </div>

        <p className="text-sm text-muted max-w-xs leading-relaxed mt-2">
          Pomodoro social pour coworkers. Lance ta session, vois où en sont
          les autres antz, synchronisez naturellement vos pauses.
        </p>

        <div className="w-full mt-6">
          <JoinForm />
        </div>

        <p className="text-xs text-muted mt-8">
          MVP local — données stockées en mémoire (perdues au redémarrage).
        </p>
      </div>
    </main>
  );
}
