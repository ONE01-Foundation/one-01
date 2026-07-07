# ONE

> One AI agent. Your identities, your processes, what matters next.

ONE is a personal operating layer where a single AI agent turns intentions
into living processes — across personal, business, and family identities.

Not a chatbot. Not a task manager. Not a dashboard.

This repo holds the Expo / React Native app, a marketing landing page, and a
static deploy pipeline that bundles both into a single host-anywhere folder.

---

## Quick start

### Run the live demo (web)

```bash
git clone <this-repo>
cd one-01
npm install
npm run web         # http://localhost:8081  → app only (dev)
```

Or to see the production build (landing + app at the same origin):

```bash
npm install
npx expo export --platform web --output-dir dist
mkdir -p dist-deploy/app
cp -r dist/* dist-deploy/app/
cp landing/index.html dist-deploy/index.html
npx serve dist-deploy -l 3030
# open http://localhost:3030
```

### Run on iPhone / Android (Expo Go)

```bash
npm start            # prints a QR code
# Open Expo Go on your phone (App Store / Play Store) and scan
```

> Requires Expo Go for SDK 54. The repo pins Reanimated 3.16 specifically so
> Expo Go works without a custom dev client.

---

## What's in here

```
one-01/
├── App.tsx                  ← entry: theme init → AppNavigator
├── app.json                 ← Expo config (icon, splash, bundle ID)
├── babel.config.js
├── package.json
├── README.md                ← this file
├── HANDOFF.md               ← submit-to-store checklist
├── DECISIONS.md             ← architectural log (D-001 .. D-016)
├── TODO.md                  ← outstanding work
├── docs/
│   ├── spec/                ← 5-doc canonical product spec (source of truth)
│   ├── privacy-policy.md    ← ready to host
│   └── screens/             ← screenshot evidence
├── src/
│   ├── core/mvp/            ← canonical types + attention score
│   ├── data/mvp/            ← seed: 2 identities, 5 processes, broadcast loop
│   ├── stores/              ← zustand: theme, locale, mvp
│   ├── screens/mvp/         ← the 9 MVP surfaces
│   ├── components/mvp/      ← Orb, UnitCard, ErrorBoundary
│   ├── navigation/          ← AppNavigator + MvpStack
│   ├── utils/               ← desire→unit inference
│   └── _archive/            ← legacy screens, kept for reference
├── landing/
│   └── index.html           ← marketing site (light theme, spec-matched)
├── dist/                    ← static export of Expo web app (gitignored)
└── dist-deploy/             ← production folder: landing + dist combined
```

---

## The product, in one paragraph

A user opens ONE and speaks. ONE turns the user's intentions into structured,
living Processes — each with memory, people, files, metrics, a next step, and
a 2-line broadcast. The Home surface shows what matters now; scrolling down
reveals the full Process list. Tapping a Process opens a sheet (Preview →
Profile → Chat) without leaving the screen. Long-press the agent's Orb to
switch identities (Personal / Business / Family). Read the full spec in
[docs/spec/ONE_MASTER_SPEC.md](docs/spec/ONE_MASTER_SPEC.md).

---

## The 9 surfaces (all built)

1. Welcome — "Hi, I'm ONE." + rotating subtitle + "Start with ONE"
2. First Conversation — "What matters most right now?" + multi-intention parse
3. Save Your ONE — Apple / Google / Email (deferred login)
4. Home Broadcast — single screen, scroll-snap to Processes
5. Processes List — sorted by attention score, cards per spec §8
6. Process Preview Sheet — kebab, X, metrics grid, quick actions, next steps
7. Process Profile (expanded) — assets, timeline, insights, history, settings
8. Process Chat (mode) — same sheet, conversation mode
9. ONE Profile + Identity Switch + Settings

See HANDOFF.md for verification proof and what's still mocked.

---

## License

Copyright © 2026 ONE01 Foundation. All rights reserved.
