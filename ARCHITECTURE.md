# Astryon Architecture

This document explains how Astryon is put together so another engineer or chatbot can reason accurately about the system.

## System Summary

Astryon is a Next.js app that represents knowledge as 3D universes. A universe has one or more root **nexuses** and many child **nodes**. Users can create these universes manually, through AI, from imported conversations, from JSON academic papers, or from generated course content. The core app experience is a Three.js canvas plus a rich modal for reading, editing, chatting, quizzing, and atomizing nodes.

The main architecture is:

```text
Next.js app
  app routes
  API routes
  React components
  Zustand store
    current canvas state
    universe library
    persistence orchestration
    learning/practice state
  browser storage
    IndexedDB
    localStorage
  optional cloud storage
    NeonDB via Prisma
    Vercel Blob

Express/Socket.IO server
  realtime collaboration events
  legacy/backend chat support
```

## Directory Map

```text
app/
  page.tsx                       landing page
  chat/page.tsx                  main 3D canvas route
  create/page.tsx                blank canvas route
  explore/page.tsx               JSON/import route
  memories/page.tsx              universe library
  course-builder/page.tsx        course creation workflow
  api/
    chat/route.ts                main AI mode router
    analyze-video/route.ts       Gemini video analysis
    export-universe/route.ts     markdown/structured export
    extract-text/route.ts        document extraction
    generate-title/route.ts      semantic titles
    upload/route.ts              Vercel Blob upload handler
    universes/route.ts           cloud universe persistence
    auth/                        NextAuth routes

components/
  CanvasScene.tsx                main 3D scene
  UnifiedNodeModal.tsx           main node/nexus modal
  SectionNavigator.tsx           tree/nav/sidebar and drag/reparent
  ApplicationLabScene.tsx        full-screen application lab wrapper
  CreateNexusModal.tsx           create/import prompt UI
  ExportModal.tsx                export UI
  ApplicationEssaySection.tsx    application essay UI

lib/
  store.ts                       central Zustand store
  types.ts                       shared domain types
  db.ts                          Dexie + cloud persistence helpers
  gemini.ts                      Gemini/Anthropic helper calls
  search.ts                      Tavily search wrapper
  nodePositioning.ts             L1/L2/meta positioning helpers
  fibonacciLayout.ts             spatial layout helpers
  useCameraAnimation.ts          selected-node camera motion
  useNexusEvolution.ts           automatic nexus summary evolution
  useNexusApplicationLabEvolution.ts
  studyGuideGenerator.ts         run-to-study-guide generation
  guidedPracticeHelpers.ts       practice bundle helpers
  conversationTransformer.ts     extension import conversion
  exportToWord.ts / exportToPDF.ts

server/
  server.js                      Express + Socket.IO backend
  websocket.js                   websocket helper

prisma/
  schema.prisma                  user/session/universe models

Astryon_Extension/
  Chrome extension files for conversation/highlight import
```

## Runtime Flows

### 1. Opening The App

Most routes start with a blank canvas. Saved universes are loaded from `/memories`, not automatically rendered on every app load.

`app/chat/page.tsx` renders:

```text
Navigation
CanvasScene
useNexusEvolution()
useNexusApplicationLabEvolution()
```

`CanvasScene` renders the 3D canvas and also mounts `UnifiedNodeModal` and `SectionNavigator`.

### 2. Creating A Universe

Typical flow:

```text
CreateNexusModal or API result
  -> useCanvasStore.createNexus(...)
  -> set nexuses = [newNexus]
  -> activeUniverseId = new nexus id
  -> saveCurrentUniverse()
  -> optional Socket.IO broadcast
```

AI-generated spatial universes use `POST /api/chat` with `mode: 'spatial'`. The response contains `spatialData`, which is then converted into a nexus and nodes.

### 3. Adding Nodes

`addNode(content, parentId, quotedText?, nodeType?, explicitSiblingIndex?)`:

1. Generates a node ID.
2. Determines whether the parent is a nexus, node, or meta-inspiration node.
3. Computes a 3D position using:
   - `calculateL1Position`
   - `calculateL2Position`
   - `calculateMetaPosition`
4. Adds the node to `nodes`.
5. Updates the parent node's `children` if applicable.
6. Repositions siblings.
7. Broadcasts through Socket.IO if available.
8. Generates a semantic title asynchronously.

Important: `addNode` does not always save the whole universe immediately; newer flows depend on `saveCurrentUniverse`.

### 4. Opening A Nexus Or Node

Clicking a 3D item calls `selectNode(id, showOverlay)`, which sets:

```ts
selectedId
showContentOverlay
isAnimatingCamera
```

`UnifiedNodeModal` reads `selectedId` and decides whether it is showing:

- a nexus
- a normal node
- a connection node
- a threaded node
- an application-lab nexus

Threaded nodes use `node.messages`. Legacy nodes without messages are lazily represented as one message via `getNodeMessages`.

### 5. In-Node Chat

For threaded nodes:

```text
textarea submit
  -> addMessageToNode(nodeId, { role: 'user' | 'note' | 'assistant', content })
  -> fetch /api/chat with context
  -> stream or receive AI response
  -> updateMessageInNode during stream
  -> saveCurrentUniverse after completion
```

The node content may be updated to a preview of the latest user message for search/labels.

### 6. Atomizing Text

The modal supports marking selected text with internal atomize markers and creating child nodes from marked ranges. The store records parent-to-child atomized ranges on either a node or nexus:

```ts
atomizedRanges?: Array<{ text: string; childNodeId: string }>
```

Memories also has a separate universe-level `atomizeUniverse(universeId)` flow that breaks each L1 node into a new universe by calling `/api/chat` with `mode: 'break-off'`.

### 7. Course Builder

`app/course-builder/page.tsx` builds a course through steps:

1. Basic info and optional AI video import.
2. Course content, video file, timestamps, section contents.
3. Settings.
4. Review.
5. Generated questions.
6. Application essay.

Video analysis flow:

```text
client upload to Vercel Blob
  -> /api/analyze-video receives blobUrl
  -> route downloads blob to temp file
  -> Gemini File API analyzes video
  -> returns title, description, fullTextContent, timestamps, sectionContents
  -> temp file and blob cleaned up
```

Course generation flow:

```text
createNexus(course title, full text, videoUrl)
  -> add L1 section nodes with videoStart/videoEnd
  -> attach generated mcqQuestions and shortAnswerQuestions
  -> optionally create doctrine/practice child nodes from atomizationBlueprint
  -> mark saved universe as courseMode
  -> saveToLocalStorage()
```

Known issue: the UI calls `/api/chat` with `mode: 'atomize-content'`, but an explicit matching route branch was not found in the current `app/api/chat/route.ts`.

### 8. Application Lab

There are two related Application Lab concepts:

1. **Nexus evolution** through `useNexusApplicationLabEvolution`.
   - Watches nexuses with `needsApplicationLab`.
   - Calls `/api/chat` with `mode: 'nexus-application-lab'`.
   - Stores `applicationLabConfig` on the nexus.

2. **Full-screen Application Lab mode** through `ApplicationLabScene`.
   - Calls `analyzeUniverseContent`.
   - Uses `/api/chat` with `mode: 'analyze-universe'`.
   - Extracts topics, examples, principles.
   - Can generate essay questions and grade essays.

These are related but not fully unified.

### 9. Memories And Persistence

`/memories` loads stored data using `loadFromLocalStorage()`, then displays universes grouped by folder.

Storage layers:

```text
IndexedDB
  universes
  backups
  videos

localStorage
  aurora-portal-data
    universeLibrary
    originalSnapshots
    folders
    activatedConversations
    timestamp

Cloud
  /api/universes
  Prisma Universe model
```

`saveToLocalStorage()` currently:

1. Verifies the store is initialized.
2. Backs up existing library.
3. Refuses dangerous empty overwrites.
4. Writes `aurora-portal-data`.
5. Saves each universe to IndexedDB.
6. Attempts cloud save for each universe.
7. Creates periodic backups.

## AI Modes

Primary AI entrypoint: `app/api/chat/route.ts`.

Detected explicit modes:

- `spatial`
- `break-off`
- `deep-thinking`
- `quiz`
- `quiz-mc`
- `quiz-short-answer`
- `analyze-universe`
- `application-scenario`
- `application-grade`
- `application-essay`
- `grade-application-essay`
- `grade-essay-basic`
- `essay-question`
- `intuition-question`
- `nexus-summarize`
- `nexus-application-lab`
- `doctrine`
- `ask-with-search`
- default standard chat

Frontend code also references:

- `standard`
- `synthesis`
- `connection`
- `atomize-content`

Before modifying one of these, verify whether the route has a corresponding branch or whether it falls through to standard chat.

Provider behavior:

- Anthropic is attempted first when `ANTHROPIC_API_KEY` exists.
- OpenAI fallback is used when Anthropic fails and `OPENAI_API_KEY` exists.
- Gemini is used for video/file analysis and fast preprocessing helpers.
- Tavily is used in `ask-with-search` when configured.

## 3D Positioning Model

Positioning helpers live in `lib/nodePositioning.ts`.

- L1 nodes orbit their nexus.
- L2+ nodes are positioned relative to parent node and root nexus.
- Meta-inspiration children use a distinct vertical/spiral layout.
- Siblings are repositioned when a node is added or reparented.
- Connection nodes are placed between referenced nodes with an upward offset.

The scene animates mesh positions toward store positions and stores current animated positions in a module-level `animatedPositions` map for connection line rendering.

## Realtime Collaboration

`CanvasScene` connects to:

```ts
io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001')
```

It joins `default-portal` and listens for:

- `nodeCreated`
- `nexusCreated`

The backend `server/server.js` handles Socket.IO rooms and broadcasts. Its persistence is in-memory/demo-style. Most durable persistence is client/cloud-side in the Next app.

## Export System

`/api/export-universe` reconstructs a tree from nexus and node data, then returns:

- `markdown`
- `structured`

Client helpers:

- `lib/exportToWord.ts`
- `lib/exportToPDF.ts`
- `store.exportToWordDoc()`

The current export route always generates a literal hierarchical tree first. It contains an analysis prompt helper, but the primary visible path is tree export.

## Tests

Test command:

```bash
npm run test
```

Current tests:

- `lib/__tests__/studyGuideGenerator.test.ts`
- `lib/__tests__/universeRunLifecycle.test.ts`

These focus on learning run lifecycle and study guide generation.

## Known Risks And Advice For Future Changes

1. **Do not casually refactor `lib/store.ts`.**
   It is the central integration point for state, persistence, backups, cloud sync, layout, and learning state.

2. **Be careful with saves.**
   Some flows call `saveToLocalStorage`; others call `saveCurrentUniverse`. Using the wrong one can save incomplete universes or fail to update the library.

3. **AI JSON parsing is fragile.**
   Many flows ask models to return JSON and then clean it with string/regex logic. Prefer schema validation and structured parsing for new AI features.

4. **Cloud and local data can diverge.**
   `loadFromLocalStorage` merges cloud universes into local IndexedDB-loaded universes. Conflict resolution is currently simple.

5. **Generated/worktree files can affect lint.**
   `npm run lint` may report pre-existing issues unrelated to a change, including files under generated or worktree paths.

6. **Application Lab has overlapping implementations.**
   Decide whether a feature belongs to nexus evolution, full-screen lab mode, or both.

7. **Socket.IO is not the source of truth.**
   Treat realtime events as collaboration/UI updates, not durable persistence.

8. **Modal changes have broad UX impact.**
   `UnifiedNodeModal.tsx` handles many modes. Test nexus, normal node, threaded node, quiz, guided practice, and delete confirmation after layout changes.

## Good Next Architectural Refactors

- Extract `/api/chat` mode handlers into a prompt registry.
- Extract persistence from `lib/store.ts` into a dedicated service.
- Add schema validation for AI responses.
- Add a semantic index over nodes/universes for cross-universe search.
- Unify Application Lab evolution and full-screen Application Lab mode.
- Add a formal command palette for node actions.
- Add stronger tests around save/load/migration and AI response parsing.
