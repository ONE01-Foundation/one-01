# ONE web — what's built vs. what's still open

_Living checklist of everything we discussed, so nothing gets lost. Branch: `mvp-new-one-spec`._

## ✅ Built & shipped (recent arc)

- **Capabilities** system — profile toggles + add from Global. **Quiz** is fully functional (AI questions, chips, score, Wikipedia image). Booking / reminders / forms / research are declarative toggles.
- **Memory + permissions** in ONE's profile — fact tiles (name, age, address…), each with an open / ask / private pill. Selective disclosure: ONE only uses "open" facts, offers "Share for this" for "ask".
- **Drafts** — ONE composes the real outward message (email/message/form); you edit + approve. Nothing is auto-sent.
- **In-process correspondence** — the whole back-and-forth (you ⇄ ONE ⇄ the other side) lives inside the process, with a who-said filter. The other side replies via AI.
- **Home → process routing** — "Continue in <process>" chip routes a home-chat ask into the matching process.
- **Connections** — businesses + people + a hand-added contacts list.
- **Sources** in Global — official/reference badges (declarative).
- **Chat fix** — replies now mirror the message language (no more English replies to Hebrew); honest fallback instead of fabricated "reaching out to 3 moving companies".
- **Unit card upgrades** — a live broadcast band above the metrics; emoji quick-actions that drop off once done; next-steps that ONE works on in chat (not a checkbox); "+ add connection".
- **Profiles by type** — "New profile" chooser (Personal / Business / Supplier), stateful + persisted identities, plus a ready-made "Test Provider" supplier seat to view a process from the other side.

## 🔲 Discussed but NOT done yet — needs completing

1. ~~**Create-profile: types, not only business.**~~ ✅ DONE — chooser (Personal/Business/Supplier) + stateful persisted identities.
2. ~~**True two-sided testing.**~~ ✅ DONE — request bus + supplier inbox. Approving a draft addressed to a supplier profile drops a real `InboundRequest` into that profile's inbox (drawer "Inbox" entry + unread badge, shown only on supplier seats). The supplier Accepts/Declines and replies; the reply flows back to the sender's Home as a live banner that opens the originating process with the answer folded into the thread. Supplier home leads with the inbox (broadcast + banner). Persisted in `one_requests`.
3. ~~**Make Booking a real capability**~~ ✅ DONE — "book me X" (home or inside a process) proposes real time slots as chips (generated from the clock, skipping Fri/Sat). Tapping one books it into a process: writes a "When" metric, a timeline entry, a decision, ticks the booking step, and confirms — creating a lightweight process if there wasn't one, then opening it.
4. **Make Forms real** — still a declarative toggle. ~~Reminders~~ ✅ DONE — "remind me…" (home or in-process) creates a real held reminder (parses a "when"); booking auto-creates a 24h reminder; pending reminders surface atop Updates on Home with a done-toggle + open-process + dismiss. Persisted in `one_reminders`.
5. **Sources actually feed answers** — ONE cites / pulls from the official source when answering a regulated-domain question (licensing, health, gov, NII). Role-gated source-adding is still a disabled placeholder.
6. **Real external channel behind Drafts** — actually send via email / WhatsApp / an external system (behind permission). Today: draft + simulated reply.
7. **Live incoming-reply signal** — when the other side answers while you're not in the process, surface it on Home (banner / broadcast: "🚗 Licensing office replied").
8. ~~**Capability started in Home runs inside the matching process**~~ ✅ DONE (quiz) — "quiz/practice…" run inside a process runs in THAT process's thread, and a Home quiz that matches an existing process routes into it (opens the unit, teaches there). Passing (≥50%) updates the unit: ticks the learning step, logs a decision + timeline entry, and drops the "practice" quick-action. Booking/reminders already run in-unit via `sendToUnit`.
9. ~~**Question vs. intent**~~ ✅ DONE — a pure question (interrogative opener or trailing "?", with no action/goal verb) gets a straight AI answer and spawns no process; real intents still create/route processes. `isPureQuestion()` guard in `send()`.
10. **Wikipedia images in unit details** (done in quizzes; not yet in the process profile).
11. **Fuller ONE-profile visual redesign** (only capability/memory-led so far).
12. **Voice input** — the mic button is currently decorative.

## More important things to do — prioritized (2026-07)

**P0 — core loop must feel real**
1. ~~**Request bus / two-sided handshake**~~ ✅ DONE — process on the personal side lands in the supplier's inbox; the supplier answers → flows back to Home as a live banner. Spine of the network.
2. ~~**Supplier home = inbox mode**~~ ✅ DONE — supplier lens leads with the inbox (broadcast + banner + drawer badge) instead of "start a process".
3. **Real send channel behind Drafts** — actually deliver an approved draft (email / WhatsApp / link), behind a permission gate. Today it's simulated in-thread. _(The internal supplier handshake is now real; external channels remain.)_

**P1 — make ONE genuinely capable**
4. ~~**Booking capability functional**~~ ✅ DONE — real slots as chips; tapping books into the process (When metric + timeline + decision + step tick), from home or inside a unit.
5. **Forms functional** — fill/track a form. ~~Reminders~~ ✅ DONE — "remind me…" + booking auto-reminder; pending reminders surface atop Updates (done-toggle / open-process / dismiss); persisted.
6. **Sources feed answers** — when ONE answers a regulated-domain question it cites/pulls the official source; role-gated source-adding (licensing office, etc.).
7. **Live incoming-reply signal** — Home banner/broadcast when the other side replies while you're away.
8. ~~**Capability started in Home runs inside the matching process**~~ ✅ DONE (quiz) — runs in the process thread; a matching Home quiz routes into the unit; passing updates it (step tick + timeline + drops the practice action).

**P2 — richer & smarter**
9. **Smarter broadcast** — profile- and category-aware, proactive "what's waiting" lines (per `PROFILE_LENS`).
10. **Business worlds + listings** in Global (suppliers/compliance/marketing) so a business profile has real content, not just the "both" worlds.
11. **Broadcast/suggestions/capabilities per profile kind** (the lens already carries the hook).
12. ~~**Question-vs-intent**~~ ✅ DONE — pure questions answer directly, no process (`isPureQuestion` guard).
13. **Real voice input** (mic is decorative); Wikipedia images in unit details; fuller ONE-profile redesign.

**P3 — trust & scale**
14. **Real accounts + cloud sync** of identities/memory/processes (today localStorage).
15. **Payments** behind the upgrade window (Stripe) — currently just sets the plan locally.
16. **Notifications** (push/email) for process updates.

## Notes

- AI backend (`ai-chat` edge function) is confirmed working (200, mirrors language).
- Supabase env is configured in `web/.env.local`.
- Profile lens: `WORLD_SCOPE` + `PROFILE_LENS` in page.tsx already filter Global worlds by profile kind; `homeMode` is defined but inbox UI isn't wired yet (P0 #2).
