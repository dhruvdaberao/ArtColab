# CloudCanvas

CloudCanvas is a production-style real-time collaborative drawing app with temporary multiplayer rooms. Users can create room links, join instantly, draw together on a shared canvas, and collaborate with live participant presence.

## Resume-ready project summary
CloudCanvas is a full-stack TypeScript system built with Next.js + Express + Socket.IO that demonstrates room-based realtime synchronization, temporary room lifecycle management, scalable architecture boundaries, and deployment-ready configuration for Vercel + Render/Railway.

## Features
- Temporary room creation with unique room codes.
- Join by room code/shareable link.
- Realtime collaborative drawing (pen + eraser).
- Brush color picker and size slider.
- Clear board for all participants.
- Undo your own latest stroke.
- Download current board as PNG.
- Live participants list + connection status.
- Graceful room expiration UX.
- Room auto-expiration after inactivity.

## Architecture
### Monorepo apps
- `client/`: Next.js App Router frontend (TypeScript + Tailwind)
- `server/`: Express + Socket.IO backend (TypeScript)
- `shared/`: shared TypeScript models for room/canvas/socket payloads

### Data flow
1. User creates room via `POST /api/rooms/create`.
2. User enters room route `/room/:roomId`.
3. Frontend connects to Socket.IO and emits `join_room`.
4. Server validates room and joins socket to room channel.
5. Drawing operations stream as path events (`draw_start`, `draw_move`, `draw_end`) and are broadcast to room peers.
6. Server stores temporary room state in memory and cleans idle rooms on an interval.

### Room lifecycle
- Room is created active (`expiresAt = null`).
- When final participant leaves, room gets `pendingExpiryAt = now + ROOM_IDLE_TIMEOUT_MS`.
- Cleanup timer (`CLEANUP_INTERVAL_MS`) removes rooms past pending expiry.
- Expired rooms return `404` on HTTP and `room_expired` on socket events.

## Tech stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Socket.IO, TypeScript
- **Validation:** Zod
- **IDs:** nanoid / UUID
- **Configuration:** dotenv

## Folder structure
```text
cloud-canvas/
  client/
    app/
    components/
    hooks/
    lib/
    package.json
  server/
    src/
      config/
      routes/
      rooms/
      socket/
      utils/
      index.ts
    package.json
  shared/
    types/
  README.md
```

## Local setup
### 1) Install
```bash
npm install
```

### 2) Configure env files
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### 3) Run both apps
```bash
npm run dev
```
- Client: `http://localhost:3000`
- Server: `http://localhost:4000`

## Environment variables
### Client (`client/.env.local`)
- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000`)
- `NEXT_PUBLIC_SOCKET_URL` (e.g. `http://localhost:4000`)

### Server (`server/.env`)
- `PORT` (default `4000`)
- `CLIENT_ORIGIN` (frontend origin for CORS)
- `ROOM_IDLE_TIMEOUT_MS` (default 15 minutes)
- `CLEANUP_INTERVAL_MS` (default 60 seconds)
- `MAX_STROKES_PER_ROOM` (memory safety bound)
- `REDIS_URL` (optional placeholder for future persistence adapter)

## How realtime sync works
- Local drawer renders immediately for low-latency UX.
- Client emits incremental draw events with compact point payloads.
- Server rebroadcasts events to room peers only (`io.to(roomId)`).
- New joiners get full `room_state` including recent strokes.

## Deployment guide
### Frontend on Vercel
1. Import repo into Vercel.
2. Set root to `client/`.
3. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>`
   - `NEXT_PUBLIC_SOCKET_URL=https://<backend-domain>`
4. Deploy.

### Backend on Render/Railway
1. Create a Node web service from `server/`.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Set env vars:
   - `PORT`
   - `CLIENT_ORIGIN=https://<vercel-domain>`
   - Room timeout settings as needed
5. Deploy and verify `/health`.

## Limitations / tradeoffs
- Room and stroke storage is in-memory by default for simplicity; data is intentionally temporary.
- Canvas state is stroke-based and can grow under extreme sessions (bounded by `MAX_STROKES_PER_ROOM`).
- Undo is “own latest stroke” only.
- No auth/login in this MVP.

## Future improvements
- Redis-backed room state adapter for multi-instance backend scaling.
- Cursor presence / live pointer indicators.
- Stroke compression and smarter batching.
- Host controls (lock room, role permissions).
- Snapshot autosave for fast late-join hydration.
