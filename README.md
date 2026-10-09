# DanceSync_FrontEnd

Frontend of **DanceSync**, a Just-Dance-style web application. Up to 7 users join a room and each chooses
to dance or to spectate: at least two dancers battle in real time while the spectators vote for their favourite,
everyone follows a live ranking, and everyone in the room can chat.
Payments are planned for a later stage.

## Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) through the `@tailwindcss/vite` plugin
- [zustand](https://zustand.docs.pmnd.rs/) for global state
- [react-router v7](https://reactrouter.com/) (`createBrowserRouter` + `RouterProvider`)
- [socket.io-client](https://socket.io/) for the real-time battle service
- Authentication with Azure Entra ID is planned; only environment placeholders exist for now.

## Folder structure

The project follows Screaming Architecture (folders named after business features), atomic design for
shared UI, and the container/presentational pattern inside each feature.

```
src/
  app/                composition root: App, router, and application-wide providers
  features/
    auth/             authentication store and components (Azure Entra ID later)
    rooms/            lobby: create or join a room with up to 7 players and choose to dance or spectate
    battle/           real-time dance battle between the dancers (two or more) and the players panel
    camera/           camera permission, WebRTC peer session, and video tiles for the battle stage
    chat/             room chat (everyone in the room can write)
    voting/           spectators vote for one favourite dancer and may move or withdraw the vote
    scoreboard/       live ranking with rank colours and score change indicators
    results/          end-of-battle announcement, final results dashboard and the "Last battle" card
    songSelection/    lobby typing challenge that decides who picks the song
    wordRace/         mid-battle word race overlay (first dancer to type the word wins the round)
  shared/
    ui/atoms/         smallest reusable UI pieces (Button, Input, Badge)
    ui/molecules/     compositions of atoms (PlayerCard)
    ui/organisms/     larger reusable sections (empty for now)
    lib/              framework-agnostic helpers: socket singleton, connection status, typed env access,
                      standings (ranking, rank colours, name lookup)
    hooks/            shared React hooks (server-relative countdowns)
    api/              HTTP client targeting the API gateway
    types/            domain types shared across features
  pages/              top-level pages not owned by a single feature (HomePage)
  main.tsx            application entry point
  index.css           Tailwind entry and global styles
```

Inside each feature, `components/<Name>.tsx` is the container (state and behavior) and
`components/<Name>View.tsx` is the presentational component (markup only).

## Running locally

```bash
pnpm install
pnpm dev
```

Other scripts:

- `pnpm build` - type-check and produce the production bundle in `dist/`
- `pnpm test` - run the unit and component tests (vitest)
- `pnpm lint` - run oxlint
- `pnpm preview` - serve the production bundle locally

The browser talks to the API gateway directly, at `VITE_API_URL` (REST) and `VITE_WS_URL` (Socket.IO), both
`http://localhost:8080` by default. `vite.config.ts` also declares a proxy for `/api` and `/socket.io`, but with
these absolute URLs it is not used; it only applies to requests sent to the dev server's own origin.

### Testing from other machines on the LAN

- `localhost` in `VITE_API_URL` / `VITE_WS_URL` is resolved by each visitor's browser, so for other machines set
  both to the host's LAN address (for example `http://192.168.1.20:8080`), restart `pnpm dev --host`, and make
  sure the gateway's CORS settings allow the `http://<LAN-IP>:5173` origin.
- Browsers only expose the camera on `https://` pages or on `localhost`, so over `http://<LAN-IP>:5173` remote
  players can spectate but not dance. To dance from another machine, serve the app over HTTPS (for example with
  [`@vitejs/plugin-basic-ssl`](https://github.com/vitejs/vite-plugin-basic-ssl)) and expose the gateway over
  HTTPS too: an `https://` page cannot call an `http://` gateway (mixed content is blocked).

## Camera / WebRTC

During a battle every dancer streams their camera and everyone else in the room (the other dancers and the
spectators) watches it live. The stage shows one tile per dancer in a two-column grid that wraps.

- **Permission flow**: dancers first see an explanation in their stage tile; the browser permission prompt
  only appears after they press "Enable camera". If the permission was granted earlier, the camera starts
  directly.
- **Video only**: no audio is captured, so the battle music does not echo between peers.
- **Topology**: a full mesh of peer-to-peer connections. Dancers publish, spectators only receive, and
  spectators never connect to each other. Each dancer offers to each spectator; between any two dancers the
  one with the lexicographically smaller player id offers and a single connection carries video both ways.
- **Signaling**: offers, answers, and ICE candidates travel over Socket.IO (`webrtc:ready`,
  `webrtc:peer-ready`, `webrtc:signal`) through battle-service, which only validates room membership and
  relays them. Media never passes through the server.
- **STUN only**: the MVP uses `stun:stun.l.google.com:19302` and no TURN server, so peers behind strict or
  symmetric NATs (some corporate or mobile networks) may fail to connect.
- **Secure context required**: browsers only expose the camera on `https://` pages or on `localhost`.
  `http://localhost:5173` works; for other machines see [Testing from other machines on the
  LAN](#testing-from-other-machines-on-the-lan).

## Word race

At random moments of the battle a word appears over the dance stage (`features/wordRace`) and the dancers
race to type it. battle-service decides the winner atomically; the UI only renders what it is told.

- `useWordRaceSync` (mounted by `BattleStage`) binds `word:round-started` / `word:round-ended`, ignores
  events of other rooms and unbinds on unmount, so StrictMode double mounts are safe.
- The countdown uses the server's relative `expiresInMs` against `performance.now()`, never the wall clock
  (`shared/hooks/useCountdown`, also used by the song challenge and the song pick countdown).
- If the battle finishes mid-round (for example when the song ends) the word card closes without a banner.
- Dancers get an autofocused input (Enter submits, pasting is blocked as a light anti-cheat) and can retry
  after a typo ("Not quite, try again"). Spectators see the word and the countdown only.
- When the round ends everyone sees a banner for 3.5 s: the winner, "Too slow!" or "You typed it, but ...
  got there first" for the other dancers, the winner's name for spectators, or "Time's up!". Each dancer
  tile shows how many words that dancer has won.

## Scoring, voting and the live ranking

battle-service owns the score; the UI only renders what it sends.

- **Score**: `score = 2 x votes + 1 x words won` (the server's `VOTE_POINTS` and `WORD_BONUS_POINTS`). Equal
  scores share a rank (1, 1, 3); a tie at the top ends the battle as a draw.
- **Voting** (`features/voting`): each spectator has one vote for a single favourite dancer. Tapping a name
  votes, tapping another one moves the vote, tapping the selected one withdraws it (`vote:cast` with a
  `dancerId` or `null`). Votes count from the start of the song until it ends; the panel is disabled with the
  reason before the start, after the end and for dancers. Only totals are public: each spectator learns their
  own vote from the `vote:cast` ack and from `vote:mine`, which only they receive.
- **Live ranking** (`features/scoreboard`): built from `battle.standings` in every room payload, visible to
  dancers and spectators. Rows are gold, silver and bronze for the first three ranks (tied dancers share the
  colour). When a score changes the row shows `+N` / `−N` for about 2 s and an arrow when the rank moves; the
  change is also announced to screen readers ("Ana +2, now 1st"). The diff runs in a store fed by room
  payloads, never in a render effect, and the first standings after a refresh show no chips.
- **Names**: a players panel lists everyone with their role and a "you" marker, and every video tile shows the
  dancer's name over the picture.

## End of the battle, rematch and leaving

- The battle ends when the song clip ends (`battle.endsInMs`), or early when fewer than two dancers are left.
  Everyone sees a "Battle over!" overlay with the winner or the draw for about 3 s (or until dismissed), then
  the results dashboard: podium, full table with each dancer's gap to the winner, and why the battle ended.
- The dashboard is built from `battle.result.standings`; a refreshed client without standings in memory loads
  the stored match from `GET /api/matches/{battleId}` through the gateway.
- The host can start a **rematch** (`room:rematch`): the room goes back to the lobby with the same players,
  the previous result shows as a "Last battle" card, and the vote, word race and score changes are reset.
- **Leave room** exists in the lobby, the battle and the results. Once pressed it turns red and reads
  "Leaving…", and the app goes home at once without waiting for the server. While the player is in a room,
  closing the tab sends `navigator.sendBeacon` to `POST /api/rooms/{code}/leave` with `{ playerId }` (a JSON
  string sent as `text/plain`, so no CORS preflight) to free the seat immediately. Known limitation: browsers
  fire the same `pagehide` event on a reload, so reloading the page also leaves the room before rejoining it.

## Real-time events

| Direction | Event | Payload |
| --- | --- | --- |
| client to server | `room:join`, `room:leave` | `{ roomCode, playerId, displayName? }` |
| client to server | `role:select`, `player:ready`, `player:kick` | see `features/rooms/store/roomStore.ts` |
| client to server | `song-challenge:start`, `song-challenge:submit`, `song:choose`, `battle:start` | see `roomStore.ts` |
| client to server | `word:submit` | `{ roomCode, playerId, roundId, text }` |
| client to server | `vote:cast` | `{ roomCode, voterId, dancerId \| null }`, ack `{ dancerId \| null }` |
| client to server | `room:rematch` | `{ roomCode, requesterId }` (host only), ack: the room |
| server to client | `room:updated`, `battle:started`, `battle:finished` | the room, with `battle.standings`, `battle.voteCounts`, `battle.wordsWon`, `battle.endReason`, `battle.result.standings` and `lastResult` |
| server to client | `vote:mine` | `{ roomCode, dancerId \| null }`, only to the voter |
| server to client | `word:round-started`, `word:round-ended`, `chat:message`, `room:kicked` | see the features |

Payloads for any room other than the current one are ignored. Every acknowledged event times out after 8 s.

## Environment variables

Copy `.env.example` to `.env` and adjust the values as needed. `.env` is ignored by git.

| Variable               | Description                                        | Default                 |
| ---------------------- | -------------------------------------------------- | ----------------------- |
| `VITE_API_URL`         | Base URL of the API gateway (REST)                 | `http://localhost:8080` |
| `VITE_WS_URL`          | Base URL of the Socket.IO server                   | `http://localhost:8080` |
| `VITE_AZURE_CLIENT_ID` | Azure Entra ID application (client) id             | empty                   |
| `VITE_AZURE_TENANT_ID` | Azure Entra ID tenant id                           | empty                   |

## Backend

The backend lives in the sibling repository `DanceSync_BackEnd`. Its API gateway is expected at
`http://localhost:8080`; both the REST endpoints (`/api`) and the Socket.IO endpoint (`/socket.io`) are
reached through it.
