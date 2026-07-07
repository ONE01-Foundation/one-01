# ONE — Master Product Specification for Claude

Version: MVP Spec  
Date: 2026-06-23  
Audience: Claude / coding agent / product engineer  
Language: English for implementation clarity

---

## 0. One-line definition

**ONE is a personal and business operating layer where one AI agent helps a person turn intentions into living processes.**

It is not a generic chatbot.  
It is not a task manager.  
It is not Notion.  
It is not a CRM-first product.  
It is not a dashboard.

ONE is the layer between:

- intention and reality,
- a person and the things that need to happen,
- a client and a business,
- one identity and another identity,
- conversation and action.

---

## 1. Core idea

A user talks to **ONE**.

ONE remembers context, creates processes, keeps them alive, shows what needs attention, and helps move things forward.

The user does not need to open folders, build dashboards, create boards, or organize everything manually.

The user can say:

> I want to gain weight, finish my driving license, and build a website for my business.

ONE turns that into structured processes.

Each process has:
- memory,
- state,
- people,
- files,
- updates,
- metrics,
- next steps,
- chat,
- broadcast.

---

## 2. Product hierarchy

The current product model is:

```txt
ONE01
  ↓
ONE
  ↓
Identity
  ↓
Unit / Process
  ↓
Broadcast / Profile / Chat / Actions / Memory
```

### ONE01

The global network / company / public layer.

This is the world above the personal user.

In the future, ONE01 can include:
- global discovery,
- public templates,
- businesses,
- public profiles,
- marketplace,
- identity-to-identity connections.

For the MVP, ONE01 is mostly conceptual and should not dominate the product.

### ONE

The central agent.

The user talks to ONE.

ONE is not the user.
ONE is not the business.
ONE is the digital agent that operates across identities.

### Identity

An identity is the active context from which ONE acts.

Examples:
- Ariel — Personal
- ONE01 — Business
- Family
- Sarah Salon — Business
- Cohen Clinic — Business

An identity answers:

> Who am I operating as right now?

Identity is root-level context.

Switching identity changes the active world of processes, memory, people, and broadcast.

### Unit / Process

A Unit is the internal code object.

A Process is the user-facing word.

A Unit/Process is a living operational object around a goal, desire, responsibility, case, project, event, person, or service.

Examples:
- Weight Gain
- Driving License
- Move Apartment
- Injury Claim
- Greece Trip
- Build ONE MVP
- Hair Appointment
- Roof Unit Permit
- Wedding Planning
- Business Launch
- Client Website

A process is not a single task.
It is a living object with context.

### Tag

Tags are views only.

Examples:
- Health
- Learning
- Money
- Home
- Business
- Legal
- Travel
- Family

Tags are not spaces.
Tags are not root navigation.
Tags are not identities.

Tags can be used for filtering, summaries, search, and profile views.

---

## 3. Important terminology decisions

### Code terminology

Use:

```ts
Unit
Identity
Tag
Broadcast
ProcessCard
UnitProfile
UnitChat
OneProfile
```

### User-facing terminology

Use:

```txt
Process / Processes
Identity / Identities
ONE
```

Avoid showing “Unit” to the user unless internally.

### Do not use

Avoid rebuilding old terminology around:

```txt
Space
Lens
World as main app structure
NOW Sphere
Discovery-first
Merchant CRM-first
```

If these exist in the old repo, they should be renamed, archived, or reduced.

---

## 4. What makes ONE different from GPT / Gemini / Claude

GPT is mostly a chat session.

ONE is a persistent operating layer.

Differences:

| Generic AI Chat | ONE |
|---|---|
| User asks, model answers | User starts, ONE creates and manages processes |
| Mostly stateless conversations | Persistent identity + memory + processes |
| Chat-first | Broadcast + process + profile + chat |
| User organizes manually | ONE organizes around intention |
| One conversation at a time | Many living processes |
| No operational object | Process is an operational object |
| Generic assistant | Digital representative / partner |
| Text response | Conversation becomes action |

---

## 5. Design philosophy

ONE should feel:

- calm,
- minimal,
- alive,
- personal,
- premium,
- soft,
- intelligent,
- not gamified,
- not corporate,
- not dashboard-heavy.

The product should feel like:

> a quiet digital partner that knows what is going on and helps move things forward.

Avoid:
- too many buttons,
- excessive filters,
- tabs everywhere,
- dashboards,
- productivity-app clutter,
- SaaS language,
- heavy onboarding,
- “AI-powered” marketing language.

---

## 6. Navigation model

ONE should feel like one living surface, not many disconnected pages.

Main vertical model:

```txt
Global / ONE01
   ↑

Home Broadcast
   ↓

Processes
```

Home and Processes should ideally be one screen with vertical scroll/snap.

Home is not a dashboard.  
Home is ONE speaking.

Processes is where the structure is visible.

---

## 7. MVP screens

The MVP should include:

1. Splash
2. Welcome
3. First Conversation
4. Save Your ONE / Sign in
5. Home Broadcast
6. General ONE Chat
7. Processes List
8. Identity Switch
9. Unit / Process Preview
10. Unit / Process Profile
11. Unit / Process Chat
12. ONE Profile

Do not prioritize:
- full marketplace,
- discovery,
- provider CRM,
- complex public profiles,
- advanced automation,
- payments,
- real external integrations,
- full calendar/Gmail connectors.

Mock data is acceptable for MVP if the flow works.

---

## 8. Golden path

The first working MVP path should be:

```txt
Splash
↓
Welcome
↓
Start with ONE
↓
First conversation
↓
User enters first intention(s)
↓
ONE creates first process(es)
↓
Save Your ONE
↓
Home Broadcast
↓
Scroll down to Processes
↓
Tap Process
↓
Preview Sheet
↓
Expand to Process Profile
↓
Tap Input
↓
Process Chat
```

This path matters more than perfect backend logic.

---

## 9. Account and login philosophy

Do not force login first.

Recommended flow:

1. User sees Welcome.
2. User clicks **Start with ONE**.
3. User starts a conversation.
4. ONE creates one or more processes.
5. Then ONE asks to save.

Copy:

```txt
Let's save your ONE
so we can continue later.
```

Buttons:
- Continue with Apple
- Continue with Google
- Continue with Email
- Sign in

The account is positioned as saving the relationship, not as a signup wall.

---

## 10. Business concept

A user can have multiple identities.

Example:

```txt
Ariel — Personal
Sarah Salon — Business
Cohen Clinic — Business
Family — Family
```

A business identity is still operated by ONE, but in a business context.

If the user owns a salon, the salon is their Business Identity.

If the user wants to book with an external salon, that salon is not the user's identity. It is a connected external Business Profile / Contact.

Future concept:

```txt
Ariel's ONE
  ↔ connection ↔
Sarah Salon's ONE
```

This is where ONE becomes a broker between client and business.

For MVP, represent this only as data and UI concepts. Do not build the full handshake yet.

---

## 11. Product principle

The product should not ask the user to manage the system.

The product should help the user move forward.

The UI should reveal structure only when needed.

Home:
- natural broadcast,
- one thought at a time.

Processes:
- structured list.

Process Profile:
- all process data.

Process Chat:
- action and updates.

ONE Profile:
- agent settings, memory, identities.

---

## 12. Final north star

ONE should make the user feel:

> “I do not need to hold everything in my head.  
> ONE knows the context and helps me move the next thing forward.”
