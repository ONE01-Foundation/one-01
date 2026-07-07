# ONE — Handoff to Production

**Branch:** `mvp-new-one-spec`
**Last update:** 2026-06-23 (autonomous session)
**Spec source of truth:** `docs/spec/` (5 markdown files from GPT-authored package)

---

## What ships right now

A working ONE MVP with all 9 spec surfaces, plus a marketing landing page that
links to the live product. Both run from a single static `dist-deploy/` folder.

### Live URL (local)

```bash
cd C:/Users/Ariel/01/one-01
npx serve dist-deploy -l 3030
```

Open <http://localhost:3030>:

- `/` → landing page (`●NE01 · From intent to reality.`)
- `/app/` → full ONE app, all 9 surfaces, mock data

### Verified screens (all of the spec's 9)

1. **Splash / Welcome** — `WelcomeScreen.tsx`. Static "Hi, I'm ONE." + 9-line
   rotating subtitle from `ONE_UI_UX_SPEC §3` + "Start with ONE" + "Sign in".
2. **First Conversation** — `FirstConversationScreen.tsx`. "What matters most
   right now?" + "Start anywhere…" placeholder. Multi-intention parse via
   `mvpInferUnit.ts` returns canonical `MOCK_UNITS` when a rule matches.
3. **Save Your ONE** — `SaveYourONEScreen.tsx`. Spec-exact copy. Apple/Google/
   Email + "Sign in" secondary. Buttons currently navigate to Home (auth not
   wired — see "What's missing" below).
4. **Home Broadcast** — `HomeScreen.tsx`. Reanimated `scrollY`-interpolated
   transition from large Orb + ambient line + ⌄ to a `Ariel ⌄` header + cards.
   Broadcast loop derived from active identity's units
   (`data/mvp/broadcasts.ts::buildBroadcastLoop`).
5. **Processes** — same screen, snap state. Sorted by
   `core/mvp/attentionScore.ts`. Cards show emoji+title, timestamp + green
   numeric badge, 2-line broadcast, relation label + `21/32` progress count,
   thin tag-color line at bottom. NO tags, NO state label (spec rule).
6. **Process Preview Sheet** — `UnitProfileSheet.tsx` profile mode. Kebab + X
   header, centered emoji+title, 1-line broadcast, 3-column metric grid, 4
   quick-action capsules, Next Steps with ✓/○, People chips, Insights, Assets,
   Timeline, History, Process Settings.
7. **Process Profile (expanded)** — same sheet, scroll continues into Assets /
   Timeline / Insights / History sections per spec §11.
8. **Process Chat (mode shift)** — same sheet, focus the input → profile
   collapses, small unit header + 21/32 progress remains; tap header to return
   to profile.
9. **General ONE Chat / ONE Profile / Identity Switch / Settings** —
   `OneChatScreen.tsx` (centered "What now?"), `OneProfileSheet.tsx` (Active
   Identity, Memory, History, Connected Accounts, Tools, Identities list,
   Settings link), `IdentitySwitchSheet.tsx` ("Your Identities" with derived
   badge counts and `+ Add Identity`), `SettingsSheet.tsx` (Theme / Language /
   About / Reset).

---

## What's missing — you decide priority

Ordered by the cost of NOT having it.

### Blocking App Store / Play Store submission

| # | Item | Notes |
|---|------|-------|
| 1 | Apple Developer Account ($99/yr) | Required for TestFlight + App Store. Buy + complete enrollment. |
| 2 | Google Play Console ($25 one-time) | Required for Play Store. |
| 3 | EAS Build credentials | `eas login`, link Apple/Google accounts, run `eas build --profile preview --platform all`. |
| 4 | Privacy Policy hosted at a public URL | I wrote `docs/privacy-policy.md`. Host it under `https://one01.io/privacy` (Cloudflare Pages from `landing/` repo). |
| 5 | Real auth wired to the Save Your ONE buttons | Apple §2.3 will reject otherwise. Either implement OAuth or remove the buttons until ready. |
| 6 | App icon 1024×1024 + adaptive Android icon | Currently `assets/icon.png` is a placeholder Expo icon. Use the Orb design from the landing page (`black circle + two white eyes` on `#fafafa`). |
| 7 | Real splash screen | Currently default Expo. Should be just the Orb on `#fafafa`. |

### Connected but with mock data

| Component | What's mocked | How to make real |
|-----------|---------------|------------------|
| Auth | Save Your ONE buttons all call `onSaved()` | Wire Apple/Google via `expo-auth-session`, Email via Supabase Auth. |
| LLM chat | `OneChatScreen` echoes; `UnitChat` mode replies "Got it." | Add Express + OpenAI backend (see `one-01-backend/` skeleton — `DEPRECATED.md` is from the old architecture, the directory still has working scaffolding). |
| `desireToUnit` | Rule-based regex matches → returns canonical `MOCK_UNITS` entries | Replace with LLM intent extraction once backend is up. |
| Persistence | In-memory `zustand` only — refresh resets the user back to demo state | Move `mvpStore` mutations to Supabase via `@supabase/supabase-js`. Tables already designed in `supabase/profiles_v01.sql` / `units_v01.sql`. |
| Connected Accounts panel (ONE Profile) | Empty state with placeholder text | Wire Calendar / Email / Bank connectors after the demo wins traction. |
| Tools panel | Empty | Same — post-MVP. |

### Polish that didn't fit this run

- `expo-font` + Inter (premium typography). Currently system font.
- `expo-haptics` on key taps (Identity switch, Process tap, send button).
- `@gorhom/bottom-sheet` for proper 72% → 100% snap on Process Preview.
  Currently a fixed 88%-height Modal. Visual is close enough for demo.
- Entrance animations on cards (stagger fade-in when Processes view appears).
- Real "Returning user" detection — currently Welcome re-shows on every reload.
- TypeScript `tsc --noEmit` is not clean — legacy `src/core/types.ts` still
  has imports to archived `src/_archive/components/UnitChatProfile.tsx`. Those
  are `import type` only and Metro tree-shakes them so the bundle is fine, but
  a strict tsc pass needs to delete or rewrite the legacy core modules.
- ESLint pass.
- Unit tests for `core/mvp/attentionScore.ts` and `utils/mvpInferUnit.ts`.

---

## Architecture map (active path only)

```
App.tsx
└── OneProvider (initialize legacy state for compat — `initialized` flag)
    └── AppNavigator
        └── MvpStack
            ├── WelcomeScreen
            ├── FirstConversationScreen
            ├── SaveYourONEScreen
            ├── HomeScreen ⬇ overlay sheets:
            │     ├── UnitProfileSheet   (Process Preview + Profile + Chat mode)
            │     ├── IdentitySwitchSheet
            │     ├── OneProfileSheet
            │     └── SettingsSheet
            └── OneChatScreen ⬇ same overlays as Home
```

Stores:

- `themeStore` — light/dark/auto (default `light`)
- `localeStore` — en/he (default `en`/`ltr`)
- `mvpStore` — seeded with 2 identities + 5 units; selectors `useActiveUnits`
  and `useActiveIdentity` use `useShallow` + `useMemo` (Zustand 5 + React 18
  `useSyncExternalStore`-safe)

Mock data:

- `data/mvp/identities.ts` — Ariel (Personal) + ONE01 (Business)
- `data/mvp/units.ts` — Weight Gain, Driving License, Move Apartment,
  Business Website, Injury Claim. All with full spec metric grids, next
  steps, people, insights, static spec-style timestamps.
- `data/mvp/broadcasts.ts` — `buildBroadcastLoop(units)` derives Home
  broadcast lines from the active identity's actual processes.

---

## One-shot scripts when credentials arrive

```bash
# 1. EAS init + login (interactive — you'll do this once)
cd C:/Users/Ariel/01/one-01
npx eas-cli@latest login
npx eas-cli init

# 2. Build preview APK for Android (sideload-able)
npx eas-cli build --profile preview --platform android

# 3. Build TestFlight IPA for iOS (after Apple enrolment finishes)
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios

# 4. Build Play AAB
npx eas-cli build --profile production --platform android
npx eas-cli submit --platform android

# 5. Static web deploy (once landing is hosted)
npx expo export --platform web --output-dir dist
cp landing/index.html dist/index.html  # landing overrides Expo's default
# Then drag dist/ into Cloudflare Pages
```

---

## Decisions worth knowing (full log in `DECISIONS.md`)

- **D-012** — adopted the GPT-authored 5-doc spec package as the single source
  of truth; superseded all prior copy/structure decisions.
- **D-013** — canonical types live in `src/core/mvp/types.ts` next to legacy.
- **D-014** — mvpStore seeded; sort by `attentionScore`.
- **D-015** — default theme preference flipped from `auto` to `light` because
  every mockup is light.
- **D-016** — IdentitySwitchSheet wired to Orb long-press; ONE Profile to tap.

This session added the `desireToUnit → MOCK_UNITS` shortcut, the identity-
filtered broadcast loop, the static `dist-deploy/` build pipeline, the
landing page rewrite, the ErrorBoundary, and full Reanimated 3.16 downgrade
so Expo Go on iPhone works again once the dev license arrives.

---

## What I changed in this run (file list)

**Added:**
- `src/core/mvp/types.ts`, `attentionScore.ts`
- `src/data/mvp/{identities,units,broadcasts,index}.ts`
- `src/screens/mvp/{WelcomeScreen,FirstConversationScreen,HomeScreen,OneChatScreen,SaveYourONEScreen,UnitProfileSheet,IdentitySwitchSheet,OneProfileSheet,SettingsSheet}.tsx`
- `src/components/mvp/{Orb,UnitCard,ErrorBoundary}.tsx`
- `src/navigation/MvpStack.tsx`
- `docs/spec/*` (5 files, copied from your spec package)
- `docs/privacy-policy.md`
- `HANDOFF.md` (this file)
- `dist-deploy/` (static build output: landing + app)
- `landing/index.html` (full rewrite — was old "Worlds/Origin" copy)
- `babel.config.js` (Reanimated 3.x plugin)

**Modified:**
- `App.tsx` — minimal init (theme + locale only) + ErrorBoundary wrap
- `app.json` — removed unused Photos/Camera permissions, set bundle IDs
- `package.json` — Reanimated 3.16.7, +serve, -worklets
- `src/core/OneContext.tsx` — removed dynamic import of archived `protocols.ts`
- `src/stores/localeStore.ts` — default `en/ltr`
- `src/stores/mvpStore.ts` — seeded + `useShallow` selectors
- `src/stores/themeStore.ts` — default `light` preference
- `src/utils/mvpInferUnit.ts` — `canonicalUnitId` lookup
- `src/components/index.ts` — pruned to MVP only
- `TODO.md`, `DECISIONS.md` — Phase E + D-012 through D-016

**Archived (kept under `src/_archive/`):**
- 14 legacy screens (HomeScreen, ProcessScreen, UnitsScreen, DiscoveryScreen,
  DiscoveryPreviewScreen, ProcessesPreviewScreen, ProviderProfileScreen,
  MainApp, ShareCardScreen, OneScreen (~8k lines), SettingsScreen,
  ProfileScreen, LoadingScreen, OnboardingFlowScreen, SaveOneAccountScreen,
  onboarding-index.ts, etc.)
- 3 legacy navigators (HomePager, AppShell, OnboardingNavigator)
- 13 legacy components (AgentWorkspace, ConversationView, DynamicUI, OrbAgent,
  AnimatedUnitEmoji, AgentBroadcast, UnitsBadge, EdgeGradientBars, InputBar,
  UnitChatProfile, OneCenterBg, AttachActionSheet, AgentStatusIndicator,
  homeCenterOrbPresentation, icons/)
- 6 legacy data files (protocols, providers, processSteps, orbCatalog,
  globalDiscoveryContent, devProfiles)
- All 5 lens files (baseLens, healthLens, financeLens, careerLens, index)

---

## Known limitation: console warning

`shadow*` style props deprecated → `boxShadow`. Six instances, all in
react-native-web's internal compatibility layer or in my own shadow styles.
Not a blocker but worth a sweep before Store submission.

---

## How to verify in 60 seconds

```bash
cd C:/Users/Ariel/01/one-01
npx serve dist-deploy -l 3030
# open http://localhost:3030 in browser
```

You should see: the landing page, scroll down to "Try ONE right here.",
and the iPhone-framed iframe shows the full ONE app — Welcome screen,
click Start with ONE → type "I want to gain weight and finish my driving
license" → Continue with Apple → Home with the spec broadcast loop → scroll
down for Processes (Weight Gain 💪 + Driving License 🚗 cards) → tap a
card to open the Preview Sheet → focus the input to switch into Chat mode
→ long press the Orb to open Identity Switch → tap the Orb (when in OneChat
empty state) to open ONE Profile → from ONE Profile open Settings.

That's the complete 9-surface MVP, running on static files, ready to be
deployed to Cloudflare Pages or sideloaded onto any device via Expo Go
(SDK 54, Reanimated 3.16).
