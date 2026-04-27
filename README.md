# down4break?

> *t'es-tu down for a break? · u down for a break?*

Pomodoro social pour un groupe de coworkers. Chacun lance sa session focus/pause, et les autres voient en temps réel où il en est — pour éviter de déranger quelqu'un en focus, et synchroniser les pauses naturellement.

## Stack

- Next.js 16 (app router) + TypeScript + Tailwind v4
- Store **in-memory** (Map) — un seul process Node persistant requis (pas de Vercel/serverless)
- Server-Sent Events pour le temps réel
- Pas de DB en v1 : un reboot du service efface les rooms (acceptable pour MVP coworking)

## Dev

```bash
npm install
npm run dev
```

Ouvre <http://localhost:3000>, crée une room, partage le code à 4 caractères.

## Deploy

Image Docker multi-stage avec `output: 'standalone'`. Compatible Railway / Fly.io / Render / tout host qui run un Node single-process.

```bash
docker build -t down4break .
docker run -p 3000:3000 down4break
```

## Endpoints API

| Route                              | Method | Rôle                                         |
| ---------------------------------- | ------ | -------------------------------------------- |
| `/api/rooms`                       | POST   | Crée une room avec un code aléatoire          |
| `/api/rooms/[code]/join`           | POST   | `{name, focusMin?, breakMin?}` → ant         |
| `/api/rooms/[code]/state`          | GET    | Snapshot de la room                           |
| `/api/rooms/[code]/stream`         | GET    | SSE — push à chaque change + tick 1s         |
| `/api/ants/[id]/action`            | POST   | `{action: start\|pause\|resume\|skip\|reset}`|
| `/api/ants/[id]/heartbeat`         | POST   | Garde l'ant visible (purge à 60s sans hb)    |

## Limites connues v1

- Reboot = wipe (in-memory). À remplacer par SQLite + volume si besoin.
- Single instance only (le store n'est pas partagé entre processes).
- Auth = pseudo + room code, zéro vérification.
