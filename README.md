# Chain Reaction — Web App

Browser client for the real-time multiplayer game **Chain Reaction**. Built with
**React** + **Vite**, talking to the backend over **Socket.IO**.

The game server lives in a separate repo: **chain-reaction-server** (Node +
Express + Socket.IO). You need it running for the app to work.

---

## What it does

- Create or join a game room by name.
- Up to 4 players per room (extra connections join as spectators).
- A 6×6 board where you place orbs; cells explode in synchronised waves and
  capture neighbours (see the server README for the full rules).
- Live UI: colour-coded player list with the active player highlighted, a
  per-turn countdown timer, explosion animations (burst + flying orbs), and a
  toast when a turn is skipped.

---

## Tech stack

- **React 18** with the automatic JSX runtime (no `import React` needed).
- **Vite 6** for dev server and build.
- **framer-motion** for orb/animation transitions.
- **socket.io-client** for the realtime connection.
- **ESLint** (flat config) for linting.

This is a **JavaScript** project (`.jsx`), not TypeScript.

---

## Project structure

```
src/
├── main.jsx                      # React entry point
├── App.jsx                       # app shell
├── App.css / index.css           # global + layout styles (player list, timer, toast)
└── components/
    ├── ChainReaction.jsx         # the app: socket connection, all game state & events
    └── grid/
        ├── Grid.jsx              # the 6×6 board, orbs, and explosion animations
        └── Grid.css              # board + explosion-animation styles
```

Almost all logic lives in `ChainReaction.jsx` (socket lifecycle, rooms, turn
timer, winner) and `Grid.jsx` (rendering cells, orbs, and per-wave bursts).

---

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev      # start the Vite dev server (default http://localhost:5173)
```

Start the **chain-reaction-server** as well (default port 3000). With both
running, open the app and create/join a room.

---

## Connecting to the backend

The client picks its server URL like this:

```js
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  `${window.location.protocol}//${window.location.hostname}:3000`;
```

- **No config needed for local or LAN play** — it connects to whatever host
  served the page, on port `3000`. So opening the app from `http://localhost:5173`
  talks to `localhost:3000`, and opening it from `http://192.168.1.8:5173` talks
  to `192.168.1.8:3000`.
- **Override with `VITE_SERVER_URL`** for a fixed/deployed backend. Vite inlines
  this at **build time**, so set it before building:

  ```bash
  # .env (or .env.local)
  VITE_SERVER_URL=https://your-backend.example.com
  ```

---

## Play over a LAN / WiFi

`vite.config.js` sets `server.host: true`, so the dev server binds to all
interfaces. On `npm run dev`, Vite prints a **Network** URL, e.g.
`http://192.168.1.8:5173` — share that with anyone on the same WiFi. Their page
will automatically connect its socket back to your machine's `:3000`.

> Everyone must be on the **same network**, the backend must be running, and on
> Windows you may need to allow Node.js through the firewall for private
> networks.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (LAN-accessible). |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint over the project. |

---

## Building for production

```bash
npm run build      # outputs static files to dist/
```

`dist/` is a static bundle you can serve from any static host/CDN. Remember to
set `VITE_SERVER_URL` to your deployed backend URL **before** building, since the
value is baked into the bundle.
