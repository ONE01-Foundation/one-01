# ONE Product Audit — self-driven punch list

Walked the surfaces (Splash → Welcome → FirstConversation → SaveYourONE → Home → UnitProfile → OneProfile → IdentitySwitch → Settings → QuickActions → Create sheets). Items below are concrete fixes I can ship without further user input.

Legend:
- `[ ]` not started
- `[~]` in progress
- `[x]` done

## A — Visual continuity (orb / identity)
- [x] **A1.** HomeOrb 72 → 88 (user ask: bigger head). Splash dot bumped to 88 to match.
- [x] **A2.** Welcome Orb 96 → 88 (matches Splash + Home). SignIn / SaveYourONE stay at 80 as intentional "secondary surface" sizes.
- [ ] **A3.** FirstConversation Orb size — verify it matches Welcome (88) for the next handoff. Probably renders Orb size=88 already; confirm.
- [ ] **A4.** SignIn / SaveYourONE Orb sizes — same family consistency check (likely 88 or 96; pick one).
- [ ] **A5.** UnitProfileSheet header has no orb after recent removal. Re-introduce a small (40-44px) orb in the sticky header next to the unit title for "you're talking to ONE in this process" cue.

## B — Home open-state polish
- [x] **B1.** Cards reveal/spread when there are only 2 (force `cardsList.minHeight = SNAP_OPEN`).
- [ ] **B2.** When the deck is fully spread (scroll past SNAP_OPEN), the broadcast text is faded but the broadcast row container still occupies space. Verify the empty space doesn't push first card down further than necessary.
- [x] **B3.** Single-identity case: row is no longer tappable (no `onPress`), `accessibilityRole` flips to `text`, chevron omitted. Multi-identity row keeps the button behaviour.
- [x] **B4.** Verified — empty-state already shows `HOME_BROADCAST_EMPTY_LINES` (which starts with "What do you want to move forward?"). The broadcast handles this case via `buildBroadcastLoop`.

## C — Chat / inline conversation
- [x] **C1.** Tapping the CTA now sends it as the first message via `sendChat(CHAT_CTA)`.
- [x] **C2.** Avatar dot left of each ONE bubble + typing indicator. Bubbles now wrap in `bubbleRow` for layout control.
- [x] **C3.** Timestamps under bubbles (grouped — only show on the last in a run of same-speaker, within 5 min). `formatBubbleTime` uses device locale.
- [ ] **C4.** Long ONE replies should wrap nicely — verify `maxWidth: 85%` is wide enough for 2-3 sentence answers.
- [ ] **C5.** "Sent" → "ONE is replying" hint near the typing indicator (text caption, not just dots).

## D — Sheets
- [ ] **D1.** All sheets pass `keyboardShouldPersistTaps="handled"` on their inner ScrollViews so the keyboard doesn't dismiss the sheet's own Pressables.
- [x] **D2.** UnitProfileSheet sticky X bumped 36→44 px, icon 16→18, hitSlop 8→14.
- [ ] **D3.** OneProfileSheet — segmented controls (Appearance / Language) miss a subtle "selected" haptic/visual snap. Add a thin ring or background-shift on press-in.
- [ ] **D4.** CreateProcessSheet — check the input lift over keyboard works on iPhone with safe-area inset.
- [x] **D5.** IdentitySwitchSheet `paddingBottom` 32 → 44 so "+ New ONE" clears the home indicator at the 88% snap.

## E — QuickActions sheet
- [ ] **E1.** Wire Camera / Photo / Document / Voice actions to real Expo modules (`expo-image-picker`, `expo-document-picker`, `expo-av`) — currently stubbed with alerts.
- [ ] **E2.** "New process" should pre-open with whatever the user already typed into the InputBar (don't lose context).

## F — UnitCard polish
- [x] **F1.** ActionPill now renders glyph + label (📌 Pin, ↗ Share, 🗑 Delete). Pill width 68→72 with vertical stack.
- [x] **F2.** UnitCard: when progress is complete, shows a full green bar + "Done ✓" badge to the right instead of an ambiguous 100% bar.
- [x] **F3.** UnitCard timestamp uses `toLocaleTimeString` with graceful manual fallback.

## G — Broadcast / rules
- [x] **G1.** `runRules` now returns at most ONE line (first matching rule wins). Loop opens with one well-chosen lead, then the regular openers.
- [ ] **G2.** Add a rule: "calendar event today" — surface the closest upcoming time-tagged unit.
- [ ] **G3.** First-line-on-entry hold should be ≥3s so the user can read it before it rotates.

## H — Persistence / state
- [x] **H1.** "Reset my memory" now shows a destructive-style Alert before wiping.
- [ ] **H2.** Saving identities/units to storage works, but theme/locale prefs use their own stores — verify their persistence works on reload.

## I — Edge cases / polish
- [ ] **I1.** RTL: Hebrew language toggle exists in OneProfileSheet. Test that switching to `he` actually flips layout (`direction: 'rtl'`) and InputBar doesn't break.
- [x] **I2.** Identity name in the open-state header: `numberOfLines={1}` + `ellipsizeMode="tail"`.
- [x] **I3.** `useBroadcastNavigator` now falls back to the closing prompt when the resolved line is empty/falsy.
- [ ] **I4.** Pressing the orb during the splash mount cascade (orb still flying up) — should be ignored to avoid mid-animation tap.

## Working order (highest impact first)
1. A2 (orb size unification across entry surfaces) — done
2. C1 (tapping CTA sends it) — done
3. C2 (avatar dot on ONE bubbles) — done
4. C3 (timestamps on bubbles) — done
5. F2 (Done state on cards)
6. G1 (cap rule outputs)
7. F3 (locale time)
8. I3 (broadcast empty guard)
9. B3 (one-identity simpler label)
10. D2 (UnitProfileSheet X bigger)

## J — Future suggestions (my recommendations, not yet planned)
- [ ] **J1.** Real LLM via the backend — the rule-based reply library is fine for demos but the moment a user types something off-pattern ("can you remind me to call Yossi at 6") ONE looks dumb. Wiring OpenAI/Anthropic through the Railway backend is the single biggest UX upgrade left.
- [ ] **J2.** Haptics — install `expo-haptics` and fire a light impact on: orb tap, sheet open, card swipe-action trigger, sent message. The product feels more alive with haptic feedback.
- [ ] **J3.** Persistent broadcast preference (which line was last shown) so re-opening doesn't always start at the top of the loop.
- [ ] **J4.** Card → process timeline view that scrolls horizontally with snap (separate from sheet — opens from inside the sheet).
- [ ] **J5.** Pull-to-archive on the unit sheet — drag down past 70% to send a process to "completed".
- [ ] **J6.** Identity badge color tint per identity type (personal: green, business: blue, family: purple). Small dot beside the agent face.
- [ ] **J7.** Quick-action shortcuts that map to text — the existing QuickActionsSheet has Attach photo / etc., but most use cases are textual. Add "Remind me in…" and "Schedule for…" with mini time-pickers.
- [ ] **J8.** "Snooze process" — push it to the bottom of the stack for N hours; comes back with a fresh broadcast line.
- [ ] **J9.** End-of-day digest — ONE summarizes the day's activity in one card on Home. Tap to expand.
