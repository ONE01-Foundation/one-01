# ONE — Current Thesis & Product Structure

_Authoritative, current model (updated 2026-10). Read this first._

> **Supersedes** the earlier **"home-as-conversation / chat-in-home"** direction.
> The home is **not** a chat. The conversation lives in a dedicated **chat window**.
> This doc is the single source of truth for the product model and what each
> window **means**; the older `ONE_MASTER_SPEC.md` / `ONE_UI_UX_SPEC.md` remain
> useful for data shapes and detail, but where they describe the home as a chat
> thread, **this doc wins**.

---

## 1. Thesis

**ONE is your permissioned digital representative.** It turns **intent into
reality** through **secure Units** and a **trusted global network**.

- **Not a chatbot** (which only _answers_) and **not an autonomous agent that acts
  AS you** with your full credentials (dots / Grok Bot). ONE acts **FOR** you and
  reveals **only what you allow** — **selective disclosure**. You hold the
  **mandate** (what ONE may decide/commit on your behalf).
- Positioning: **"תגיד מה אתה רוצה — וזה קורה."** ("Say what you want — and it
  happens.") ONE is **"an agent for everyone"** — what only celebrities and
  companies had: a representative standing before the world for you.
- **Four pillars of the moat:** representation **not** impersonation · a **network
  not a directory** (answers _from the source_, because everyone has a ONE) ·
  **trust built in** (verification + mandate + the shared Unit as the record) ·
  **privacy by design** (private by default, share only what's needed).

## 2. The three concepts (it should FEEL like two: ONE + Units)

- **ONE — identity & representation.** One ONE per person: your voice, your
  baseline disclosure, your account/trust. Always private, never a public face.
- **Unit — a secure process environment** (the irreducible unit of work). A
  private, isolated capsule for one real-world thing, holding its **own** memory,
  participants, messages, drafts, sources, timeline, disclosure, decisions, log,
  and state. ONE gets **scoped access per Unit by permission** — it does not pool
  everything into one brain. A Unit can be two-sided (a provider joins).
- **Global — shared knowledge + network.** Public **Templates**, public Units,
  **Validators** (verified pros/orgs), official **Sources**, and the market:
  **want → match → negotiate → close → fulfill → feedback**, plus **"talk to my
  ONE"** links. Flow: _Global template → private Unit instance → anonymous
  aggregate back to Global_.

**Spaces (מרחב) are collapsible.** One ONE, with Spaces (personal / business /
family) as optional contexts: **invisible by default** (one auto "personal"
space), surfaced only when you need a **public face** (a business others find) or
a **hard wall** between contexts. **Disclosure flows down and only ever
tightens** — a Unit can't expose more than its Space; a Space can't expose more
than ONE allows. You only talk to ONE; ONE **routes** each intent to the right
space/unit.

## 3. Product structure — the windows and what each MUST mean

The app is **one Home route + overlays** (no tab bar). Each surface must have
**meaning**: real actions that run and real content, not mock.

| Window | Role | Must do |
|---|---|---|
| **Home** (classic) | ONE's calm **representative face** — not a chat | Living Orb + a **live status line** (what ONE is doing for you), your spaces, the processes (scroll), and a way **in** to talk. Tapping to talk **opens the chat window**. |
| **Chat window** | The **conversation** with ONE | ONE speaks first; **compacts into a timeline** (now in the middle, past condensed above = the intent→reality ledger); intents spawn/update Units. |
| **Unit** | A secure **process environment** | The real case: steps, metrics, participants, drafts, sources, timeline, disclosure, the shared (two-sided) thread. **Where the work actually happens.** |
| **Global** | The **network + knowledge** | Instantiate templates, find validators/providers, join a shared Unit, "talk to my ONE" links; later the want→match market. |
| **ONE Profile** | Who ONE is + **what it knows about you** | Selective disclosure (open/ask/private) + memory + mandate + the **capabilities toolbox** + plan + spaces. |
| **Settings** | Preferences | Theme, language, address form, orb skin, personality. |
| **Onboarding** | **ONE-creation** = a discovery conversation | ONE speaks first with value; infers consumer/provider from the conversation (no "account type" screen); builds spaces/units; you're **ACTIVE** the moment the first thing is in motion. |

## 4. The home (classic) — explicit

The home is ONE's **resting presence and your command surface**:

- The living **Orb** (the face of ONE) + a **live status line** that says what ONE
  is doing _for you_ ("following N processes", "waiting on the plumber",
  "here for you").
- Your **spaces** and your **processes** (the cards, reached by scrolling).
- A **way in to talk** (the composer / tapping the orb) — which **opens the chat
  window**, it does **not** expand a chat thread on the home.

**Retired:** "the home is one continuous chat thread that IS the conversation."
That was a detour. The home shows what ONE _is_ and _is doing_; the talking
happens in the chat window.

## 5. The chat window — explicit

A **dedicated surface** to talk to ONE:

- **ONE speaks first** (a proactive opener from your real processes).
- The conversation **compacts into a timeline**: **now** sits in the middle
  (ONE's current line + the composer), scroll **up** to the **past condensed onto
  a timeline** (one-line entries, grouped by day — the intent→reality ledger),
  and intents turn into **Units** (cards) you can open.
- Opened from the **home**; a Unit's own thread is the same conversation renderer
  scoped to that Unit.

**Implementation status (2026-10):** the chat window is the **intended
direction**, not yet shipped. A prototype (`OneChatSheet`, with the
timeline-compaction) was built and then reverted — for now the **classic home
keeps its existing inline chat unchanged**. Revisit the extraction later;
current focus is function/architecture (below), not the home refactor.

## 6. Capabilities — the toolbox

ONE's concrete actions, routed by the chat brain (`deploy_tool` intent) + a
keyword intercept, rendered as in-conversation widgets:

- **Live:** reminders, **drafts** (the intent→reality outward message, with
  selective disclosure at send), **booking**, **forms**, **quiz**.
- **Soon / next:** sources, providers, and the two-sided **negotiation** step.

Every capability must **actually run and show real content** in the Unit/thread —
a capability that only _says_ it did something is a bug.

## 7. The goal + build priorities (now)

**Goal:** make the model **real and functional** — the windows already exist;
give each one **meaning** (real actions + real content), not design polish.

**Priorities (function & architecture, not visual design):**

1. **Home = representative only; conversation → chat window with timeline.**
2. **Make each window's actions real + show content** — remove the "coming soon"
   stubs where the real action is cheap (Global add-world, profile verification,
   etc.) and wire the rest to real data.
3. **ONE-creation onboarding** = a discovery conversation (no account-type
   screen) that builds spaces/units and reaches "active" fast.
4. **Capabilities wired end-to-end** — each tool creates/updates real Unit state.
5. **Two-sided Units + "talk to my ONE" link** as the growth loop (the network
   is a _result_ of single-player value, not a precondition).

## 8. MVP discipline

Build the model **as if this is the direction**, but do **not** build real
escrow, cryptographic ZK, a full validator marketplace, a full public wiki, or a
perfect permission engine now. MVP Unit = local memory + participants +
chat/timeline + sources + basic permissions; basic Global templates; basic
Personal + Business ONE. **Code should _allow_ the future, not build all of it.**

---

_Site language (don't scare/confuse): "Secure Units · Trusted Global Network ·
Verified Representatives · Private by default · Share only what's needed." Keep
"blockchain / zero-knowledge / escrow / validator protocol" backstage._
