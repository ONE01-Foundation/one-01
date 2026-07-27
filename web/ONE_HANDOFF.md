# ONE web — handoff (paste this into a new chat to continue)

## What this is
ONE01 **web product** — a Next.js 15 App Router client app. ONE is a personal
representative that turns intentions into done. Hebrew-first, bilingual (he/en),
RTL-aware. The user (Ariel) iterates fast; reply in the language he writes in.

## Where things live
- Repo root (git): `C:\Users\Ariel\01\one-01`  · branch **`mvp-new-one-spec`** · remote `origin` = github.com/ONE01-Foundation/one-01.git
- Product code: `web/` — main screen is one big client component **`web/src/app/app/page.tsx`** (`AppHome`).
- Brain/heuristics: `web/src/lib/oneBrain.ts` (`interpret`, `ChatMsg`, `Outreach`). AI client: `web/src/lib/aiChat.ts` (`invokeAiChat`, `oneSystemPrompt`). Mock data/types: `web/src/lib/mockData.ts` (`Process`, `Identity`, `Business`, `UnitDraft`).
- Styles: `web/src/app/globals.css`. i18n: module-level `PRODUCT_UI: Record<"en"|"he", …>` in page.tsx; `const t = PRODUCT_UI[lang]`.
- Dev server: **port 3105** (`one01-landing`). Supabase env in `web/.env.local` (AI works — `ai-chat` edge fn returns 200). Type-check: `cd web && npx tsc --noEmit`.

## Working agreements (important)
- **Don't run screenshot verification loops** — Ariel watches the live app on :3105 himself. tsc + a light DOM check is enough.
- **Push milestones, not every change** — batch, then `git push origin mvp-new-one-spec`.
- ONE must **mirror the user's message language** (`msgLang(text)` in page.tsx) — never reply English to Hebrew. Never fabricate actions in fallbacks.
- Security: never pre-fill real PII; the user fills their own facts.

## Built & working (this arc)
- **Chat**: AI replies + all locally-composed lines mirror message language; honest offline fallback.
- **Capabilities**: catalog + profile toggles + Global "Add". Only **Quiz** is functional (AI Qs, chips, score, Wikipedia image).
- **Memory / selective disclosure**: fact tiles in ONE profile, per-fact open/ask/private; only "open" facts reach the model; process-creation pulls needed facts.
- **Drafts**: ONE writes the real outward message (`composeDraft`), editable + Approve/Discard. Approving delivers it into the thread.
- **In-process correspondence**: `ChatMsg.party` you/one/them + `from`; sticky who-filter; the other side replies via AI (`counterpartReply`); follow-ups relay.
- **Home→process routing**: "Continue in <process>" chip.
- **Connections**: canvas (businesses + process-people + hand-added `one_contacts`) + "+ add connection" in unit.
- **Unit card**: live broadcast band above metrics; emoji quick-actions that drop off when done; steps that ONE works on in chat (not a checkbox); add-connection.
- **Profiles by type**: identities are stateful + persisted (`one_identities`); "New profile" chooser = Personal 👤 / Business 🏢 / Supplier 🏪; seeded "Test Provider" supplier seat. Processes already scope by `identityId`.
- **Profile guard**: a personal ask on a business/supplier seat offers to switch to the personal profile instead of spawning a business process.

## Next up — the big one: `PROFILE_LENS` (profile-kind-aware everything)
Single source of truth keyed by identity `kind` ("personal"|"business"|"supplier"):
`{ worldScope: "consumer"|"business"|"inbound", homeMode: "compose"|"inbox", suggestions, broadcastTone, capabilities }`.
Then: (1) tag each Global "world" with a `scope` and filter the world bar + businesses by `PROFILE_LENS[kind].worldScope` (business profile must NOT see 🩺 Health etc.); (2) supplier `homeMode:"inbox"` = incoming requests, not "start a process"; (3) broadcast/suggestions/capabilities per kind. Worlds live near `WORLD_EMOJI` / `worldOf()` in page.tsx; Global render ~line 3580+.

## Also open (see `web/ONE_PENDING.md`)
- **Request bus** for true two-sided handshake (a process on the personal side lands in the supplier's inbox).
- Make **booking / forms / reminders** real (like Quiz).
- **Sources feed answers** (cite official source in a regulated domain); role-gated source-adding is a placeholder.
- **Real send channel** behind Drafts (email/WhatsApp, behind permission).
- **Live incoming-reply signal** on Home when the other side answers.
- Capability started in Home runs **inside** the matching process.
- Question-vs-intent (a pure question shouldn't always spawn a process).
- Wikipedia images in unit details; fuller ONE-profile redesign; real voice input.

## Recent commits (mvp-new-one-spec)
memory · memory-context · home→process routing · Drafts · correspondence thread · Connections · AI counterpart · chat language fix · unit-card upgrades · profiles-by-type + supplier seat · personal-request guard.
