# ONE MVP — Architectural Decisions

Branch: `mvp-new-one-spec`
Started: 2026-06-23

---

## D-001 — Stay with one-01 repo, don't start fresh
**Date:** 2026-06-23
**Decision:** Keep building on the existing one-01 codebase instead of creating a new repo.
**Why:** Audit showed ~35-40% of existing code already serves the new spec — agent runtime, broadcast engine, unit schema/state machine, compiler, stores, atomic components. Fresh repo would mean ~3-4 weeks rebuilding plumbing that already works.
**Tradeoff:** ~1 week of demolition (archive, rename, split OneScreen) before new features unblock.

## D-002 — New MVP product model
**Date:** 2026-06-23
**Decision:** Adopt revised product model — drop Spaces/NOW Sphere/Discovery-first/Merchant CRM. New model:
- `ONE01` = global / network / world layer
- `ONE` = central agent
- `Identity` = active identity (Personal / Business / Family)
- `Unit` = process / goal / life-object (code-level name)
- `Process` (English UI) / `תהליך` (Hebrew UI) = user-facing name
- `Tag` = VIEW ONLY (health / learning / money / home)
**Why:** User clarified the prior model didn't match the intended product. User does not "enter a Space" — they work against ONE under an Identity, with Units.

## D-003 — Archive, don't delete
**Date:** 2026-06-23
**Decision:** Move abandoned screens/code to `_archive/` directory rather than deleting.
**Why:** Faster reversibility. Easy to mine for code patterns later. Cheap to delete later when proven unneeded.

## D-004 — Defer Identity/Tag rename
**Date:** 2026-06-23
**Decision:** Build the new MVP screens against current type names (LifeLens, SpaceId) for now. Rename happens after visible flow is running.
**Why:** User's instruction: "אל תנסה לסיים את כל הארכיטקטורה לפני שיש flow נראה לעין". Rename is invasive — better to do it after we have a working flow that proves the new model works.

## D-005 — New screens live in `src/screens/mvp/`
**Date:** 2026-06-23
**Decision:** All new MVP screens go in `src/screens/mvp/`, components in `src/components/mvp/`.
**Why:** Clear separation from legacy. Easy to grep for "what's the new model". When legacy is fully gone, we promote `mvp/` to the root.

## D-006 — Login deferred until after first value
**Date:** 2026-06-23
**Decision:** No login on Welcome or FirstConversation. Only show "בוא נשמור את ה-ONE שלך" (Google/Apple/Email) AFTER first units are created.
**Why:** Spec rule. User must get value before being asked to commit.

## D-007 — Reanimated for Home → Processes transition
**Date:** 2026-06-23
**Decision:** Use Reanimated `useSharedValue` + `useAnimatedScrollHandler` + `interpolate` for the iOS Notification-Center-style transition between Home Broadcast and Processes. Single screen, vertical scroll, snap at {0, 200}.
**Why:** User-provided reference videos and mockup show iOS-pattern: large orb + greeting at rest, scroll up → orb shrinks to header "Ariel ⌄", cards rise from bottom. This needs scrollY-driven interpolation, not navigation.

## D-008 — Mock data first
**Date:** 2026-06-23
**Decision:** Use hardcoded mock Units (Driving License 🚗, Weight Gain 💪) for first runnable flow. Wire to compiler/agentRuntime later.
**Why:** Visible flow in hours, not days. Mock data unblocks the visual work.

## D-009 — Hero spacer drives scroll animation, not a full screen
**Date:** 2026-06-23
**Decision:** Set `HERO_SPACER = SNAP_POINT + 90` (≈290px) instead of full screen height. This is the paddingTop of the ScrollView's contentContainer.
**Why:** Original v1 set spacer = screen height, which meant the user had to scroll ~680px before cards appeared — completely defeating the iOS-notification-center pattern where pulling up should reveal cards within ~200px. Now at scrollY=200 (the SNAP_POINT), cards sit cleanly below the top header (which is ~94px tall).
**How to verify:** at scrollY=200, both unit cards visible below "Ariel ⌄" header. At scrollY=0, big Orb centered + greeting beneath.

## D-010 — UnitProfileSheet handles both Profile and Chat in one modal
**Date:** 2026-06-23
**Decision:** Single Modal component with internal `mode: 'profile' | 'chat'` state. Profile → Chat triggered by input focus. Chat → Profile by tapping the small unit header.
**Why:** Spec is explicit: "אותו Unit עובר ל-Conversation Mode. לא מסך חדש" — same sheet, mode transition. Implementing as two separate screens would have broken that constraint and required complex animation between routes.

## D-011 — Local mvpStore replaces OneContext for the new flow
**Date:** 2026-06-23
**Decision:** Created `src/stores/mvpStore.ts` (Zustand) holding `name`, `identityId`, `units`, `homeBroadcast`. Legacy `OneContext` remains for `initialized` flag only.
**Why:** OneContext is wired to the deprecated `OneProcess` type with `lens`/`spaceId`/`domainId` fields that conflict with the new model. Building on top of it would have required the deferred D-004 rename to happen first. Parallel store keeps the legacy code untouched and lets us move now.
**Migration path:** Once the Space→Identity / Lens→Tag rename happens (D-004), mvpStore and OneContext can be unified.

## D-012 — Adopted GPT-authored MVP spec package as canonical
**Date:** 2026-06-23
**Decision:** Treat the 5-doc spec package at `docs/spec/` (ONE_MASTER_SPEC, ONE_UI_UX_SPEC, ONE_DATA_MODEL_AND_EXAMPLES, ONE_MIGRATION_BUILD_PLAN, ONE_CLAUDE_IMPLEMENTATION_PROMPT) as the single source of truth for product structure, screen copy, data shapes, and visual rules. All earlier informal Welcome/FirstConversation/Home copy is superseded.
**Why:** The user-supplied package eliminates the guessing across screens — every copy string, every progress format, every animation behavior is pinned. Before this, each session re-relitigated the same questions.
**Impact:** Welcome line rotation now uses the 9-item loop from §3 with "What matters most right now?" as the held-longer closing line. FirstConversation drops the name question (asked later in Save Your ONE). Home broadcast cycles through the spec's process-aware messages, not generic greetings. Cards use `21/32` progress count, not percentages, with no tags or state labels. Quick actions = 4 capsules per process.

## D-013 — Canonical spec types live in `src/core/mvp/` next to legacy
**Date:** 2026-06-23
**Decision:** Created `src/core/mvp/types.ts` mirroring ONE_DATA_MODEL §1 verbatim (Identity, Unit, UnitMetric, UnitQuickAction, UnitStep, UnitPerson, UnitAsset, UnitTimelineItem, UnitInsight, UnitHistoryItem, ChatMessage). Lives alongside `src/core/types.ts` rather than replacing it.
**Why:** Legacy `OneProcess` type is still referenced by archived but undeleted code paths (OneScreen, UnitsScreen, broadcastEngine). Coexistence avoids a flag-day rename mid-flight.
**Migration path:** Once `_archive/` actually contains the legacy screens, drop `core/types.ts` and move `core/mvp/types.ts` up a directory.

## D-014 — mvpStore seeded with 5 canonical units, sorted by attentionScore()
**Date:** 2026-06-23
**Decision:** mvpStore boots with `Ariel` (Personal) + `ONE01` (Business) identities and 5 canonical Units (Weight Gain, Driving License, Move Apartment, Business Website, Injury Claim) from `data/mvp/units.ts`. List ordering driven by `core/mvp/attentionScore.ts` per ONE_MIGRATION_BUILD_PLAN §6.
**Why:** A demo with rich, realistic processes ships visible value immediately. The same mock data appears in the spec examples, so screenshots can be matched 1:1 to mockups for QA.
**Empty path:** FirstConversation wipes the seed via `clearUnits()` on mount so a fresh user actually experiences the empty → first-process flow.

## D-015 — Default theme preference is `light` (was `auto`)
**Date:** 2026-06-23
**Decision:** First-time users land in light mode regardless of time of day. Auto/dark still available via Settings preference persistence.
**Why:** ONE_UI_UX_SPEC §1 is explicit — "White / off-white background. Black text." All mockups are light. Time-based auto detection in the previous default was producing dark backgrounds at night that didn't match any spec mockup.

## D-016 — IdentitySwitchSheet wired to Orb long-press
**Date:** 2026-06-23
**Decision:** Long-press on the Home Orb (or OneChat Orb) opens IdentitySwitchSheet. Tap on the Home top-header (small orb + "Ariel ⌄") also opens it. Tapping an identity row switches active identity and closes — no Continue button.
**Why:** Per ONE_UI_UX_SPEC §13 and §15. Discoverability via the chevron (`⌄`) next to identity name. Switching identity changes which units appear under Home via the `useActiveUnits` selector.
