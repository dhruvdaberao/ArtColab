# CloudCanvas

CloudCanvas is a production-oriented real-time collaborative whiteboard built with **Next.js + Express + Socket.IO + TypeScript**.
It is intentionally minimal, but engineered with clean architecture boundaries so it can be extended for portfolio demos, interview walkthroughs, and production hardening.

## What this project demonstrates
- Temporary room creation and join flow with shareable links.
- Real-time collaborative drawing with low-latency stroke streaming.
- Presence updates and participant awareness.
- Idle-room cleanup lifecycle for memory safety.
- Monorepo structure with a shared contracts package.
- Deployment-ready setup for **Vercel (client)** + **Render (server)**.

---

## Tech stack
- **Frontend (`client`)**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend (`server`)**: Express, Socket.IO, TypeScript, Zod
- **Shared contracts (`shared`)**: shared room/canvas/socket types + socket event constants

---

## Monorepo layout
```text
cloud-canvas/
  client/
    app/
    components/
    hooks/
    lib/
  server/
    src/
      config/
      rooms/
      routes/
      socket/
      utils/
  shared/
    types/
```

---

## Local development
### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### 3) Run both applications
```bash
npm run dev
```

- Client: `http://localhost:3000`
- Server: `http://localhost:4000`

---

## Environment variables

### Client (`client/.env.local`)
- `NEXT_PUBLIC_API_URL` — HTTP origin of the backend (e.g. `http://localhost:4000`)
- `NEXT_PUBLIC_SOCKET_URL` — Socket.IO origin of the backend (e.g. `http://localhost:4000`)

### Server (`server/.env`)
- `PORT` — default `4000`
- `CLIENT_ORIGIN` — frontend origin used by CORS (e.g. `http://localhost:3000`)
- `ROOM_IDLE_TIMEOUT_MS` — inactivity TTL before room expiration
- `CLEANUP_INTERVAL_MS` — cleanup poll interval
- `MAX_STROKES_PER_ROOM` — memory bound for stored strokes
- `REDIS_URL` — optional future persistence adapter placeholder

---

## Socket event model
Event naming follows a namespaced convention:
- Room lifecycle: `room:*`
- Stroke actions: `stroke:*`
- Board actions: `board:*`

Examples:
- `room:join`, `room:joined`, `room:participants:updated`, `room:expired`, `room:error`
- `stroke:start`, `stroke:append`, `stroke:end`, `stroke:undone`
- `board:clear`, `board:cleared`

Shared constants live in `shared/types/socket.ts` to keep client/server naming aligned.

---

## Architecture notes
### Drawing synchronization
- Local user draws optimistically for responsive UX.
- Stroke points are batched and sent on animation frames (`stroke:append`) for smoother streams.
- New participants receive full room state (`room:joined`/`room:state`) and replay strokes.

### Room lifecycle and cleanup
- Rooms are in-memory and temporary.
- When the last participant leaves, the room is marked for delayed expiry.
- Periodic cleanup removes expired rooms and emits `room:expired`.
- Participant/socket mapping is tracked for robust disconnect handling.

---

## Deployment readiness

## Deploy frontend on Vercel
1. Import this repository into Vercel.
2. Set **Root Directory** to `client`.
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`
   - `NEXT_PUBLIC_SOCKET_URL=https://<your-render-service>.onrender.com`
4. Build command: default (`next build`)
5. Output: default Next.js output
6. Deploy.

## Deploy backend on Render
1. Create a new **Web Service** from this repository.
2. Set **Root Directory** to `server`.
3. Build command:
   ```bash
   npm install && npm run build
   ```
4. Start command:
   ```bash
   npm start
   ```
5. Add environment variables:
   - `PORT=4000` (Render may inject its own; keep app compatible)
   - `CLIENT_ORIGIN=https://<your-vercel-domain>`
   - `ROOM_IDLE_TIMEOUT_MS=900000`
   - `CLEANUP_INTERVAL_MS=60000`
   - `MAX_STROKES_PER_ROOM=1000`
6. Deploy and verify `GET /health`.

### Post-deploy checklist
- Confirm CORS origin exactly matches Vercel domain.
- Confirm both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` use HTTPS backend URL.
- Open two browsers and verify:
  - room creation/join works
  - drawing sync works
  - participant updates work
  - room expiration UX works

---

## Current tradeoffs
- State is intentionally in-memory; restarting the backend clears active rooms.
- Undo is last stroke by current user only.
- No authentication/authorization in this version.

---

## Suggested next upgrades
- Redis room adapter for horizontal scaling.
- Presence heartbeat and stale socket pruning.
- Optional host controls (read-only mode / room lock).
- Canvas snapshotting for faster late-join hydration.
