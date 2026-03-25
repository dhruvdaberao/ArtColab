# Froodle

A professional, real-time collaborative whiteboard platform where teams and guests can create rooms, sketch together, chat live, react instantly, and manage shared creative spaces.

## Live Demo

- **Frontend Application:** [https://froodle.vercel.app](https://froodle.vercel.app)
- **Backend API Health:** `https://artcolab-1.onrender.com/health`

## Features

### 🤝 Real-Time Collaboration
- Instant multi-user drawing synchronized via Socket.IO.
- Live participant presence and real-time cursor tracking.
- In-room chat, emoji reactions, and interactive sticker placements.
- Shared room modes including `free-draw` and `guess-mode`.

### 🎨 Advanced Drawing Experience
- Fluid freehand pen and eraser tools.
- Smart fill bucket for closed regions.
- Versatile shape tools including line, rectangle, square, circle, ellipse, triangle, and star.
- Multiple brush styles: classic, crayon, neon, dotted, and spray.
- Per-user undo/redo with optimistic client-side updates.
- Infinite canvas feel with pan and zoom support across desktop and touch devices.

### 🛡️ Room & Access Management
- Seamlessly transition between public and password-protected private rooms.
- Centralized dashboard to manage owned and joined rooms.
- Guest sessions for low-friction collaboration, with seamless upgrade paths to full user accounts.
- JWT-based persistent authentication.
- Forgot-password flow via OTP email verification.
- Profile editing with Cloudinary-hosted profile images.

### ⚡ Technical Excellence
- **Frontend:** Built with Next.js 14 (App Router), React 18, TypeScript, and Tailwind CSS.
- **Backend:** Node.js, Express, Socket.IO, and TypeScript.
- **Database:** MongoDB via Mongoose for robust data persistence.
- Monorepo architecture efficiently separating `client`, `server`, and `shared` types for unified contracts.

## Getting Started

### Prerequisites
- Node.js installed on your local machine.
- MongoDB instance (local or Atlas).

### Installation

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Configure your environment by duplicating the example files:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env.local
   ```
   *Note: Ensure all required keys (MongoDB URI, JWT Secret, Cloudinary credentials, etc.) are populated.*

3. **Start the Development Servers**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Frontend is available at: `http://localhost:3000`
   - Backend API is running at: `http://localhost:4000`

### Production Build
To create an optimized production build:
```bash
npm run build
```

## Architecture

Froodle utilizes a modern monorepo structure:
- **/client**: The Next.js frontend handling UI, state, and socket communication.
- **/server**: Express and Socket.IO backend managing business logic, real-time broadcasting, and MongoDB persistence.
- **/shared**: Type definitions and event contracts ensuring type-safety across the network boundary.
