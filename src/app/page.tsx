import Image from "next/image";
import JoinForm from "@/components/JoinForm";
import RoomBrowser from "@/components/RoomBrowser";

// Landing — ordre validé avec Thomas :
//  1. logo
//  2. gros titre down4break?
//  3. formulaire (un seul champ + bouton "rejoindre")
//  4. subtitles bilingues + intro pomodoro
//  5. section "comment ça marche" en 3 étapes
//  6. footer minimal

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center px-6 pt-12 pb-20">
      {/* 1. Logo */}
      <div className="w-44 h-44 sm:w-52 sm:h-52 relative">
        <Image
          src="/logo.png"
          alt="deux antz qui se font un high five devant un laptop qui dit NICE"
          fill
          priority
          // Container fait 11rem (176px) à 13rem (208px) — on indique cette
          // contrainte à Next pour qu'il serve la bonne résolution d'image.
          sizes="(min-width: 640px) 208px, 176px"
          className="object-contain"
        />
      </div>

      {/* 2. Titre */}
      <h1 className="mt-6 text-5xl sm:text-7xl font-bold tracking-tight leading-none text-center">
        down4break<span className="text-accent">?</span>
      </h1>

      {/* 3. Formulaire */}
      <section className="w-full max-w-md mt-10">
        <JoinForm />
      </section>

      {/* Rooms publiques actives — sous le formulaire pour donner envie
          de rejoindre quelqu'un avant même de lire le pitch. Masqué si vide. */}
      <RoomBrowser />

      {/* 4. Subtitles + intro */}
      <section className="w-full max-w-md mt-16 flex flex-col items-center gap-3 text-center">
        <div className="space-y-1">
          <p className="text-lg sm:text-xl text-foreground/80">
            t&apos;es-tu down for a break?
          </p>
          <p className="text-sm text-muted italic">u down for a break?</p>
        </div>
        <p className="text-base text-muted leading-relaxed">
          Pomodoro social pour coworkers. Lance ta session, vois où en sont
          les autres antz, synchronisez naturellement vos pauses.
        </p>
      </section>

      {/* 5. Comment ça marche */}
      <section className="w-full max-w-3xl mt-20 grid sm:grid-cols-3 gap-8">
        <Step n={1} title="crée ou rejoins" body="Tape un nom de room. S'il existe, tu rejoins. Sinon on la crée pour toi." />
        <Step n={2} title="partage le lien" body="Bouton « partager » en un clic — preview WhatsApp incluse." />
        <Step n={3} title="focus ensemble" body="Chacun voit où en sont les autres. Pas de notif intrusive, juste de la visibilité." />
      </section>

      {/* Footer */}
      <footer className="mt-24 text-xs text-muted/70 text-center max-w-md">
        MVP — données stockées en mémoire, perdues si le service redémarre.
        Pas de tracking, pas de compte, pas de publicité.
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex flex-col items-start gap-2 text-left">
      <span className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-accent text-accent-fg font-bold text-sm">
        {n}
      </span>
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}
