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
2. **True two-sided testing (partly done).** ✅ A supplier *seat* now exists (switch to "Test Provider" or create a supplier profile). ⏳ STILL OPEN: answering a *specific* incoming request cross-profile — a real handshake — needs a request bus so a process opened on the personal side shows up in the supplier's inbox to answer.
3. **Make Booking a real capability** (like Quiz) — propose times as chips, tapping books into the process + timeline.
4. **Make Forms / Reminders real** — currently declarative toggles.
5. **Sources actually feed answers** — ONE cites / pulls from the official source when answering a regulated-domain question (licensing, health, gov, NII). Role-gated source-adding is still a disabled placeholder.
6. **Real external channel behind Drafts** — actually send via email / WhatsApp / an external system (behind permission). Today: draft + simulated reply.
7. **Live incoming-reply signal** — when the other side answers while you're not in the process, surface it on Home (banner / broadcast: "🚗 Licensing office replied").
8. **Capability started in Home runs inside the matching process** — e.g. "theory test" in Home should run the quiz inside the license process, not the ephemeral home chat. (Routing chip exists; executing the capability in-unit does not.)
9. **Question vs. intent** — a pure question ("how long does X take?") shouldn't always spawn a process; distinguish "just answer" from "start a process".
10. **Wikipedia images in unit details** (done in quizzes; not yet in the process profile).
11. **Fuller ONE-profile visual redesign** (only capability/memory-led so far).
12. **Voice input** — the mic button is currently decorative.

## Notes

- AI backend (`ai-chat` edge function) is confirmed working (200, mirrors language).
- Supabase env is configured in `web/.env.local`.
