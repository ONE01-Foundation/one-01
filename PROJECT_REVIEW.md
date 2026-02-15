# ONE-01 Project Review

**Purpose:** Structure, infrastructure, product understanding, and open questions.  
**Language:** English (as requested).

---

## 1. Project structure

### Repo layout

```
one-01/
├── App.tsx                 # Entry: theme + loading init → LoadingScreen or MainApp
├── index.ts                 # Registers App with Expo
├── app.json                 # Expo config (env placeholders)
├── package.json             # Expo app deps
├── one-01-backend/          # Separate Node server (Socket.io + OpenAI)
└── src/
    ├── screens/             # LoadingScreen, MainApp
    ├── stores/              # themeStore, loadingStore + (unused) agent, conversation, ui, connection
    ├── utils/               # theme, session, constants
    ├── types/               # Lens, Protocol, Agent, Conversation, UIComponent, etc.
    ├── lenses/              # baseLens + health, finance, career (unused in current UI)
    ├── components/          # AgentWorkspace, DynamicUI, ConversationView, etc. (unused in current UI)
    └── services/            # socketService, supabaseService, voiceService (unused in current UI)
```

**Note:** If an onboarding flow was added in another branch/state, you may also have `src/core/`, `src/onboarding/`, and `src/navigation/`. In the current tree, **App goes straight from LoadingScreen to MainApp** (no onboarding, no React Navigation in the entry flow).

---

## 2. Infrastructure

### Frontend (Expo / React Native)

- **Runtime:** Expo ~54, React 19, React Native 0.81.
- **State:** Zustand for theme and loading; other stores exist but are not used by the current App/MainApp flow.
- **Persistence:** `src/utils/session.ts` — SecureStore on native, `localStorage` on web; used for theme preference and “loading seen” flag.
- **Theme:** Light/dark/auto (time-based 6–18), colors in `theme.ts`, persisted in storage.
- **Loading screen:** Single full-screen animation (circle grow → breathe → move up, text phases), then `onComplete` → show MainApp.

### MainApp (current post-loading screen)

- Simple chat UI: header “ONE Platform”, message list, text input, “Send”.
- Messages are local state only; agent reply is a `setTimeout` echo (“Phase 1: simple, Phase 3: will use OpenAI”).

### Backend (`one-01-backend`)

- **Stack:** Express, Socket.io, OpenAI.
- **Role:** Real-time agent: clients connect with `sessionId` / `userId`, send messages; server uses OpenAI and echoes back text (and optional `uiComponents`).
- **Endpoints:** `GET /health`; Socket.io events (e.g. `agent_status`, message flow).
- **Not wired in current App:** MainApp does not import or use `socketService`; no Socket connection in the current flow.

### External / env

- **Constants:** Socket server URL, Supabase URL/anon key, ElevenLabs API key/voice ID — all from `expo-constants` / `process.env` / `app.json` extra.
- **Current usage:** None of these are used by the current screen flow (no socket, Supabase, or voice in the active path).

---

## 3. What I understand about the product

### From the codebase

- **Branding:** “ONE Platform” / “ONE” — a single personal AI agent.
- **Lens system:** Life domains (health, finance, career, home, social in types; lenses have capabilities, protocols, sub-agents). Not surfaced in the current UI.
- **Agent model:** One agent per user; status (idle/thinking/executing/etc.); context with goals, history, active protocols. Designed for real-time chat and protocol-driven UI.
- **Protocols:** Multi-step flows (steps: action/decision/input/display) with optional UI components; backend can return `uiComponents` in responses.
- **Voice:** Types and ElevenLabs config exist; no voice in the current UI.

### From your onboarding spec (if we treat it as product spec)

- **Identity:** One account, one user, one personal “ONE” agent.
- **Agent:** Can later get “Hats” (capabilities); starts as one base agent.
- **Life lenses:** Health, Finance, Knowledge, Business (onboarding multi-select). Different set than in code (e.g. career/home/social in types, “Knowledge”/“Business” in spec).
- **Intents:** User states a “first desire” (intent); this becomes the first active process.
- **Processes:** Cards like “first process” with title, lens, status (active/done).
- **Flow:** Short onboarding (<60s) → land on “Home (NOW Sphere)” with first process created.
- **NOW Sphere:** Home screen after onboarding (user name, agent persona, first process card).

So the product is a **personal AI agent** tied to **life lenses** and **processes/intents**, with a **NOW**-oriented home and a plan for real-time and eventually voice.

---

## 4. Gaps and inconsistencies

- **Lens set:** Code has health, finance, career, home, social. Spec had Health, Finance, Knowledge, Business. Need a single source of truth and alignment (types + onboarding + backend if it uses lenses).
- **Onboarding vs current App:** Spec described a full onboarding (Welcome → Name → Style → Lenses → Desire → Confirm → Home). Current App has no onboarding and no HomeScreen; it goes LoadingScreen → MainApp (chat). So either onboarding is in another branch or not yet merged.
- **Backend usage:** Backend is built for Socket.io + OpenAI and session/user. The current app never connects; MainApp is local-only. So “Phase 3” (real AI) implies wiring MainApp (or the post-onboarding chat) to this backend.
- **Stores/components:** Many stores and components (agent, conversation, connection, UI, socket, Supabase, voice, lenses) are unused in the current entry path. They look like preparation for the full agent + protocol + real-time product.

---

## 5. Questions I have (to align implementation)

1. **Lens set:** Final list of life lenses — is it Health, Finance, Knowledge, Business (as in onboarding spec), or should we also use (or replace with) career/home/social from the current types?
2. **Onboarding state:** Is the onboarding flow (Welcome → … → Confirm → Home) already implemented in another branch? Should the “main” app flow be: Loading → Onboarding (if new user) → Home, and only then chat/agent?
3. **Agent persona:** Onboarding had “Friendly / Professional / Neutral”. Is this the same as the agent “style” that the backend or UI should respect (e.g. system prompt or tone)?
4. **First process:** When we create the “first process” from the user’s desire, is that a Goal in the existing type system, or a separate “Process” model? Should it drive a protocol or just be a card on Home for now?
5. **Backend connection:** When should the app connect to the Socket server — only after onboarding (e.g. from Home or when opening chat), or also during onboarding? And should we use the existing `socketService` and stores for that?
6. **Supabase / ElevenLabs:** Are these required for v0.1 (e.g. auth, persistence, voice), or can we ship onboarding + Home + simple chat without them?
7. **“NOW Sphere”:** Is the Home screen exactly “NOW Sphere” (name + agent + first process card), or are there more sections/actions planned for that screen?
8. **Cleanup:** Should we remove or archive unused code (old stores, components, lenses that don’t match the spec) to avoid confusion, or keep everything for a future phase?

---

## 6. Summary

- **Structure:** Expo app + separate Node backend; frontend has screens, stores, utils, types, and unused lenses/components/services.
- **Infrastructure:** Theme and loading are wired; persistence is via session/storage; backend exists but is not used in the current flow.
- **Product (as inferred):** One user, one ONE agent, life lenses, desires/processes, short onboarding, Home (NOW Sphere) with first process.
- **Next steps I need from you:** Clarify lens set, confirm whether onboarding is in repo and desired flow (Loading → Onboarding → Home), and how Home/processes relate to the existing Agent/Goal/Protocol types and backend so we can implement or adjust consistently.
