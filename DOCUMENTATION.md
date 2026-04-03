# Froodle Technical Documentation Report

> Repository analyzed: `/workspace/Froodle`  
> Date: 2026-04-03  
> Product names in codebase: **Froodle** (brand/UI) and **CloudCanvas / ArtColab** (package/deployment identity).

---

## SECTION 1 — PROJECT OVERVIEW

### Project Name
- **Product/UX name:** Froodle.
- **Repository/workspace identity:** cloud-canvas / ArtColab.

### Problem It Solves
Froodle solves the gap between heavyweight enterprise whiteboards and too-basic sketch apps by providing a **fast, room-based, real-time collaborative drawing platform** with:
- low-friction guest onboarding,
- optional registered accounts,
- private/public room controls,
- real-time whiteboard synchronization,
- live chat/reactions/cursor presence.

### Why This Project Was Built
The implementation indicates a design goal of balancing:
1. immediate participation (guest token + display name flow),
2. persistent ownership/history for users,
3. real-time collaborative UX with HTTP + Socket.IO split,
4. operationally simple deployment (Next.js client + Express/Socket backend + MongoDB).

### Real World Use Cases
- Team brainstorming and ideation sessions.
- Classroom collaboration or remote tutoring.
- Live sketching during interviews/workshops.
- Fast ad hoc visual communication in distributed teams.

### Target Users
- Product/design teams needing lightweight collaboration.
- Students/instructors.
- Interview candidates/practice groups.
- Communities/hobby groups seeking quick room-based drawing.

### Industry Relevance
This project is relevant to:
- **EdTech** (collaborative instruction),
- **Remote work tooling** (visual async/sync communication),
- **Creative SaaS** (whiteboarding and ideation),
- **Real-time systems engineering** (event-driven state sync).

### Key Objectives
- Deliver real-time shared canvas interactions.
- Support room lifecycle (create/join/manage/delete/leave).
- Preserve user/profile/account data with MongoDB.
- Maintain transport contracts using shared TypeScript package.
- Offer a polished responsive UI with strong guest usability.

---

## SECTION 2 — SYSTEM OVERVIEW

### What the System Does
Froodle is a monorepo web app where:
- **client** provides Next.js pages and canvas UI,
- **server** provides REST APIs + Socket.IO event handlers,
- **shared** defines canonical types/events for both sides.

### End-to-End Workflow
1. User opens web app (home/auth/browse/manage).
2. User authenticates (guest or registered).
3. User creates or joins a room via HTTP endpoint.
4. User navigates to `/room/[roomId]`.
5. Client opens socket, sends room join event.
6. Server adds participant and emits hydrated room state.
7. Draw/chat/reaction/mode events stream in real-time.
8. RoomManager updates in-memory state and persists strokes/stickers to MongoDB with debounce.
9. Manage/profile/account flows use authenticated REST routes.

### User Journey (Start to Finish)
- **Anonymous entry:** Home page ➜ guest session or auth route.
- **Session identity:** Guest display name persisted in localStorage/sessionStorage.
- **Room entry:** Create/join flow with visibility and optional password.
- **Live collaboration:** Canvas operations + participants + chat + reactions + cursor presence.
- **Lifecycle management:** Browse/manage rooms, update room settings, leave/delete rooms.
- **Account maintenance:** Update profile image/username/email; delete account with password confirmation and cascading room cleanup.

### Data Flow Internals
- **Control-plane (HTTP):** room metadata, auth/session, profile/account settings.
- **Data-plane (Socket.IO):** high-frequency collaborative events (strokes, cursor movement, chat, reactions).
- **Persistence:** MongoDB stores users + room metadata + persisted canvas snapshots.
- **In-memory runtime:** `RoomManager` retains active room state and participant/socket mappings.

### Internal Processing on User Interaction
Example: user draws stroke:
1. Canvas emits `stroke:start` to socket.
2. Server validates payload with Zod.
3. RoomManager appends stroke and clears redo stack for user.
4. Server broadcasts `stroke:event` to room peers.
5. Subsequent `stroke:append` chunks are merged.
6. Debounced persistence writes updated strokes/stickers to MongoDB.

---

## SECTION 3 — TECHNOLOGY STACK

### Frontend

#### Technology: Next.js 14 (App Router)
- **Purpose:** Routing, rendering, metadata/PWA manifest, app shell.
- **Why used:** Modern React framework with file-based routing and production build pipeline.
- **Advantages:** Fast iteration, good DX, server/client component model, SEO/PWA support.
- **Alternatives considered:** Vite + React Router, Remix.
- **Why alternatives not chosen:** Existing structure clearly optimized for App Router conventions and Next ecosystem dependencies.

#### Technology: React 18 + TypeScript
- **Purpose:** Interactive component architecture and type-safe UI logic.
- **Why used:** Rich state/effects model for realtime UI and safer refactoring with types.
- **Advantages:** Strong ecosystem, predictable compositional model.
- **Alternatives:** Vue, Svelte.
- **Why not chosen:** Shared contracts and existing code patterns are TypeScript + React-centric.

#### Technology: Tailwind CSS
- **Purpose:** Utility-first styling for rapid component development.
- **Why used:** Enables consistent design tokens and responsive classes directly in JSX.
- **Advantages:** Fast UI iteration, small conceptual overhead for team scale.
- **Alternatives:** CSS Modules, Styled Components.
- **Why not chosen:** Tailwind already integrated with `globals.css` design system tokens.

#### Technology: socket.io-client
- **Purpose:** Browser realtime transport with reconnection support.
- **Why used:** Pairs with server Socket.IO and handles fallbacks/room messaging cleanly.
- **Advantages:** Robust connection management and event semantics.
- **Alternatives:** native WebSocket.
- **Why not chosen:** Would require custom reconnect/backoff/event protocol handling.

#### Technology: Zod
- **Purpose:** Runtime validation of API response payloads on client.
- **Why used:** Defensive handling against malformed backend responses.
- **Advantages:** Type inference + runtime safety.

### Backend

#### Technology: Node.js + Express
- **Purpose:** REST APIs and HTTP middleware stack.
- **Why used:** Lightweight, mature ecosystem, easy integration with Socket.IO.
- **Advantages:** Simple route composition and middleware reuse.
- **Alternatives:** Fastify, NestJS.
- **Why not chosen:** Express minimalism fits current project complexity.

#### Technology: Socket.IO (server)
- **Purpose:** Real-time event synchronization for room collaboration.
- **Why used:** Bi-directional events, room-based broadcast semantics, reconnection.
- **Advantages:** Operational simplicity for collaborative workloads.

#### Technology: Mongoose + MongoDB
- **Purpose:** User/room persistence with schema constraints and indexing.
- **Why used:** Flexible document model for nested canvas state and user-room arrays.
- **Advantages:** Fast iteration with schema evolution and rich query/update operators.
- **Alternatives:** PostgreSQL + Prisma.
- **Why not chosen:** Current data shape (nested strokes/stickers + variable metadata) aligns naturally with document storage.

#### Technology: JWT + bcryptjs
- **Purpose:** Stateless auth tokens and secure password hashing.
- **Why used:** Standard auth architecture for distributed client/backend deployment.

#### Technology: Resend + Cloudinary
- **Purpose:** OTP email delivery and profile image hosting.
- **Why used:** Offloads specialized infrastructure to managed services.

### Shared Workspace
- `@cloudcanvas/shared` centralizes socket event names and interfaces for strokes, room state, participants, and payload contracts.

### Deployment Environment (Observed)
- Frontend likely hosted on Vercel (URLs in README/env defaults).
- Backend likely hosted on Render (`https://artcolab-1.onrender.com`).
- MongoDB external instance (Atlas or self-hosted URI).

---

## SECTION 4 — PROJECT ARCHITECTURE

### Architecture Style
- **Monorepo modular architecture** with three workspaces.
- **Hybrid communication model:** REST APIs + event-driven realtime layer.
- **State model:** authoritative in-memory room runtime + persisted MongoDB snapshots.

### Layer Interaction Diagram

```text
Browser UI (Next.js/React)
      │
      ├── HTTP (Auth/Profile/Room lifecycle)
      ▼
 Express API Routes
      │
      ├── MongoDB (Users, Rooms)
      ▼
 RoomManager (in-memory room state)
      ▲
      └── Socket.IO (draw/chat/cursor/reaction events)
```

### Folder Structure Strategy
- `client/`: user-facing frontend, routing, UI components, socket hook.
- `server/`: HTTP + realtime + persistence + validation.
- `shared/`: cross-boundary contract package.
- `ArtColab-fresh/`: mirrored copy of the project (appears archival/snapshot and not primary runtime workspace).

### Code Organization
- API concerns separated by domain routes (`auth`, `rooms`, `profile`).
- Validation centralized in `utils/validation.ts`.
- Auth/token/email/cloudinary concerns isolated in dedicated utilities.
- Room collaborative logic encapsulated in `RoomManager`.

---

## SECTION 5 — FOLDER STRUCTURE EXPLANATION

## Root
- `package.json`: workspace orchestration scripts (`dev`, `build`, `lint`).
- `README.md`: user/developer introduction and setup.
- `REPORT.md`: technical narrative report (existing documentation artifact).
- `DOCUMENTATION.md`: this deep-dive report.

## `/client`
- `app/`: Next.js routes (`/`, `/auth`, `/browse-rooms`, `/manage-rooms`, `/profile`, `/room/[roomId]`).
- `components/`: reusable UI elements and domain widgets (auth provider, canvas, participant panel, modals).
- `hooks/use-room-socket.ts`: socket lifecycle + event state synchronization.
- `lib/`: API client, socket factory, runtime URL selection, guest identity helpers, room access/orientation/session hints.
- `globals.css`: theme tokens, utility component classes, orientation rules.

## `/server`
- `src/index.ts`: app bootstrap, CORS, route registration, Socket.IO registration.
- `src/config/env.ts`: environment parsing/defaulting/origin policy.
- `src/db/mongo.ts`: Mongo connection management and readiness flags.
- `src/routes/`: HTTP endpoints grouped by domain.
- `src/socket/registerHandlers.ts`: realtime event handlers.
- `src/rooms/roomManager.ts`: room state engine.
- `src/models/`: Mongoose schemas (`User`, `Room`).
- `src/middleware/auth.ts`: optional vs required auth extraction/validation.
- `src/utils/`: auth/email/cloudinary/validation helpers.
- `src/serializers/`: controlled API output shape for users/rooms.

## `/shared`
- `types/canvas.ts`: stroke/shape/sticker types.
- `types/room.ts`: participant/chat/room state models.
- `types/socket.ts`: canonical socket event names and payload interfaces.

---

## SECTION 6 — FEATURE BREAKDOWN

### 1) Authentication & Session Modes
- **What:** Guest login, user register/login, session lookup, logout, forgot-password OTP.
- **Why:** Support low-friction first use and persistent account progression.
- **How:**
  - Guest endpoint signs guest JWT.
  - Register/login validate payloads, hash password compare, sign user JWT.
  - Guest upgrade migrates owned/joined room metadata.
  - OTP workflow: request code ➜ verify OTP ➜ issue reset session token ➜ reset password.
- **Key files:**
  - `server/src/routes/auth.ts`
  - `server/src/utils/auth.ts`
  - `server/src/utils/email.ts`
  - `client/components/auth-provider.tsx`
  - `client/components/auth-card.tsx`
  - `client/lib/api.ts`

### 2) Room Lifecycle Management
- **What:** Create, join, browse, manage, update settings, delete, leave.
- **Why:** Core collaboration abstraction is room-based access.
- **How:**
  - HTTP routes validate with Zod.
  - Visibility/password checks for private rooms.
  - Ownership checks for settings/delete operations.
  - MongoDB user room arrays updated for user sessions.
- **Key files:**
  - `server/src/routes/rooms.ts`
  - `server/src/serializers/room.ts`
  - `client/app/page.tsx`, `client/app/browse-rooms/page.tsx`, `client/app/manage-rooms/page.tsx`

### 3) Real-Time Drawing & Collaboration
- **What:** Multi-user strokes, append streaming, board clear, undo/redo, mode updates.
- **Why:** Delivers live collaborative whiteboard behavior.
- **How:**
  - Socket events validated server-side.
  - RoomManager mutates room state and tracks redo stacks by user.
  - Broadcast events notify all room participants.
- **Key files:**
  - `server/src/socket/registerHandlers.ts`
  - `server/src/rooms/roomManager.ts`
  - `client/components/canvas-board.tsx`
  - `client/hooks/use-room-socket.ts`

### 4) Presence, Chat, Reactions, Stickers
- **What:** Participant updates, chat messages, emoji reactions, sticker placement, cursor presence.
- **Why:** Human collaboration requires communication and awareness.
- **How:**
  - Participant join/leave tracked via socket/room maps.
  - Chat messages capped per room.
  - Reaction events ephemeral broadcast.
  - Cursor state map maintained per room and emitted.
- **Key files:**
  - `server/src/socket/registerHandlers.ts`
  - `server/src/rooms/roomManager.ts`
  - `client/hooks/use-room-socket.ts`

### 5) Profile & Account Management
- **What:** Fetch/update profile, upload profile image, delete account.
- **Why:** Persistent identity and compliance with account self-management expectations.
- **How:**
  - Auth-required profile routes.
  - Optional image upload to Cloudinary.
  - Account delete transaction removes user and owned rooms, updates references, emits room expiry events.
- **Key files:**
  - `server/src/routes/profile.ts`
  - `server/src/utils/cloudinary.ts`
  - `client/app/profile/page.tsx`

### 6) Device/Orientation Experience
- **What:** Orientation handling for room route and portrait enforcement elsewhere.
- **Why:** Better usability on touch devices for drawing workspace.
- **How:**
  - DOM class/viewport variable management,
  - fullscreen/orientation lock helpers,
  - route guard to reset orientation outside room pages.
- **Key files:**
  - `client/lib/room-orientation.ts`
  - `client/components/route-orientation-guard.tsx`

---

## SECTION 7 — FUNCTIONALITY WALKTHROUGH

1. **User opens app** (`/`).
2. `AuthProvider` calls `/api/auth/me` to hydrate session state.
3. If not authenticated, user can pick guest or account flow.
4. User creates or joins room via HTTP route.
5. Client stores entry hints / private room grants in sessionStorage.
6. User enters `/room/[roomId]` page.
7. Client validates room metadata via `getRoom` and private-password fallback if needed.
8. `useRoomSocket` connects and emits `room:join`.
9. Server adds participant, emits `room:joined` and participant updates.
10. Canvas emits drawing events; server rebroadcasts to peers.
11. Undo/redo/chat/reaction/mode updates propagate in real time.
12. Room state persistence writes strokes/stickers to MongoDB with debounce.
13. User exits/leaves room; server removes participant and broadcasts updates.

---

## SECTION 8 — DATABASE DESIGN

### Database Used
- MongoDB (via Mongoose ODM).

### Collections/Tables
1. **users** (`User` model)
   - unique `username`, unique `email`, `password` hash,
   - `profileImage`, `createdRooms`, `joinedRooms`,
   - reset OTP/session hash + expiry fields.

2. **rooms** (`Room` model)
   - `roomId` (6-char uppercase unique), `name` unique,
   - visibility (`public|private`), optional `passwordHash`,
   - ownership (`ownerType`, `ownerId`, `ownerName`),
   - `canvasState` nested (`strokes`, `stickers`, `version`, `lastSavedAt`),
   - timestamps and last activity.

### Relationships
- Logical one-to-many: user owns many rooms (`ownerId` in `rooms`).
- Many-to-many-like tracking: users keep `joinedRooms` arrays.
- No hard FK constraints (document model), consistency maintained by route logic.

### CRUD Data Flow
- **Create:** room creation route inserts room doc and updates creator’s `createdRooms`.
- **Read:** browse/manage/room metadata from RoomManager, optionally hydrated from Mongo at startup.
- **Update:** room settings/profile updates via targeted `findOneAndUpdate` / user mutation.
- **Delete:** room deletion and account deletion cascade updates.

### Example Record (Conceptual)
```json
{
  "roomId": "AB12CD",
  "name": "Sprint Planning",
  "visibility": "private",
  "ownerType": "user",
  "ownerId": "665e...",
  "canvasState": {
    "strokes": [{"strokeId":"s1","tool":"pen","points":[{"x":10,"y":20}]}],
    "stickers": [],
    "version": 3
  }
}
```

---

## SECTION 9 — API DESIGN

### REST API Endpoints

#### Auth (`/api/auth`)
- `POST /guest` — issue guest token.
- `POST /register` — create account and optional guest migration.
- `POST /login` — credential login and optional guest migration.
- `POST /forgot-password/request` — send OTP email.
- `POST /forgot-password/verify-otp` — validate OTP and issue reset token.
- `POST /forgot-password/reset-password` — reset password using reset token.
- `POST /forgot-password/verify` — legacy combined OTP+reset path.
- `GET /me` — resolve session user from bearer token.
- `POST /logout` — stateless logout acknowledgment.

#### Rooms (`/api/rooms`)
- `POST /create` — create room with visibility/password settings.
- `POST /join` — join room by code/name + visibility + optional password.
- `GET /browse?q=` — list/search room summaries.
- `GET /manage` — list owned/joined rooms for requester.
- `PATCH /:roomId/settings` — owner updates room name/visibility/password.
- `DELETE /:roomId` — owner deletes room.
- `POST /:roomId/leave` — leave joined room (user profile update).
- `GET /:roomId` — fetch room metadata and existence/access gating.

#### Profile (`/api/profile`)
- `GET /` — authenticated profile fetch.
- `PATCH /` — username/email/profileImage update.
- `DELETE /account` — delete account with password confirmation and room cascade.

### Socket Event API
Canonical event names in shared package:
- Room lifecycle: `room:join`, `room:leave`, `room:state:request`, `room:joined`, `room:state`, `room:expired`, `room:error`.
- Participants/cursors: `room:participants:updated`, `room:participant:joined`, `room:participant:left`, `cursor:update`, `cursor:presence`.
- Canvas operations: `stroke:start`, `stroke:append`, `stroke:end`, `stroke:event`, `board:clear`, `board:cleared`, `stroke:undo`, `stroke:undone`, `stroke:redo`, `stroke:redone`.
- Collaboration: `chat:send`, `chat:message`, `reaction:send`, `reaction:event`, `sticker:place`, `sticker:placed`, `mode:set`, `mode:updated`.

### Internal Handling Pattern
- Validate payload with Zod.
- Resolve room in RoomManager.
- Mutate in-memory state.
- Emit targeted room events.
- Persist debounced state when needed.

---

## SECTION 10 — SECURITY CONSIDERATIONS

### Implemented Mechanisms
- JWT bearer token auth (user/guest roles).
- Password hashing with bcrypt.
- OTP reset flow with hashed code/session tokens and expiry windows.
- Zod validation on HTTP and socket payloads.
- CORS origin filtering with explicit allowlist + wildcard support.
- Ownership checks for room settings/delete.
- Profile/account routes require user-auth role.

### Data Protection
- Password never stored plain text.
- Reset code/session tokens stored hashed.
- Cloudinary credentials and other secrets expected via env variables.

### Potential Vulnerabilities / Risks
- Default JWT secret fallback exists for development convenience and must be overridden in production.
- No explicit rate-limiting/throttling middleware for auth/OTP endpoints.
- In-memory room runtime means horizontal scaling needs sticky sessions or distributed state.
- Some duplicated fields in code (e.g., duplicate `expiresAt` / duplicate `type` in one socket emit) indicate minor code-quality risk but not direct exploitation vector.

---

## SECTION 11 — PERFORMANCE OPTIMIZATION

### Existing Optimizations
- Debounced persistence (`SAVE_DEBOUNCE_MS`) to reduce write load.
- Max limits on room strokes, stickers, and chat messages.
- Incremental stroke append model reduces socket payload size.
- Client retry/timeouts in API helper for resilience.
- Socket reconnection strategy and buffered state hydration in hook.
- In-memory room metadata lookups for fast room operations.

### Areas for Further Optimization
- Redis adapter for Socket.IO and shared room state cache.
- Pagination/virtualization for large room lists.
- Differential snapshotting/compression for canvas persistence.
- CDN optimization for profile assets.

---

## SECTION 12 — SCALABILITY

### Current Scalability Posture
- Strong for single-instance or modest traffic workloads.
- Monolith-style server combines API + realtime in one process.

### Required Improvements for Large Scale
1. Introduce shared realtime backbone (Redis adapter for Socket.IO).
2. Move RoomManager state to distributed store or CRDT-based sync service.
3. Add rate limiting and anti-abuse controls.
4. Add background workers for persistence and analytics.
5. Partition room state and enforce hard quotas.
6. Add observability stack (metrics, tracing, log aggregation).

### Architecture Evolution Path
- Current: `Client -> Single API/Socket server -> MongoDB`.
- Scaled: `Client -> API Gateway -> stateless API pods + socket pods + Redis + MongoDB + workers`.

---

## SECTION 13 — LIMITATIONS

- Room state authority is in-memory; crash can lose unsaved transient state.
- No automated test suite present in repository (lint/build only).
- Potential duplicated copy `ArtColab-fresh/` can create maintenance drift/confusion.
- `cleanupExpiredRooms()` currently returns empty array (idle expiration logic effectively inactive).
- Minor duplicate object keys in routes/socket emissions indicate need for stricter lint rules.
- Rate-limiting/abuse prevention not integrated.

---

## SECTION 14 — FUTURE IMPROVEMENTS

1. **AI-assisted features**
   - Prompt-to-shape, sketch recognition, auto-labeling, semantic board summaries.
2. **Collaboration expansion**
   - Threaded comments, mention system, voice rooms, voting timers.
3. **Performance upgrades**
   - Redis cache + socket adapter, incremental canvas snapshots, binary transport.
4. **Security hardening**
   - Rate limiting, brute-force protection, audit logging, stricter CSP.
5. **Product UX improvements**
   - Rich room templates, offline draft mode, accessibility pass (keyboard-first drawing helpers).
6. **Platform engineering**
   - CI/CD quality gates with tests and static analysis.

---

## SECTION 15 — INTERVIEW QUESTIONS & ANSWERS (40)

1. **Q:** Explain the architecture of this project.  
   **A:** It is a monorepo with Next.js frontend, Express REST backend, Socket.IO realtime layer, MongoDB persistence, and shared TS contracts. HTTP handles lifecycle/auth/profile; sockets handle high-frequency collaboration.

2. **Q:** Why both REST and Socket.IO?  
   **A:** REST is ideal for transactional operations (create/update/auth), while Socket.IO is optimal for low-latency continuous events like drawing and cursor updates.

3. **Q:** Why use a shared package?  
   **A:** To keep event names/payload types synchronized across client/server and reduce contract drift bugs.

4. **Q:** How does guest login work?  
   **A:** Server signs a guest JWT with role `guest`; client stores token and display name. Guest can create/join rooms and later upgrade.

5. **Q:** How is guest-to-user upgrade handled?  
   **A:** During register/login with guest token, ownership/join data are migrated in RoomManager and MongoDB.

6. **Q:** How are private rooms enforced?  
   **A:** Room `visibility` + bcrypt-hashed password on server; join route compares submitted password hash.

7. **Q:** How does drawing synchronization work?  
   **A:** Client sends `stroke:start/append/end`; server validates, updates RoomManager, broadcasts `stroke:event`.

8. **Q:** Why debounce persistence?  
   **A:** To reduce database write amplification from frequent stroke append events.

9. **Q:** Where is undo/redo stored?  
   **A:** In RoomManager per-room/per-user redo stack map.

10. **Q:** How are participants tracked?  
    **A:** RoomManager keeps participant arrays and socket-to-room map; socket joins/leaves update broadcasted participant lists.

11. **Q:** How are cursor updates handled?  
    **A:** Per-room map of latest cursor payload by user, broadcast to peers and snapshot on join.

12. **Q:** How is auth implemented?  
    **A:** JWT bearer tokens with role-based route guards (`optionalAuth`, `requireAuth`).

13. **Q:** How is password reset secured?  
    **A:** OTP and reset session tokens are hashed and expiry-limited before allowing password update.

14. **Q:** Why MongoDB for this system?  
    **A:** Flexible nested documents support canvas state and evolving collaborative metadata.

15. **Q:** What does RoomManager do?  
    **A:** Core domain service for room state lifecycle, participant tracking, drawing state, undo/redo, and persistence scheduling.

16. **Q:** Biggest scalability risk today?  
    **A:** In-memory room authority ties active state to a single server process.

17. **Q:** How would you scale sockets horizontally?  
    **A:** Use Socket.IO Redis adapter + distributed room state service.

18. **Q:** How are CORS rules managed?  
    **A:** Env parsing normalizes origins, supports wildcard patterns, and applies to Express and Socket.IO.

19. **Q:** How does the client handle API failures?  
    **A:** Typed `ApiError`, timeout handling, optional retry on timeout, and user-facing messages.

20. **Q:** How does profile image upload work?  
    **A:** Client sends data URI in profile patch; server uploads to Cloudinary and stores secure URL.

21. **Q:** What happens on account deletion?  
    **A:** Transaction deletes user + owned rooms, prunes references from others, removes live participants, emits room expiration.

22. **Q:** Why Zod on both backend and frontend?  
    **A:** Backend ensures request integrity; frontend ensures response integrity.

23. **Q:** How are room IDs generated?  
    **A:** Nanoid-based filtered uppercase 6-char code with fallback generation strategy.

24. **Q:** What are `createdRooms` and `joinedRooms` used for?  
    **A:** Manage page composition and ownership/join history for user accounts.

25. **Q:** How is data consistency maintained without foreign keys?  
    **A:** Route-level transaction/update logic and explicit reference cleanup.

26. **Q:** How would you improve security quickly?  
    **A:** Add rate limiter + auth throttle + CAPTCHA on reset endpoints.

27. **Q:** How are transport contracts versioned?  
    **A:** Currently implicit via shared package version in monorepo; could be formalized with schema version tags.

28. **Q:** Why separate `room` and `roomMeta` in manager?  
    **A:** Efficient metadata listing without full room state serialization overhead.

29. **Q:** How does the app handle mobile orientation?  
    **A:** Room route can enforce workspace orientation/fullscreen behavior; non-room routes restore portrait defaults.

30. **Q:** What is the fallback behavior when Mongo is down?  
    **A:** Auth/profile features return unavailability errors; in-memory room features can still function depending on path.

31. **Q:** Why keep chat in room state but not persist it?  
    **A:** Likely intentional lightweight ephemeral collaboration; avoids growing document size.

32. **Q:** How is room list search implemented?  
    **A:** Case-insensitive filtering over in-memory metadata by name/roomId.

33. **Q:** Why have both guest display name in body and header?  
    **A:** Supports compatibility and defensive identity propagation from different client contexts.

34. **Q:** How are duplicate usernames/emails handled?  
    **A:** Mongoose unique indexes + duplicate key mapping to user-friendly errors.

35. **Q:** What if private room password changes?  
    **A:** Settings endpoint re-hashes provided password and updates room metadata + DB doc.

36. **Q:** What testing strategy would you add first?  
    **A:** Contract tests for API routes and socket event integration tests using test server harness.

37. **Q:** How is state hydration for reconnecting clients done?  
    **A:** `room:state:request` returns serialized room snapshot; join flow emits room joined payload too.

38. **Q:** What design tradeoff is visible in current code?  
    **A:** Speed of delivery and feature breadth favored over strict modular domain boundaries and exhaustive automated tests.

39. **Q:** How would you support enterprise compliance?  
    **A:** Add audit trails, role-based workspace permissions, retention policies, and SSO integration.

40. **Q:** How would you explain this project in one minute?  
    **A:** Froodle is a real-time collaborative whiteboard with room-based access, guest-to-user identity progression, HTTP lifecycle APIs, Socket.IO live sync, and Mongo-backed persistence built in a clean TypeScript monorepo.

---

## SECTION 16 — TECHNICAL DEEP DIVE

### A) Realtime Stroke Pipeline
- Client canvas batches points and emits append chunks.
- Server validates each chunk, merges into stroke, and broadcasts peer event.
- RoomManager caps stroke volume and schedules persistence.
- Undo/redo uses per-user LIFO stacks; redo invalidated on new stroke.

### B) Flood Fill + Shape Rendering (Client Canvas)
- Canvas supports shape synthesis (`line`, `rectangle`, `square`, `circle`, `ellipse`, `triangle`, `star`).
- Fill tool runs pixel flood-fill with tolerance threshold to avoid strict color-match artifacts.
- Brush styles alter stroke visual behavior (classic/crayon/neon/spray/dotted).

### C) Guest Upgrade Algorithm
- Parse provided guest token.
- Transfer in-memory room ownership for guest-owned rooms.
- Update persisted room docs from guest owner to user owner.
- Merge room IDs into user `createdRooms` and `joinedRooms` sets.

### D) Origin Security Logic
- Parse origin env values and defaults.
- Normalize origins and wildcard patterns.
- Evaluate request origin with exact/wildcard matching.
- Apply to both REST CORS middleware and Socket.IO CORS config.

### E) Persistence Strategy
- Startup hydration from Mongo to RoomManager.
- Debounced update writes only canvas subdocument + timestamps/version increment.
- On active collaboration, in-memory state serves low-latency reads/writes.

---

## SECTION 17 — DEPLOYMENT GUIDE

### 1) Prerequisites
- Node.js (LTS recommended).
- npm.
- MongoDB instance (local or hosted).
- Optional: Resend account (OTP emails), Cloudinary account (profile images).

### 2) Install Dependencies
From repo root:

```bash
npm install
```

### 3) Environment Variables
Server expected variables (see `server/src/config/env.ts`):
- `PORT` (default 4000)
- `NODE_ENV`
- `MONGODB_URI` or `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_ORIGIN` / `CLIENT_URL` / `CLIENT_ORIGINS`
- `OTP_EXPIRES_MINUTES`
- `RESEND_API_KEY`, `RESEND_FROM`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- (optional) `ROOM_IDLE_TIMEOUT_MS`, `CLEANUP_INTERVAL_MS`, `MAX_STROKES_PER_ROOM`

Client expected public vars:
- `NEXT_PUBLIC_API_URL` (optional; runtime fallback exists)
- `NEXT_PUBLIC_SOCKET_URL` (optional; runtime fallback exists)
- `NEXT_PUBLIC_APP_URL` (optional for metadata base URL)

### 4) Run in Development

```bash
npm run dev
```

This starts:
- server workspace (`tsx watch src/index.ts`) on port 4000,
- client workspace (`next dev`) on port 3000.

### 5) Build for Production

```bash
npm run build
```

Build order:
1. shared package
2. server
3. client

### 6) Start Production (workspace level)
- Start backend: `npm run start --workspace server`
- Start frontend: `npm run start --workspace client`

### 7) Health Verification
- Backend health: `GET /health`.
- Client root route should render home page and auth flow.

---

## SECTION 18 — SUMMARY

Froodle is a thoughtfully engineered collaborative whiteboard platform that combines strong UX polish with pragmatic TypeScript architecture. The system separates transactional workflows (auth/rooms/profile) from realtime collaboration (Socket.IO), while retaining contract safety through shared workspace types. Room state management is centralized in a purpose-built RoomManager that supports high-frequency drawing interactions, participant tracking, and debounced persistence.

From an interview and project evaluation perspective, this repository demonstrates:
- practical full-stack architecture skills,
- real-time systems design,
- schema and validation discipline,
- production-minded integrations (JWT, MongoDB, email, media hosting),
- and clear extensibility for future scale.

The next maturity step is operational hardening: automated tests, distributed realtime state, rate limiting, and stronger observability. With those upgrades, Froodle can evolve from a strong portfolio/final-year project into a production-grade collaboration service.

---

## Appendix — Notable Observations
- `ArtColab-fresh/` appears to be a mirrored snapshot of the same project and may create maintenance ambiguity if both trees are edited independently.
- There are minor duplicated object keys in a few handlers (low severity, but good cleanup candidates for reliability discipline).

