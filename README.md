# Astryon

Astryon is a 3D spatial learning and conversation system. It turns conversations, course material, academic papers, video segments, and AI-generated study structures into interactive 3D "universes" made of root hubs called **nexuses** and child **nodes**.

This README is written so a human or chatbot can quickly understand the system and give accurate advice.

## What Astryon Does

- Creates 3D knowledge graphs from free-form prompts, structured text, imported conversations, uploaded JSON papers, and course-builder content.
- Lets users open any nexus or node in a large modal, edit content, chat inside nodes, atomize highlighted text into child nodes, quiz themselves, and generate AI practice flows.
- Stores universes locally in IndexedDB and localStorage, with optional cloud sync through Neon/Postgres.
- Supports a Memories library with folders, backup recovery, multi-universe activation, universe atomization, and direct loading into the 3D canvas.
- Supports course creation from text, timestamps, questions, essays, and video uploads.
- Supports an Application Lab mode for extracting topics, examples, principles, essay prompts, and feedback from a universe.
- Includes an extension import flow under `Astryon_Extension/` for importing conversations/highlights into `/explore`.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- 3D: React Three Fiber, Drei, Three.js
- State: Zustand in `lib/store.ts`
- Persistence: IndexedDB via Dexie, localStorage, optional NeonDB through Prisma
- Auth: NextAuth with Prisma adapter
- Storage: Vercel Blob for uploaded media
- AI: Anthropic, OpenAI fallback, Gemini for video/file/text preprocessing
- Realtime: Socket.IO backend in `server/server.js`

## Main Commands

```bash
npm run dev        # Start Next.js frontend on http://localhost:3000
npm run build      # prisma generate && next build
npm start          # Start production frontend
npm run lint       # Run ESLint
npm run test       # Run AI, Cartographer, persistence, study-guide, and lifecycle tests
npm run typecheck  # Run TypeScript without emitting files
```

Backend:

```bash
cd server
npm run dev        # Start Socket.IO/API server on http://localhost:3001
npm start
```

For full local functionality, run both frontend and backend.

## Important Environment Variables

Frontend `.env.local`:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_CARTOGRAPHER_ENABLED=true
CARTOGRAPHER_ENABLED=true
BLOB_READ_WRITE_TOKEN=
TAVILY_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
```

Backend `server/.env`:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
CLIENT_URL=http://localhost:3000
PORT=3001
```

Do not commit real secrets.

## Important Routes

- `/` - Landing page.
- `/chat` - Main 3D conversation/universe canvas.
- `/create` - Blank 3D canvas using `CanvasScene`.
- `/explore` - Academic paper/conversation import flow. Handles extension imports from localStorage.
- `/memories` - Universe library, folders, restore backups, atomize universes, load universes.
- `/course-builder` - Multi-step course creation with video analysis, timestamps, generated quizzes, essays, and spatial course output.
- `/login` and `/auth/signin` - Authentication UI.

## Important API Routes

- `POST /api/chat` - Main AI route. Handles most AI modes.
- `POST /api/generate-title` - Generates semantic node titles.
- `POST /api/analyze-video` - Fetches an uploaded blob, sends it through Gemini File API, returns course structure JSON.
- `POST /api/export-universe` - Produces markdown/structured export data from a universe.
- `POST /api/extract-text` - Extracts text from uploaded documents.
- `POST /api/upload` - Vercel Blob client upload handler.
- `GET/POST /api/universes` - Cloud save/load for authenticated users.
- Auth routes live under `app/api/auth`.

## Core Data Model

Types are in `lib/types.ts` and `lib/store.ts`.

### Nexus

A nexus is the root of a universe:

```ts
interface Nexus {
  id: string;
  position: [number, number, number];
  title: string;
  content: string;
  videoUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  type?: 'academic' | 'social';
  applicationEssay?: ApplicationEssay;
  atomizedRanges?: Array<{ text: string; childNodeId: string }>;
  evolutionState?: 'seed' | 'growing' | 'application-lab';
  originalContent?: string | null;
  applicationLabConfig?: ApplicationLabConfig | null;
  needsApplicationLab?: boolean;
}
```

### Node

A node is any child idea/message/practice item:

```ts
interface Node {
  id: string;
  position: [number, number, number];
  title: string;
  content: string;
  parentId: string;
  children: string[];
  quotedText?: string;
  isAI?: boolean;
  isConnectionNode?: boolean;
  isSynthesis?: boolean;
  connectionNodes?: string[];
  nodeType?: NodeType;
  semanticTitle?: string;
  isAnchored?: boolean;
  isLocked?: boolean;
  isCompleted?: boolean;
  videoUrl?: string | null;
  videoStart?: number | null;
  videoEnd?: number | null;
  mcqQuestions?: MCQ[];
  shortAnswerQuestions?: ShortAnswer[];
  practiceSteps?: Array<...>;
  messages?: ThreadMessage[];
}
```

Common `nodeType` values:

- `user-reply`
- `ai-response`
- `socratic-question`
- `socratic-answer`
- `inspiration`
- `synthesis`
- `doctrine`
- `intuition-example`
- `model-answer`
- `imitate`
- `quiz-mc`
- `quiz-short-answer`
- `application-scenario`

## State Management

The central store is `lib/store.ts`. It owns:

- current canvas state: `nexuses`, `nodes`, `selectedId`
- universe library: `universeLibrary`
- active universe IDs for multi-universe canvas loading
- folders
- snapshots/backups/recovery
- in-node message threads
- connection nodes
- application lab state
- universe runs and study guides

Key actions:

- `createNexus`
- `addNode`
- `addNodes`
- `updateNode`
- `updateNodeContent`
- `updateNexusContent`
- `addMessageToNode`
- `breakOffFromNode`
- `createConnection`
- `createMultiConnection`
- `createMetaInspirationNode`
- `reparentNode`
- `deleteNode`
- `saveCurrentUniverse`
- `loadUniverse`
- `loadMultipleUniverses`
- `saveToLocalStorage`
- `loadFromLocalStorage`
- `atomizeUniverse`
- `startUniverseRun`
- `completeUniverseRun`
- `resetUniverseForPractice`

## 3D UI

Main file: `components/CanvasScene.tsx`.

It renders:

- nexuses as central spheres
- nodes as colored rotating shapes
- connection nodes as golden rotating dodecahedrons
- parent-child lines and connection lines
- selected/anchored visual effects
- camera controls and camera-position persistence
- `UnifiedNodeModal`
- `SectionNavigator`
- `ApplicationLabScene` wrapper when lab mode is active

Modal logic lives in `components/UnifiedNodeModal.tsx`. That component is large and handles:

- nexus/node display
- content editing
- in-node chat threads
- streaming AI replies
- note mode
- atomizing selected text
- quizzes
- guided practice
- connection analysis
- deletion
- study-guide viewer
- practice completion
- application-lab nexus rendering

## Persistence

Primary persistence layers:

- IndexedDB via Dexie in `lib/db.ts`
- legacy localStorage key: `aurora-portal-data` (kept intentionally so existing users do not lose data)
- optional cloud persistence through `/api/universes` and Prisma/NeonDB
- Vercel Blob for uploaded video/media

The store has significant defensive code to prevent overwriting non-empty libraries with empty data. It also installs browser debug helpers under `window.auroraDebug`.

## Known Architectural Notes

- `lib/store.ts` is very large and mixes app state, persistence, migration, debug logging, cloud sync, and domain logic.
- `/api/chat/route.ts` is also very large and has many mode-specific prompt branches.
- Several save paths still call `saveToLocalStorage()` directly while newer flows prefer `saveCurrentUniverse()`.
- Course builder sends `mode: 'atomize-content'`, but the current `/api/chat/route.ts` scan does not show a matching explicit branch for that mode. Treat that as a likely bug or unfinished feature.
- Cartographer can be disabled independently with `NEXT_PUBLIC_CARTOGRAPHER_ENABLED=false` and `CARTOGRAPHER_ENABLED=false`.
- Lint passes with warnings; CI treats lint errors, type errors, test failures, and build failures as release blockers.

For deeper system details, read `ARCHITECTURE.md`.
