# Aurora

A 3D spatial conversation and knowledge visualization platform built with Next.js, React Three Fiber, and Socket.IO.

## Prerequisites

- Node.js 18+
- npm

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd aurora-v2
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 3. Set up environment variables

**Frontend** - Create `.env.local` in the project root:

```bash
# Required - get from project owner
ANTHROPIC_API_KEY=your-anthropic-api-key

# Required - get from project owner
DATABASE_URL=your-neon-database-url

# Authentication
AUTH_SECRET=generate-with-openssl-rand-base64-32
AURORA_PASSWORD=your-secure-password

# Backend URL (use localhost for local dev)
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

**Backend** - Create `.env` in the `server/` directory:

```bash
# Required - get from project owner
ANTHROPIC_API_KEY=your-anthropic-api-key

# CORS - frontend URL(s), comma-separated for multiple
CLIENT_URL=http://localhost:3000

# Optional - defaults to 3001
PORT=3001
```

### 4. Run the servers

Open two terminal windows:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd server
npm run dev
```

### 5. Open in browser

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |

## Environment Variables Summary

| Variable | Location | Required | Get From |
|----------|----------|----------|----------|
| `ANTHROPIC_API_KEY` | Both | Yes | Project owner |
| `DATABASE_URL` | Frontend | Yes | Project owner (NeonDB) |
| `AUTH_SECRET` | Frontend | Yes | Generate: `openssl rand -base64 32` |
| `AURORA_PASSWORD` | Frontend | Yes | Set your own |
| `NEXT_PUBLIC_SERVER_URL` | Frontend | Yes | `http://localhost:3001` for local |
| `CLIENT_URL` | Backend | Yes | `http://localhost:3000` for local |
| `PORT` | Backend | No | Defaults to 3001 |

## Tech Stack

- **Frontend**: Next.js 15, React 19, React Three Fiber, Tailwind CSS, Zustand
- **Backend**: Express 5, Socket.IO
- **Database**: NeonDB (Serverless Postgres) via Prisma
- **Storage**: Vercel Blob
- **AI**: Anthropic Claude API
