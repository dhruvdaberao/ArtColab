# Froddle

> A playful real-time collaborative whiteboard where teams and guests can create rooms, sketch together, chat live, react instantly, and manage shared creative spaces.

## Live Demo

- Frontend: [https://froodle.vercel.app](https://froodle.vercel.app)
- Backend health check: `https://artcolab-1.onrender.com/health`

## Screenshots

> Add product screenshots or GIFs here.

- `docs/screenshots/home.png` — landing page
- `docs/screenshots/room-board.png` — collaborative room canvas
- `docs/screenshots/profile.png` — account/profile management

## Features

### Collaboration
- Real-time multi-user drawing with Socket.IO-powered room sync.
- Live participant presence and cursor broadcasting.
- In-room chat, emoji reactions, and sticker placement.
- Shared room modes including `free-draw` and `guess-mode`.

### Drawing Experience
- Freehand pen and eraser tools.
- Fill bucket support.
- Shape tools: line, rectangle, square, circle, ellipse, triangle, and star.
- Brush styles: classic, crayon, neon, dotted, spray, and rainbow-ready shared typings.
- Per-user undo/redo with optimistic updates on the client.
- Canvas pan/zoom support for touch and desktop workflows.

### Room Management
- Create public or private rooms.
- Private room password protection.
- Browse active rooms by name or room code.
- Manage owned and joined rooms.
- Update room settings or delete rooms.

### Identity & Accounts
- Guest sessions for instant access.
- User registration and login.
- Guest-to-user upgrade path that migrates owned/joined room associations.
- JWT-based authentication.
- Forgot-password flow using OTP email verification.
- Profile editing with optional Cloudinary-hosted profile images.
- Account deletion with room cleanup for owned rooms.

### UX & Platform
- Responsive Next.js app with mobile-aware controls.
- Orientation handling for room routes.
- PWA manifest and installable app metadata.
- Typed API and socket contracts shared across client and server.

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Lucide React
- Socket.IO Client
- Zod

### Backend
- Node.js
- Express
- TypeScript
- Socket.IO
- Mongoose
- bcryptjs
- jsonwebtoken
- Resend
- Cloudinary

### Realtime
- Socket.IO rooms and event contracts
- Shared event/type definitions in the `shared` workspace

### Database
- MongoDB via Mongoose
- In-memory room manager with Mongo-backed room/auth persistence

### Deployment
- Vercel for the frontend
- Render-style Node deployment for the backend

## Architecture Overview

Froddle is a monorepo with three workspaces:

- `client/` — Next.js frontend for authentication, room creation, browsing, profile management, and the live canvas UI.
- `server/` — Express + Socket.IO backend handling auth, room APIs, profile APIs, room lifecycle, and real-time events.
- `shared/` — shared TypeScript contracts for room state, canvas data, and socket payloads.

At runtime:
1. The client uses REST APIs for auth, room discovery, room settings, and profile updates.
2. The client connects to Socket.IO after entering a room.
3. The server validates socket events, updates in-memory room state, broadcasts changes, and debounces persistence of strokes/stickers into MongoDB.
4. Shared types keep the client/server contract aligned.

## How to Run Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Create environment files
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

### 3. Start the app
```bash
npm run dev
```

### 4. Open the apps
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

### 5. Production build
```bash
npm run build
```

## Environment Variables

### Client (`client/.env.local`)
| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL for REST API requests. |
| `NEXT_PUBLIC_SOCKET_URL` | Base URL for Socket.IO connections. Optional if same as API/backend. |
| `NEXT_PUBLIC_APP_URL` | Optional public app URL used for metadata/canonical settings. |

### Server (`server/.env`)
| Variable | Purpose |
| --- | --- |
| `PORT` | Backend HTTP port. |
| `NODE_ENV` | Runtime mode: development, test, or production. |
| `CLIENT_ORIGIN` / `CLIENT_URL` / `CLIENT_ORIGINS` | Allowed frontend origins for CORS. |
| `MONGODB_URI` / `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Secret used to sign guest and user JWTs. |
| `OTP_EXPIRES_MINUTES` | OTP validity duration for password reset. |
| `RESEND_API_KEY` | Resend API key for OTP email delivery. |
| `RESEND_FROM` | Sender identity for password reset emails. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for profile image uploads. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. |
| `ROOM_IDLE_TIMEOUT_MS` | Declared room idle timeout setting. |
| `CLEANUP_INTERVAL_MS` | Cleanup interval for expired-room maintenance. |
| `MAX_STROKES_PER_ROOM` | Maximum stroke history retained per room. |
| `REDIS_URL` | Reserved/optional Redis connection string. |

## Folder Structure

```text
.
├── client/
│   ├── app/                 # Next.js routes and pages
│   ├── components/          # UI, auth, canvas, dialogs, layout
│   ├── hooks/               # Realtime room socket hook
│   └── lib/                 # API client, socket setup, guest/session helpers
├── server/
│   └── src/
│       ├── config/          # Environment parsing and CORS policy
│       ├── db/              # Mongo connection bootstrap
│       ├── middleware/      # Auth middleware
│       ├── models/          # Mongoose schemas
│       ├── rooms/           # In-memory room manager
│       ├── routes/          # REST endpoints
│       ├── serializers/     # Response shaping/hydration helpers
│       ├── socket/          # Socket.IO event registration
│       └── utils/           # Auth, email, validation, Cloudinary helpers
├── shared/
│   └── types/               # Shared room/canvas/socket contracts
└── package.json             # Workspace orchestration
```

## Key Highlights

- Supports both guest-first onboarding and full account-based persistence.
- Uses a shared TypeScript contract layer to reduce client/server drift.
- Balances in-memory responsiveness with debounced MongoDB persistence for room canvas state.
- Includes collaborative UX details beyond drawing: chat, reactions, participant presence, stickers, and room management.
- Handles private room access, profile images, OTP reset flow, and account deletion in one cohesive product.

## Future Improvements

- Durable room expiration/cleanup behavior tied to actual idle timeout logic.
- Redis adapter for horizontal Socket.IO scaling.
- Persistent chat history and replay beyond in-memory session scope.
- Better conflict resolution/versioning for concurrent object editing.
- Asset uploads for exports, templates, and shared boards.
- Offline drafts and reconnection recovery snapshots.

## Author

Built as a full-stack collaborative whiteboard platform using a modern TypeScript monorepo architecture.

> If you are showcasing this project publicly, replace this section with your name, portfolio, LinkedIn, GitHub, and demo links.
