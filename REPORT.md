# Froddle Technical Report

## 1. INTRODUCTION

### What problem this project solves
Froddle solves the problem of lightweight, instant, browser-based visual collaboration. Traditional whiteboard tools can feel heavy for quick sketching sessions, brainstorming, informal teaching, or playful collaboration. Froddle reduces that friction by allowing users to create or join named rooms, collaborate in real time, and start drawing immediately without forcing a full account-based onboarding flow.

### Why this project is important
This project is important because it brings together several real-world product engineering concerns in one system:
- real-time communication,
- collaborative state synchronization,
- account and guest identity management,
- room security for private spaces,
- profile management,
- password-reset recovery,
- mobile/touch UX,
- and a deployable monorepo architecture.

It demonstrates how to build more than a static CRUD application. It shows an event-driven, collaborative product with both REST and WebSocket communication paths.

### Target users
Primary users include:
- students collaborating on diagrams or study sketches,
- small teams brainstorming visually,
- interview candidates demonstrating system design or realtime engineering skills,
- creators who want an instant room without a complex setup,
- guests who want immediate entry,
- and registered users who want saved identity and room ownership.

### Real-world relevance
Froddle maps directly to the kinds of collaborative products used in education, remote work, design workshops, lightweight ideation, and social drawing apps. It also mirrors the engineering patterns used in production systems such as collaborative editors, whiteboards, and event-driven multiplayer interfaces.

---

## 2. PROJECT OVERVIEW

### High-level explanation
Froddle is a full-stack monorepo application built around real-time collaborative rooms. Users can create public or private rooms, join ongoing sessions, and draw on a shared whiteboard. The product supports guests and registered users, offers room browsing and management, includes live chat and emoji reactions, and keeps client/server contracts synchronized through a shared workspace.

### Core idea
The core idea is simple: combine room-based collaboration with a fast shared canvas, then wrap it in an approachable user experience that works for both anonymous and authenticated users.

### Unique aspects vs similar apps
Compared with a typical whiteboard demo, this project stands out because it includes:
- guest-to-user upgrade behavior,
- private room join flow with passwords,
- browse/manage room experiences,
- OTP-driven password reset,
- profile image upload support,
- per-user undo/redo behavior,
- mobile-aware canvas and orientation support,
- a shared TypeScript contracts package,
- and a mixed persistence strategy where room metadata/auth lives in MongoDB while active collaboration runs from an in-memory room manager with debounced persistence.

---

## 3. TECH STACK (DETAILED)

### Frontend
**Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Socket.IO Client, Zod.

#### Why chosen
- **Next.js** gives file-based routing, production-ready React architecture, metadata support, and strong developer ergonomics.
- **React** is a natural fit for highly interactive UI like canvas controls, modals, room state, and auth flows.
- **TypeScript** improves correctness across a collaboration-heavy codebase.
- **Tailwind CSS** makes it easier to build a custom, visually distinctive UI rapidly.
- **Socket.IO Client** simplifies resilient realtime connections and reconnect handling.
- **Zod** helps validate client-consumed payload structures.

#### Alternatives
- Vite + React could have been simpler for a SPA.
- Remix could provide a different data-loading model.
- Zustand or Redux could have been used for app-wide state management.
- Native WebSocket libraries could replace Socket.IO.

#### Trade-offs
- Next.js adds framework structure and some runtime complexity that a pure SPA would not require.
- Tailwind speeds UI work but can create dense JSX class strings.
- React state is sufficient here, but as collaboration grows, a dedicated client-side store may become more maintainable.

### Backend
**Stack:** Node.js, Express, TypeScript, Socket.IO.

#### Why chosen
- **Express** provides a low-friction way to expose REST APIs for auth, rooms, and profiles.
- **Socket.IO** provides room abstractions, reconnect handling, and cross-browser fallback transport support.
- **TypeScript** helps enforce safer contracts between route handlers, validators, and room logic.

#### Alternatives
- Fastify for better performance and schema-centric APIs.
- NestJS for a more opinionated module architecture.
- Native `ws` for lower-level WebSocket handling.

#### Trade-offs
- Express is flexible but less opinionated, so architecture discipline depends on the developer.
- Socket.IO is convenient but introduces abstraction overhead compared with raw WebSockets.

### Database
**Stack:** MongoDB with Mongoose.

#### Why chosen
- User, room, and canvas state documents fit naturally into a document database.
- Flexible nested structures are useful for strokes, stickers, and room metadata.
- Mongoose provides schema validation, indexes, and familiar document operations.

#### Alternatives
- PostgreSQL with normalized tables and JSONB.
- DynamoDB or Firestore for event/state storage.
- Redis for ephemeral room state.

#### Trade-offs
- MongoDB is convenient for nested canvas state, but concurrency and transactional modeling are less rigid than SQL.
- Large arrays of strokes may require further optimization as rooms grow.

### Realtime
**Stack:** Socket.IO rooms and shared event constants/types.

#### Why chosen
- Rooms map directly to collaborative room IDs.
- Automatic reconnection behavior helps real users recover from temporary network disruption.
- Shared event names/types reduce protocol drift.

#### Alternatives
- Native WebSockets with a custom protocol.
- WebRTC data channels for peer-to-peer collaboration.

#### Trade-offs
- Socket.IO is not the lightest protocol, but it dramatically lowers implementation complexity for room broadcasting, reconnect flows, and browser compatibility.

### Deployment
**Observed deployment shape:** frontend-oriented Vercel URLs and Render-style backend URL/fallback.

#### Why chosen
- Vercel aligns well with Next.js frontend hosting.
- Render fits a long-running Node/Express + Socket.IO server.

#### Alternatives
- Fly.io, Railway, AWS ECS, or DigitalOcean App Platform.
- Full containerized deployment with Kubernetes.

#### Trade-offs
- Splitting frontend and backend across hosts is common and simple, but requires careful CORS and environment management.
- Socket-heavy workloads may require more advanced infra planning as traffic scales.

---

## 4. SYSTEM ARCHITECTURE (VERY IMPORTANT)

### High-level flow
```text
[Browser / Next.js Client]
        |
        | REST (fetch)
        v
[Express API Layer] -----> [MongoDB via Mongoose]
        |
        | Socket.IO events
        v
[RoomManager in-memory collaboration state]
        |
        | broadcast updates
        v
[Connected clients in same room]
```

### Request flow
1. A user logs in, registers, browses rooms, edits profile data, or manages rooms via REST APIs.
2. The Express server validates payloads with Zod and auth middleware.
3. The server reads/writes MongoDB documents for users and persisted room metadata.
4. The frontend consumes JSON responses through a typed API wrapper.

### Response flow
1. The server returns normalized JSON payloads.
2. The client validates important room payloads using Zod.
3. The client updates local React state and session storage/local storage helpers.

### Realtime sync flow
1. The user enters a room page.
2. The client creates/connects a singleton Socket.IO client.
3. The client emits `room:join` with room ID, user ID, display name, and optional avatar URL.
4. The server validates the join payload.
5. The `RoomManager` adds the participant to in-memory room state.
6. The server emits room hydration, participants updates, and future stroke/chat/reaction/sticker events.
7. Each peer updates local state as events arrive.

### Persistence flow
```text
stroke start/append/end
    -> server validates
    -> in-memory RoomManager updated immediately
    -> server broadcasts realtime event
    -> RoomManager schedules debounced persistence
    -> MongoDB room.canvasState updated
```

### Conceptual room lifecycle diagram
```text
User creates room
   -> POST /api/rooms/create
   -> RoomManager.createRoom()
   -> optional Mongo Room.create()
   -> client navigates to /room/:roomId
   -> socket join handshake
   -> collaborative session begins
   -> state persists incrementally
```

### Architectural observations
- Room collaboration is optimized for responsiveness first through in-memory state.
- Persistence is secondary and debounced, reducing DB write frequency.
- Authentication and ownership are handled via REST + JWT.
- Shared contracts improve correctness between the frontend and backend.

---

## 5. FEATURE-BY-FEATURE DEEP EXPLANATION

### 5.1 Authentication

#### What exists
- Guest login.
- User registration.
- User login using email or username.
- Session recovery via `/api/auth/me`.
- Forgot-password OTP flow.
- Logout.

#### How it works internally
- Guest login issues a JWT containing a generated guest identity.
- User registration hashes passwords with bcrypt.
- Login verifies bcrypt password hashes.
- JWTs are stored client-side and attached as `Authorization: Bearer ...` headers.
- The server distinguishes `guest` vs `user` roles inside token payloads.

#### APIs involved
- `POST /api/auth/guest`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password/request`
- `POST /api/auth/forgot-password/verify-otp`
- `POST /api/auth/forgot-password/reset-password`

#### Data flow
- Client form -> REST request -> validation -> DB lookup/write -> JWT response -> local storage update -> auth context refresh.

#### Challenges faced
- Guest users need instant access without losing later ownership.
- Password reset requires secure verification without exposing raw OTPs.

#### How solved
- A guest token can be passed into register/login requests.
- The server migrates guest-owned or guest-joined room references to the newly authenticated user.
- OTP/reset tokens are hashed server-side before storage.

### 5.2 Guest-to-user migration

#### What it does
Allows users to start as a guest, create/join rooms, then register/login without losing room ownership and memberships.

#### Internal mechanism
- Server decodes the guest token.
- It finds rooms owned by the guest and updates owner fields.
- It also updates joined/created room arrays on the user document.

#### Why it matters
This is product-smart. It removes friction from onboarding while preserving continuity when a guest decides to create an account.

### 5.3 Room creation and joining

#### Features
- Public rooms.
- Private rooms with passwords.
- Join by room name or code.
- Duplicate room name prevention.

#### Internal behavior
- REST endpoint validates the request.
- Duplicate names are checked against persisted and in-memory room metadata.
- Private room passwords are hashed with bcrypt.
- Joining validates visibility and password if required.

#### Challenges
- A room can exist in both persisted storage and live memory.
- Join lookup needs to work by room ID or human-readable name.

#### Solution
The server resolves room metadata from MongoDB when available and falls back to in-memory metadata when needed.

### 5.4 Drawing system

#### Supported tools
- pen
- eraser
- fill
- line
- rectangle
- square
- circle
- ellipse
- triangle
- star

#### Internal working
- The canvas component captures pointer input.
- It converts pointer activity into logical board coordinates.
- Stroke events are emitted in three phases: start, append, end.
- The server validates strokes and appends them to room state.
- Other clients receive broadcast events and update their local stroke lists.

#### Shape handling
Shapes are encoded as `shape` metadata with `start`, `end`, and `kind`, rather than as dense freehand point arrays.

#### Fill handling
Fill strokes are modeled as a single logical point and rendered via flood-fill in the canvas renderer.

#### Challenges
- Freehand drawing and shapes need different data representations.
- Canvas rendering must remain smooth during live appends.

#### Solution
The shared stroke type supports both point-based and shape-based strokes. Client append events are buffered and flushed in batches to reduce rendering churn.

### 5.5 Chat system

#### What it does
Users in a room can send lightweight text messages.

#### Internals
- Chat messages are emitted via socket events.
- The server constructs authoritative message IDs and timestamps.
- RoomManager stores a bounded chat history in memory.
- Messages are broadcast to all clients in the room.

#### Limits
- Chat is in-memory only during live room lifecycle.
- It is intentionally capped to a max message count for bounded memory use.

### 5.6 Reactions and stickers

#### Reactions
Emoji reactions are transient events broadcast to the room.

#### Stickers
Sticker placement is persisted in room state and synchronized to all clients.

#### Why both exist
Reactions provide lightweight, ephemeral feedback. Stickers provide semi-persistent visual decoration on the board.

### 5.7 Realtime sync

#### Internals
- Room join triggers hydration.
- Stroke start/append/end updates flow through Socket.IO.
- Cursors are maintained per room in server memory.
- Board clear, mode changes, sticker placements, and chat all emit specific events.

#### Reliability measures
- Client reconnect handling via Socket.IO manager hooks.
- Room state re-request if append events arrive before base stroke hydration.
- Room version timestamps to avoid applying stale room snapshots.

### 5.8 Undo/Redo

#### How it works
- Undo is per-user, not global across all users.
- The server removes the last stroke belonging to that user.
- Removed strokes are pushed onto a redo stack by user.
- Redo restores the last removed stroke for that same user.

#### Challenges
In collaborative systems, global undo can become ambiguous and disruptive.

#### Solution
Per-user undo/redo avoids one participant accidentally rewinding another participant’s work.

### 5.9 Zoom, pan, and canvas handling

#### What exists
- Touch-friendly interactions.
- Pinch/pan support.
- Desktop panning support.
- Logical canvas size abstraction.

#### Why it matters
A fixed viewport collaborative canvas becomes unusable on smaller devices without navigation controls.

#### Likely design advantage
The logical drawing surface remains stable while the viewport transform changes, which simplifies stroke coordinate consistency across clients.

### 5.10 State management

#### Pattern used
- React local state for page/component state.
- Context for auth/session.
- Dedicated custom hook for room socket state.
- Session/local storage helpers for room hints, access grants, and guest names.

#### Why this is sufficient
The app has modular state domains, and each domain is scoped clearly enough that a heavyweight state library is not yet required.

---

## 6. DATABASE DESIGN

### Main collections
1. `users`
2. `rooms`

### User schema
Fields include:
- `username`
- `email`
- `password`
- `profileImage`
- `createdRooms`
- `joinedRooms`
- `resetCodeHash`
- `resetCodeExpiresAt`
- `resetSessionHash`
- `resetSessionExpiresAt`
- timestamps

### Room schema
Fields include:
- `roomId`
- `name`
- `visibility`
- `passwordHash`
- `ownerType`
- `ownerId`
- `ownerName`
- `lastActiveAt`
- `canvasState.strokes`
- `canvasState.stickers`
- `canvasState.lastSavedAt`
- `canvasState.version`
- `previewImageUrl`
- timestamps

### Relationships
- A user owns zero or more rooms through `ownerId` + `ownerType='user'`.
- A user references room IDs in `createdRooms` and `joinedRooms` arrays.
- Guest ownership is represented in room documents using `ownerType='guest'` and a guest ID.

### Example user document
```json
{
  "_id": "65f...",
  "username": "alice",
  "email": "alice@example.com",
  "password": "$2a$12$...",
  "profileImage": "https://res.cloudinary.com/...",
  "createdRooms": ["AB12CD"],
  "joinedRooms": ["ZX98QP"],
  "resetCodeHash": null,
  "resetCodeExpiresAt": null,
  "resetSessionHash": null,
  "resetSessionExpiresAt": null
}
```

### Example room document
```json
{
  "roomId": "AB12CD",
  "name": "Sprint Planning",
  "visibility": "private",
  "passwordHash": "$2a$10$...",
  "ownerType": "user",
  "ownerId": "65f...",
  "ownerName": "alice",
  "canvasState": {
    "strokes": [],
    "stickers": [],
    "lastSavedAt": "2026-03-22T00:00:00.000Z",
    "version": 3
  },
  "previewImageUrl": null
}
```

### Why this structure was chosen
- It is easy to persist nested canvas state in MongoDB.
- Room ownership works for both guest and authenticated users.
- User documents directly expose joined/created room references for profile/manage views.

---

## 7. API DESIGN

### Authentication endpoints
#### `POST /api/auth/guest`
Creates a guest token and guest identity.

#### `POST /api/auth/register`
Registers a user and optionally migrates guest data.

**Request**
```json
{
  "email": "user@example.com",
  "username": "newuser",
  "password": "strongpassword",
  "confirmPassword": "strongpassword",
  "guestToken": "optional",
  "guestDisplayName": "optional"
}
```

#### `POST /api/auth/login`
Logs in with username/email and password.

#### `GET /api/auth/me`
Returns current session user if token is valid.

#### `POST /api/auth/logout`
Client-side logout confirmation endpoint.

#### `POST /api/auth/forgot-password/request`
Starts OTP reset flow.

#### `POST /api/auth/forgot-password/verify-otp`
Exchanges OTP for a reset session token.

#### `POST /api/auth/forgot-password/reset-password`
Resets password using email + reset token.

### Profile endpoints
#### `GET /api/profile`
Returns authenticated user profile.

#### `PATCH /api/profile`
Updates username, email, and/or profile image.

#### `DELETE /api/profile/account`
Deletes account after explicit confirmation and password verification.

### Room endpoints
#### `POST /api/rooms/create`
Creates a room.

#### `POST /api/rooms/join`
Resolves and authorizes room entry.

#### `GET /api/rooms/browse?q=`
Lists active room metadata filtered by query.

#### `GET /api/rooms/manage`
Returns owned and joined rooms for the current user.

#### `PATCH /api/rooms/:roomId/settings`
Updates room name, visibility, and password.

#### `DELETE /api/rooms/:roomId`
Deletes a room if caller is owner.

#### `POST /api/rooms/:roomId/leave`
Removes joined-room association for the current user.

#### `GET /api/rooms/:roomId`
Loads room metadata for room entry flow.

### Authentication handling
- Optional auth is used on room-related endpoints to support guests.
- Required auth is enforced on profile endpoints.
- JWT verification happens in middleware.
- Registered-user-only actions reject guest tokens where appropriate.

---

## 8. REALTIME SYSTEM (IMPORTANT)

### How users sync
When a room page loads:
1. client connects socket,
2. emits `room:join`,
3. server adds participant,
4. server emits `room:joined`,
5. server updates all clients with participant list and cursor presence.

### How drawing sync works
1. Local user starts a stroke.
2. Client emits `stroke:start`.
3. Server validates and stores authoritative stroke with timestamp.
4. Server broadcasts `stroke:event` with start payload.
5. Client emits batched `stroke:append` events as drawing continues.
6. Server appends points and rebroadcasts append payloads.
7. `stroke:end` indicates stroke completion.

### How chat sync works
1. User emits `chat:send`.
2. Server validates message.
3. Server stamps ID/timestamp.
4. Server broadcasts `chat:message` to the whole room.

### How conflicts are handled
This app uses a pragmatic event-order approach rather than CRDTs:
- strokes are append-only once started,
- undo/redo is scoped per user,
- room hydration uses `updatedAt` checks to avoid stale overwrite,
- client requests fresh room state if append events arrive before base stroke state.

This is a sensible design for a drawing app where strict collaborative object editing is limited.

---

## 9. PERFORMANCE OPTIMIZATION

### Caching strategy
- Browse/manage/get-room fetches use `no-store` where freshness matters.
- Session and room hint data are cached in browser storage for UX continuity.

### Lazy loading / minimal loading
- Room entry uses a small metadata-first load and then socket hydration.
- The room page does not require the entire rest of the application state tree to initialize first.

### Optimistic UI
- Undo/redo is optimistic on the client.
- Room navigation uses remembered room hints and access grants to reduce repeated friction.

### Minimizing re-renders
- `useRoomSocket` batches stroke append points.
- Stroke index maps prevent repeated full scans for appends.
- Latest room version refs help avoid stale state replacement.

### Network optimization
- Debounced persistence avoids writing to MongoDB on every point append.
- Append payloads are limited in size and validated.
- Chat/sticker/reaction payloads are small and purpose-specific.

---

## 10. UI/UX DESIGN DECISIONS

### Why certain layouts were chosen
- Landing page separates discovery and action: create, join, browse, manage.
- Auth page clearly distinguishes login, registration, and password reset.
- Room page prioritizes the board while exposing collaboration tools, chat, and room utilities.

### Mobile responsiveness strategy
- The app adapts for coarse pointers and touch workspaces.
- The room experience includes touch-aware canvas controls.
- The UI uses compact modal/card patterns that fit small screens.

### Orientation handling
- Non-room routes enforce portrait mode behavior.
- Room routes manage their own orientation lifecycle and viewport CSS variables.
- This indicates intentional handling of mobile whiteboard ergonomics.

### User experience improvements
- Guest mode allows immediate entry.
- Private room access is remembered per session.
- User avatar menu adapts for guest vs authenticated states.
- Toasts, confirmation modals, and inline status banners improve feedback quality.

---

## 11. ISSUES FACED & SOLUTIONS

### 1. Orientation bugs on mobile
**Root cause:** drawing surfaces and browser chrome behavior often break viewport assumptions on mobile.

**Fix:** custom room orientation helpers manage fullscreen/orientation state, viewport CSS variables, and cleanup when leaving room routes.

### 2. Socket lag / out-of-order append events
**Root cause:** append payloads can arrive before base stroke hydration, especially during reconnects.

**Fix:** the client detects missing stroke IDs and requests full room state hydration.

### 3. Canvas scaling and cross-device consistency
**Root cause:** different device resolutions and pixel densities can distort drawing behavior.

**Fix:** the canvas uses a logical drawing surface with transform-based viewport behavior.

### 4. Undo conflicts in collaborative sessions
**Root cause:** global undo is ambiguous in a multi-user board.

**Fix:** undo/redo is user-scoped.

### 5. Guest identity continuity
**Root cause:** guest sessions often disappear or fracture when users later register.

**Fix:** guest tokens and room ownership migration preserve continuity.

### 6. Password reset security
**Root cause:** raw reset codes should not be stored or trusted indefinitely.

**Fix:** OTPs and reset session tokens are hashed and time-bound.

### 7. Room persistence without overloading DB writes
**Root cause:** writing every stroke point directly to MongoDB is wasteful.

**Fix:** the RoomManager debounces persistence.

### 8. Account deletion consistency
**Root cause:** deleting a user can orphan owned rooms and references in other users.

**Fix:** account deletion removes owned rooms, updates affected user references, emits room-expired events, and disconnects live participation.

---

## 12. SECURITY CONSIDERATIONS

### Auth security
- Passwords are hashed with bcrypt.
- JWTs distinguish user vs guest roles.
- Registered-user-only endpoints use strict auth middleware.

### Input validation
- Zod validates room IDs, room names, stroke payloads, chat payloads, cursor payloads, auth payloads, and profile payloads.

### API protection
- CORS is explicitly configured using normalized allowed origins and wildcard support.
- Sensitive profile/account operations require authenticated user tokens.

### Data privacy
- Password reset uses hashed OTP and reset session values.
- Profile image upload requires Cloudinary configuration.
- Password confirmation is required before account deletion.

### Remaining security improvements
- HTTP-only cookies would reduce token exposure compared with localStorage.
- Rate limiting should be added for login, guest issue, room create, and OTP endpoints.
- CSRF considerations become more important if cookie-based auth is adopted later.

---

## 13. SCALABILITY DISCUSSION

### What happens with 1000+ users?
At current scale, the architecture will work for small-to-moderate concurrency, but several pressure points appear:
- in-memory room state is process-local,
- Socket.IO rooms are local to one server instance,
- chat history is not persisted,
- Mongo stroke arrays may grow large,
- room browsing only reflects live in-memory room metadata.

### How to scale backend
- Introduce a Socket.IO Redis adapter so multiple Node instances can share room broadcasts.
- Move live room coordination into Redis or a dedicated realtime state layer.
- Separate REST/API and realtime workloads if needed.

### Load balancing ideas
- Use sticky sessions if WebSocket traffic remains instance-bound.
- Or centralize event propagation with Redis and remove strict stickiness dependence.

### DB scaling
- Split room metadata from large canvas event history.
- Store stroke event logs or snapshots separately.
- Use periodic board snapshots instead of only ever-growing arrays.
- Add indexes for room browse/search if persisted browse becomes primary.

### Product scaling strategy
For serious scale, a more event-sourced or CRDT-oriented collaboration model may be introduced, especially if object editing, full persistence, or replay is needed.

---

## 14. FUTURE IMPROVEMENTS

- AI-assisted sketch recognition or prompt-to-diagram features.
- Export board to image/PDF.
- Persistent chat history.
- Room invitations/share links.
- Offline sketch drafts and sync-on-reconnect.
- Redis-backed distributed room state.
- Role-based room permissions.
- Moderation tools for shared public rooms.
- Board templates and saved sessions.
- Better cleanup/expiration implementation tied to idle policy.

---

## 15. TOP 50 INTERVIEW QUESTIONS + ANSWERS

### 1. What is Froddle?
Froddle is a real-time collaborative whiteboard application where users can create or join public/private rooms, draw together, chat, react, and manage identities as guests or registered users.

### 2. What problem does it solve?
It reduces friction for browser-based visual collaboration by combining instant room-based entry with realtime sketching and account-backed persistence when needed.

### 3. Why did you use Next.js?
It provides production-grade React routing, app structure, metadata handling, and a clean foundation for a polished frontend experience.

### 4. Why did you use Express instead of a more opinionated backend framework?
Express was enough for a focused REST + Socket.IO server. It kept the backend lightweight while letting the realtime room logic stay explicit.

### 5. Why did you use Socket.IO instead of raw WebSockets?
Socket.IO gives rooms, reconnect behavior, transport fallbacks, and a simpler event model, which speeds up delivery for realtime collaboration.

### 6. Why MongoDB over SQL?
Room and canvas state naturally fit nested document structures, and Mongoose made it easy to model users and rooms with flexible embedded arrays.

### 7. How does realtime sync work?
Clients join a Socket.IO room, emit drawing/chat/cursor events, and the server updates in-memory room state before broadcasting the authoritative event to other participants.

### 8. Why keep room state in memory?
In-memory room state gives low-latency collaboration. Persisting every realtime action directly to the database would be slower and more expensive.

### 9. Why persist to MongoDB at all?
MongoDB provides durability for room metadata, auth, and canvas state snapshots so rooms and user ownership survive process restarts.

### 10. Why debounce persistence?
Drawing can generate many rapid point updates. Debouncing reduces write amplification while keeping persisted state reasonably fresh.

### 11. How do you validate incoming payloads?
I use Zod on the server for REST and socket payloads, and I also validate important responses on the client.

### 12. How do you secure passwords?
Passwords are hashed with bcrypt before storage.

### 13. How does forgot password work?
The server generates a 6-digit OTP, stores only its hash, emails it with Resend, verifies it, then issues a time-limited reset session token whose hash is also stored server-side.

### 14. Why hash OTPs too?
If the database is exposed, raw OTPs should not be readable. Hashing them reduces that risk.

### 15. How are guest users handled?
Guests receive a JWT with a generated guest identity and can use most room features without a formal account.

### 16. What happens when a guest later registers?
The server migrates guest-owned rooms and joined-room references to the new registered account.

### 17. Why is that migration valuable?
It removes onboarding friction while preserving user continuity.

### 18. How are private rooms secured?
Private rooms store hashed passwords and require password verification during join.

### 19. Can guests create private rooms?
Yes. Ownership can belong to either a guest or a registered user.

### 20. How do you manage room ownership?
Rooms store `ownerType`, `ownerId`, and `ownerName`, which supports both guest and registered ownership models.

### 21. How do you prevent duplicate room names?
The create/update flows resolve room metadata against persisted and in-memory room sources before accepting a name.

### 22. How are strokes represented?
Each stroke has metadata such as tool, color, size, user ID, points, timestamp, and optional shape definition.

### 23. How do shape tools differ from pen strokes?
Shape tools use a `shape` object with start/end geometry instead of a dense sequence of freehand points.

### 24. How is the fill tool implemented?
The fill tool is modeled as a stroke with a single point and rendered via flood-fill in the canvas renderer.

### 25. How do you handle cursor sync?
The server tracks current cursor payloads by room and broadcasts updates/presence lists to connected users.

### 26. How do you avoid stale room state on reconnect?
The client tracks a latest room version timestamp and ignores stale hydration. It can also request full room state if append events arrive before the base stroke exists locally.

### 27. Why not use CRDTs?
The current collaboration model is simpler: append-only strokes, room hydration, and per-user undo/redo. CRDTs are powerful, but unnecessary complexity for this feature scope.

### 28. How is undo/redo implemented?
Undo removes the last stroke for the requesting user, stores it in that user’s redo stack, and redo restores it.

### 29. Why per-user undo instead of global undo?
Global undo is confusing in multi-user collaboration because one person could accidentally revert someone else’s work.

### 30. How does chat work?
Chat messages are validated, timestamped, stored in a bounded in-memory list, and broadcast to all room participants.

### 31. Are chat messages persisted?
Not currently. They are scoped to the live room session in memory.

### 32. How do profile images work?
The client uploads a data URI through the profile API, and the server uploads it to Cloudinary when configured.

### 33. What happens on account deletion?
The system deletes the user, deletes owned rooms, removes references from other users, emits room-expired events, and cleans up live participation.

### 34. How is CORS handled?
Allowed client origins are parsed from environment variables, normalized, and matched against exact or wildcard patterns.

### 35. How do you handle offline or reconnect scenarios?
Socket.IO reconnection is enabled. The client transitions between connecting/reconnecting/disconnected states and re-emits room join after reconnect.

### 36. How do you manage frontend state without Redux?
State is scoped: auth context for session, custom socket hook for room collaboration, and local component state for UI concerns.

### 37. Why a monorepo?
The monorepo keeps client, server, and shared contracts aligned, reduces duplication, and simplifies workspace builds.

### 38. Why a shared package?
It gives one source of truth for socket event names and shared room/canvas types.

### 39. What is the biggest architectural strength of this project?
It cleanly combines REST, realtime collaboration, typed contracts, guest/auth flows, and persistence in a cohesive product.

### 40. What is the biggest architectural limitation right now?
Realtime state is process-local, so horizontal scaling requires additional infrastructure such as Redis.

### 41. How would you scale to multiple server instances?
I would introduce the Socket.IO Redis adapter and externalize active room coordination/state.

### 42. How would you improve persistence for large rooms?
I would move from large embedded arrays toward snapshots + event logs or chunked stroke storage.

### 43. Why store room metadata separately from live state?
It allows the live room experience to remain fast while still keeping durable identifiers, ownership, and saved board state.

### 44. How do you support mobile devices?
The room page includes touch-aware viewport logic, orientation handling, and panning/zoom support.

### 45. What performance decisions did you make on the client?
I batched append updates, used refs/maps for stroke indexing, and avoided stale hydration overwrites.

### 46. What security improvements would you make next?
Rate limiting, HTTP-only cookie auth, audit logging, stronger abuse prevention for OTP endpoints, and stricter upload constraints.

### 47. How would you test this system?
Unit tests for validators and auth utilities, integration tests for REST routes, socket event flow tests, and end-to-end tests for create/join/draw/auth flows.

### 48. What kind of product can this architecture evolve into?
It could evolve into a collaborative teaching board, lightweight multiplayer design whiteboard, or team brainstorming tool.

### 49. What did you learn from building it?
How to coordinate REST and realtime patterns, manage guest-to-user transitions, design for mobile collaboration, and build practical synchronization without overengineering.

### 50. If you had more time, what would you build next?
Redis-backed scaling, persistent chat, export/import, richer object editing, and AI-assisted board features.

---

## 16. RAPID-FIRE INTERVIEW EXPLANATION

### Explain your project in 30 seconds
Froddle is a real-time collaborative whiteboard built with Next.js, Express, Socket.IO, and MongoDB. Users can join as guests or registered accounts, create public/private rooms, draw together live, chat, send reactions, and manage rooms and profiles. I used a shared TypeScript contract package so the client and server stay aligned.

### Explain in 2 minutes
Froddle is a room-based collaborative drawing platform. The frontend is a Next.js app that handles auth, room creation/join flows, browsing, profile management, and a touch-friendly canvas UI. The backend is an Express + Socket.IO server. REST APIs handle authentication, profile operations, and room management, while Socket.IO handles live room participation, drawing, chat, reactions, stickers, and cursor updates.

The interesting architectural choice is that live room state is stored in memory for responsiveness, while MongoDB stores durable user data and room metadata plus debounced snapshots of strokes and stickers. It also supports guest users, and if a guest later signs up or logs in, their room ownership and room associations are migrated to the registered account. I also implemented OTP-based password reset, Cloudinary-backed profile uploads, and per-user undo/redo to keep collaboration intuitive.

### Explain in 5 minutes
Froddle is designed as a practical realtime collaboration product instead of just a canvas demo. It has three workspaces in a monorepo: a Next.js client, an Express/Socket.IO server, and a shared package for typed contracts. On the frontend, I use React state, an auth provider, and a dedicated room socket hook to manage collaboration lifecycle. The room page provides drawing tools, shape tools, fill, zoom/pan, chat, reactions, participant presence, and mobile-aware orientation handling.

On the backend, REST endpoints cover guest login, registration, login, session recovery, password reset, profile update, account deletion, room creation/joining, room browsing, and room settings. For realtime collaboration, users connect over Socket.IO and join a room. The server validates every socket payload, updates the in-memory room state, and broadcasts events. To balance performance and durability, room state is persisted to MongoDB using debounced writes rather than writing every point immediately.

A design decision I’m proud of is guest-to-user migration. Many apps either force login too early or lose continuity when a guest converts. Here, a guest can create rooms first and still preserve ownership later. Another good decision is per-user undo/redo, which avoids collaborative conflicts. If I scaled this further, I would add Redis-backed Socket.IO coordination, better board snapshotting, persistent chat, and stronger rate limiting/security hardening.

---

## 17. CODE WALKTHROUGH GUIDE

### How to explain the code to an interviewer
Start from architecture, then walk the request path, then walk the realtime path.

### Recommended file order to show
1. `package.json` at repo root
   - Explain workspace structure.
2. `shared/types/socket.ts`, `shared/types/room.ts`, `shared/types/canvas.ts`
   - Show the contract-first design.
3. `server/src/index.ts`
   - Explain how Express and Socket.IO are wired.
4. `server/src/rooms/roomManager.ts`
   - Show the heart of collaboration state.
5. `server/src/socket/registerHandlers.ts`
   - Show realtime event flow.
6. `server/src/routes/auth.ts`
   - Show auth, OTP reset, and guest upgrade flow.
7. `server/src/routes/rooms.ts`
   - Show public/private room lifecycle.
8. `server/src/routes/profile.ts`
   - Show profile update and account deletion strategy.
9. `client/lib/api.ts`
   - Show typed frontend API access.
10. `client/components/auth-provider.tsx`
    - Explain session handling.
11. `client/hooks/use-room-socket.ts`
    - Explain client-side realtime state handling.
12. `client/components/canvas-board.tsx`
    - Explain drawing/rendering logic.
13. `client/app/room/[roomId]/page.tsx`
    - Explain how UI, auth, room entry, and realtime collaboration come together.

### Flow explanation to narrate
#### Auth flow
- Show auth provider -> API functions -> auth routes -> token issuance.

#### Room creation/join flow
- Show home page -> API create/join -> room route -> socket join.

#### Drawing flow
- Show canvas-board pointer handling -> socket event -> server validation -> RoomManager update -> broadcast -> peer UI update.

#### Persistence flow
- Show RoomManager debounced persist callback -> Mongo room update.

### What to emphasize in interviews
- clear separation of concerns,
- shared contracts,
- mixed REST + realtime architecture,
- guest-to-user migration,
- mobile/orientation handling,
- per-user undo/redo,
- and the scalability path beyond the current design.
