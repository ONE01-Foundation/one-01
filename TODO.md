# ONE MVP — TODO

Branch: `mvp-new-one-spec`
Started: 2026-06-23
Target: Welcome → First conversation → mock units → Home Broadcast → scroll down to Processes (visible flow)

---

## Phase A — Foundations ✅
- [x] Create branch `mvp-new-one-spec`
- [x] Inspect AppShell, OneScreen, OnboardingFlowScreen
- [x] Archive abandoned screens (disconnected from AppNavigator — files remain in src/ for reference)

## Phase B — 5-Screen Skeleton ✅
- [x] WelcomeScreen (Splash, "I am ONE", Start)
- [x] FirstConversationScreen (name + desires → mock units)
- [x] HomeScreen (Broadcast + Reanimated snap to Processes)
- [x] UnitCard component (matching mockup)
- [x] SaveYourONE deferred prompt
- [x] OneChatScreen (general chat)
- [x] UnitProfile sheet + UnitChat mode (v1)

## Phase C — Wire & Verify ✅
- [x] AppNavigator rewired to MVP flow (MvpStack)
- [x] Run on web, golden path verified
- [x] Document working vs broken (see below)

## Phase D — Deferred (not this sprint)
- [ ] Rename `SpaceId → IdentityId` in core/spaces.ts
- [ ] Rename `Lens → Tag` in core/types.ts
- [ ] Split OneScreen.tsx (8003 lines) into 3 files
- [ ] Identity Switch bottom sheet
- [ ] ONE Profile screen (Memory, Connected accounts, Tools, Settings)
- [ ] Real backend wiring (Supabase + OpenAI via Railway)

---

## Working / Broken (Phase B/C — verified 2026-06-23)

### ✅ Working — verified on Expo Web build
- Welcome screen: Orb + rotating capability lines + Start button
- FirstConversation: name → desires → mock unit generation
  - Multi-input parsing (commas, "וגם", newlines)
  - Auto-advance to SaveYourONE after units created
- SaveYourONE: Google/Apple/Email buttons + "אחר כך" escape (login truly deferred)
- Home (rest): Orb + "Good morning, {name}." + "What's Next?" input
- Home → Processes Reanimated transition:
  - Orb scale 1 → 0.25
  - Orb translateY upward
  - Greeting opacity 1 → 0 (0..100 scrollY)
  - Top header ("Ariel ⌄") fade in (120..200 scrollY)
  - Unit Cards fade in (80..220 scrollY)
- UnitCard rendering matches mockup: emoji + title + time + status dot + broadcast + avatar + progress + tag + update dot
- Unit tap → UnitProfileSheet (modal sliding from bottom)
  - Sections: Broadcast, Progress, Next Steps, People, Files/Memory
- Profile input tap → Chat mode (same sheet, profile collapses to small header)
- Chat header tap → returns to Profile mode

### 🟡 Known limitations (acceptable for v1)
- Home Broadcast text is hardcoded "Good morning" English. Spec wants ONE speaking 1-2 sentences (e.g. "לא קבעת עדיין שיעור נהיגה. כדאי לתאם השבוע."). Currently shows static greeting.
- No actual "snap" behavior on scroll — smooth continuous interpolation. Spec mentions iPhone notification center snap; v1 is close-enough.
- Cards don't have attentionScore sort with real signals — uses random + recency only.
- Identity Switch bottom sheet not built yet (top header has "⌄" affordance but tap is a no-op).
- ONE Profile screen not built (header chevron currently no-op).
- LLM not wired — FirstConversation and OneChat use rule-based + echo replies.
- No persistence — refresh resets state.
- Reanimated transition works on web; should verify on native iOS/Android before MVP submission.
- One known visual issue at extreme scroll (past SNAP_POINT): top header overlaps first card slightly. Natural scroll position renders cleanly.

### ⏭ Next sprint candidates
- Replace static greeting with broadcastEngine-driven Home Broadcast text
- Identity Switch bottom sheet (Personal/Business/Family)
- ONE Profile screen
- Wire OpenAI for real conversation (via Railway backend per DECISIONS-D006)
- Supabase persistence + auth
- Native build verification (EAS preview build)
- iOS snap behavior with Reanimated `useAnimatedReaction` + `scrollTo`

---

## Phase E — Spec adoption (canonical 5-doc package at `docs/spec/`)
Started: 2026-06-23

### ✅ Done in this pass
- [x] Drop the 5 spec files into `docs/spec/` as canonical reference
- [x] Create `src/core/mvp/types.ts` mirroring ONE_DATA_MODEL §1
- [x] Create `src/data/mvp/identities.ts` (Ariel + ONE01)
- [x] Create `src/data/mvp/units.ts` (5 canonical Units with metrics, next steps, people, insights)
- [x] Create `src/data/mvp/broadcasts.ts` (Home broadcast loop + closing line)
- [x] Implement `src/core/mvp/attentionScore.ts` per spec §6
- [x] Refactor `mvpStore` to use spec types, seed with mock data, expose `useActiveUnits`/`useActiveIdentity` selectors
- [x] Rewrite Welcome: "Hi, I'm ONE." static + 9-line rotation + "Start with ONE" + "Sign in" (no Hebrew loop)
- [x] Rewrite FirstConversation: drop name question, ask "What matters most right now?", "Start anywhere..." placeholder, multi-intention parse → "I can turn that into N processes:" preview
- [x] Rewrite Home Broadcast: cycle through 7 spec messages + hold longer on "What matters most right now?"
- [x] Rewrite UnitCard: emoji+title+timestamp+green numeric badge, 2-line broadcast, single relationship label + 21/32 progress count, thin tag-color line at bottom (no tag chip, no state label)
- [x] Rewrite UnitProfileSheet: kebab+X header, centered emoji+title, 3-col metrics grid, 4 quick-action capsules, Next Steps with ✓ vs ○, People chips, Insights
- [x] Rewrite OneChat: "What now?" empty state, capsule input "What's next?", no X, no three-dots
- [x] Rewrite SaveYourONE: English spec copy ("Let's save your ONE / so we can continue later."), Apple/Google/Email, "Sign in" secondary
- [x] Build IdentitySwitchSheet: "Your Identities" title, avatar+badge+name+role rows, `+ Add Identity`, no Continue button
- [x] Wire long-press on Orb + tap on Home header to open IdentitySwitchSheet
- [x] Default theme preference flipped from `auto` to `light` (matches all mockup screens)

### ⏭ Still pending after this pass
- [ ] @gorhom/bottom-sheet for Process Preview at `['72%', '100%']` snap points (current Modal works but is fixed-height)
- [ ] Process Profile sections beyond Preview: Quick Actions (separate row), Assets, Timeline, History, Settings — currently Preview = Profile in one scroll
- [ ] ONE Profile screen (Active Identity, Memory, History, Connected Accounts, Tools, Settings, Identities list)
- [ ] Real keyboard "inside the card" feel in UnitChat mode (currently keyboard floats above bottom)
- [ ] Active identity persists across reloads (currently in-memory only)
- [ ] Snap-to-offset on Home scroll feels close-enough on web but needs verification on native — `snapToOffsets` is in place but iOS deceleration may overshoot
- [ ] Rename `SpaceId → IdentityId` / `Lens → Tag` in `src/core/spaces.ts` + `src/core/types.ts` (legacy)
- [ ] Move legacy screens to `_archive/` (currently disconnected from navigation but still in src/)
- [ ] Wire real broadcast generation (broadcastEngine) → Home broadcast text driven by actual units instead of static loop
- [ ] Real LLM via Railway backend (OpenAI) in FirstConversation + OneChat + UnitChat
- [ ] Supabase auth on Save Your ONE buttons
- [ ] Hebrew i18n pass (current spec-aligned copy is English; existing i18n infrastructure exists in src/i18n/)

