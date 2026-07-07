# Claude Implementation Prompt — ONE MVP

Paste this into Claude/Cursor/Codex as the working instruction.

---

You are building the MVP of ONE.

ONE is a personal and business operating layer where one AI agent helps the user turn intentions into living processes.

Do not build a generic chatbot.
Do not build a task manager.
Do not build Notion.
Do not build Discovery-first.
Do not build Merchant CRM-first.
Do not build around Spaces.

The new structure is:

```txt
ONE01 = global network / public layer
ONE = central agent
Identity = active context: Personal / Business / Family
Unit = internal object for a process
Process = user-facing word for Unit
Tag = view/filter only
```

## Important decisions

- `Space` should become `Identity`.
- `Lens` should become `Tag`.
- Health / Learning / Money are not Spaces.
- Tags are not root navigation.
- Unit is code terminology.
- Process is user-facing terminology.
- Home is Broadcast, not dashboard.
- Process tap opens Preview/Profile, not Chat.
- Process Chat is a mode inside the process sheet.
- Login is delayed until after first value.

---

## First milestone

Build a working flow with mock data if needed:

```txt
Splash
↓
Welcome
↓
Start with ONE
↓
First Conversation
↓
Create mock processes from user input
↓
Save Your ONE
↓
Home Broadcast
↓
Scroll/Snap down to Processes
↓
Tap Process
↓
Process Preview Sheet
↓
Expand to Full Process Profile
↓
Tap Input
↓
Process Chat
```

This working visible flow matters more than perfect backend logic.

---

## Welcome copy

Layout:

```txt
[ONE face]

Hi, I'm ONE.

I help move things forward.

[Start with ONE]

Sign in
```

Second line rotates slowly:

```txt
I help move things forward.
I remember where we left off.
One conversation can become a process.
I can help with life and work.
I organize people, tasks and information.
You don't have to figure everything out first.
We can start with one thing.
I help turn intentions into action.
What matters most right now?
```

Button:

```txt
Start with ONE
```

Secondary:

```txt
Sign in
```

---

## First Conversation

After Start with ONE:

```txt
[ONE face]

What matters most right now?

Input placeholder:
Start anywhere...
```

User can enter multiple intentions.

Example:

```txt
I want to gain weight, finish my driving license, and build a website for my business.
```

ONE should create process previews:

```txt
I can turn that into 3 processes:

💪 Weight Gain
🚗 Driving License
💼 Business Website
```

Then show Save Your ONE.

---

## Home Broadcast

Not dashboard.

Layout:

```txt
[ONE face]

One broadcast message
max 2 lines

Processes
↓

Input:
What's next?
```

Home input placeholder:

```txt
What's next?
```

Messages should come from processes, not generic affirmations.

Examples:

```txt
Weight Gain needs a quick update.
Your next workout is at 2:00 PM.
Driving License is waiting for the next lesson.
The business website has open decisions.
Nothing is urgent right now.
What matters most right now?
```

---

## Home → Processes

Do not navigate to a new screen.

Use an animated vertical scroll/snap.

Use Reanimated if possible:
- shared scrollY
- interpolate
- animated styles
- snapToOffsets or custom snap.

As the user scrolls:
- ONE face moves up and scales down.
- Broadcast fades out.
- Active identity name fades in.
- Process cards appear.

---

## Process card

Structure:

```txt
💪 Weight Gain                        14:20
                                        2

Next workout today at 2:00 PM.
Protein goal reached yesterday.

Coach Eli +1              ▓▓▓▓▓░░░ 21/32
────────────────────────────────────
```

Rules:
- no tags on small card,
- no state label,
- state is expressed in the broadcast,
- progress is optional,
- if progress exists use count like 21/32, not percentage,
- thin bottom line can use tag/category color.

---

## Process Preview

Tap card opens bottom sheet.

Initial height: 70–80%.

Layout:

```txt
[menu]                           [x]

💪 Weight Gain

You've gained 3 kg since you started.

Progress       Goal       Weight
+3 kg          78 kg      72 kg

[Log Weight] [Calories] [Workout] [Meal]

Input:
Add an update...
```

Quick actions up to 4.

---

## Full Process Profile

Expanded by scroll/pan.

Vertical sections, no tabs:

```txt
Header
Broadcast
Overview Metrics
Quick Actions
Next Steps
People
Assets
Timeline
Insights
History
Settings
```

Use accordion-like rows.

---

## Process Chat

Tap process input or mic.

Same sheet transforms into chat mode.

Layout:

```txt
[menu]                           [x]

💪 Weight Gain
21/32

Conversation

Input:
Add an update...

Keyboard
```

Keyboard should feel inside the sheet.

Tap process title/header returns to profile mode.

---

## General ONE Chat

Home input opens general chat.

Layout:

```txt
[ONE face]

What now?

Input:
What's next?
```

No X.
No three-dot menu.
No forced suggestions.

Tap ONE opens ONE Profile.
Long press ONE opens Identity Switch.

---

## ONE Profile

Agent profile.

Contains:
- Active Identity
- Memory
- History
- Connected Accounts
- Tools
- Settings
- Identities

---

## Identity Switch

Title:

```txt
Your Identities
```

List:
```txt
Ariel
Personal

ONE01
Business
```

Action:
```txt
+ Add Identity
```

No Continue button.

Tap identity to switch.

---

## Mock data to use

Create at least these identities:

```txt
Ariel — Personal
ONE01 — Business
```

Create these processes:

```txt
Weight Gain
Driving License
Move Apartment
Business Website
Injury Claim
```

---

## Docs to maintain

Create/update:

```txt
README.md
PRODUCT.md
UI_RULES.md
FLOW.md
ARCHITECTURE.md
DECISIONS.md
TODO.md
```

After every major step, update DECISIONS.md and TODO.md.

---

## Development rule

Do not do endless refactor before visible progress.

First build a working skeleton.
Then connect old code.
Then clean.

Target first visible result:

```txt
Welcome → First Conversation → Home Broadcast → Processes → Process Preview
```
