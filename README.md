# CloudCanvas

CloudCanvas is a real-time collaborative whiteboard built with **Next.js + Express + Socket.IO + TypeScript**.

## Architecture
- **Frontend** (`client`): Next.js (Vercel)
- **Backend** (`server`): Node.js + Express + Socket.IO (Render Web Service)
- **Shared contracts** (`shared`): room/canvas/socket TypeScript types and constants

## Local development

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment files
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### 3) Start both frontend and backend
```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Backend health: `http://localhost:4000/health`

## Environment variables

### Frontend (`client/.env.local`)
- `NEXT_PUBLIC_API_URL` (recommended in production; local default is `http://localhost:4000`)
- `NEXT_PUBLIC_SOCKET_URL` (recommended in production; local default is `http://localhost:4000`)


Fallback behavior:
- On localhost, frontend defaults to `http://localhost:4000` if env vars are missing.
- On non-localhost hosts (for example Vercel), frontend falls back to `https://artcolab-1.onrender.com` to prevent accidental `localhost` calls in production.

### Backend (`server/.env`)
- `PORT` (default: `4000`)
- `NODE_ENV` (`development` | `test` | `production`)
- `CLIENT_ORIGIN` (comma-separated allowed frontend origins; supports wildcard entries like `*.vercel.app`)
- `ROOM_IDLE_TIMEOUT_MS` (default: `900000`)
- `CLEANUP_INTERVAL_MS` (default: `60000`)
- `MAX_STROKES_PER_ROOM` (default: `1000`)
- `REDIS_URL` (optional)

## Build and start scripts

### Monorepo root
- `npm run dev` → runs frontend + backend dev servers
- `npm run build` → builds shared, server, client

### Backend (`server/package.json`)
- `npm run dev` → `tsx watch src/index.ts`
- `npm run build` → `tsc -p tsconfig.json`
- `npm start` → `node dist/index.js`

## Deployment (production-ready)

### Render backend (Web Service)
- Runtime: **Node**
- Root Directory: `server`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Note: backend uses local package dependency `file:../shared`; keep `server` as Root Directory so Render can resolve the shared package from the same repo checkout.
- Health Check Path: `/health`

Required Render environment variables:
- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://<your-vercel-domain>` (or comma-separated list, e.g. `https://art-colab-client.vercel.app,https://your-preview.vercel.app`)
- `PORT=4000` (Render may inject one automatically; app supports `process.env.PORT || 4000`)

Optional:
- `ROOM_IDLE_TIMEOUT_MS=900000`
- `CLEANUP_INTERVAL_MS=60000`
- `MAX_STROKES_PER_ROOM=1000`
- `REDIS_URL=<optional>`

### Vercel frontend
- Root Directory: `client`
- Framework: Next.js
- Environment variables:
  - `NEXT_PUBLIC_API_URL=https://<render-backend-url>`
  - `NEXT_PUBLIC_SOCKET_URL=https://<render-backend-url>`

## Troubleshooting frontend-backend connection issues

If room creation fails with `Failed to fetch` or `ERR_CONNECTION_REFUSED`:
1. Verify backend is running and reachable at `/health`.
2. Verify `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` point to the live backend URL (recommended), or that `https://artcolab-1.onrender.com` is reachable when fallback is used.
3. Verify backend `CLIENT_ORIGIN` includes the frontend origin (exact origin or a wildcard such as `*.vercel.app`). The server always keeps localhost + `https://art-colab-client.vercel.app` as safe defaults.
4. Check backend startup logs for effective `port`, `node_env`, and `allowed_client_origins`.
