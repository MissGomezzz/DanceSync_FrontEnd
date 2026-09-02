# DanceSync_FrontEnd

Frontend of **DanceSync**, a Just-Dance-style web application. Up to 8 users join a room: two of them
dance-battle in real time while the remaining spectators chat and rate the dancers when the battle ends.
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
    rooms/            lobby: create or join a room with up to 8 players
    battle/           real-time dance battle between the two dancers
    chat/             spectator chat
    rating/           spectators rate the dancers at the end of a battle
  shared/
    ui/atoms/         smallest reusable UI pieces (Button, Input, Badge)
    ui/molecules/     compositions of atoms (PlayerCard)
    ui/organisms/     larger reusable sections (empty for now)
    lib/              framework-agnostic helpers: socket singleton, typed env access
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
- `pnpm lint` - run oxlint
- `pnpm preview` - serve the production bundle locally

During development, Vite proxies `/api` and `/socket.io` (including WebSocket upgrades) to the API gateway
at `http://localhost:8080`.

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
