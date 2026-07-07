# ONE — UI / UX Specification

Version: MVP UI Spec  
Audience: Claude / coding agent

---

## 1. Visual language

### Overall style

- Minimal.
- White / off-white background.
- Black text.
- Soft gray secondary text.
- Soft shadows.
- Large rounded corners.
- Capsule buttons.
- Plenty of whitespace.
- iOS-like transitions.
- No clutter.

### Radius system

```txt
Primary buttons: 28–32px radius
Input bar: 32–36px radius
Cards: 24–28px radius
Bottom sheets: 36–40px top radius
Small pills: 18–24px radius
```

Buttons should feel like capsules, not rectangles.

### Color

Use mostly neutral colors.

Accent colors should be soft and meaningful:
- Health: mint/green
- Learning: purple
- Business: black/gray
- Money: yellow/gold
- Home: blue
- Family: pink
- Travel: orange
- Legal: indigo/gray

Avoid using red unless something truly needs attention.

---

## 2. Splash

### Screen

Only ONE face / logo.

No text.

Duration:
- 1–2 seconds.

Then Welcome.

---

## 3. Welcome

### Goal

Explain enough for the user to understand ONE without making a marketing presentation.

### Recommended layout

```txt
[ONE face]

Hi, I'm ONE.

I help move things forward.

[Start with ONE]

Sign in
```

### Behavior

The first line remains:

```txt
Hi, I'm ONE.
```

The second line can rotate slowly after a few seconds.

### Loop copy

Use these in order:

```txt
I help move things forward.
```

```txt
I remember where we left off.
```

```txt
One conversation can become a process.
```

```txt
I can help with life and work.
```

```txt
I organize people, tasks and information.
```

```txt
You don't have to figure everything out first.
```

```txt
We can start with one thing.
```

```txt
I help turn intentions into action.
```

Loop closing line, hold longer:

```txt
What matters most right now?
```

### Primary button

Use a full black capsule button:

```txt
Start with ONE
```

Do not use:
- Start ONE
- Get Started
- Continue
- Create Account

### Secondary action

Small gray text:

```txt
Sign in
```

---

## 4. First Conversation

Triggered after tapping **Start with ONE**.

### Goal

Let the user start before login.

### Layout

```txt
[ONE face]

What matters most right now?

[input]
Start anywhere...
```

### Placeholder

```txt
Start anywhere...
```

Alternative:

```txt
Tell me what's on your mind...
```

### User can enter one or many intentions

Example:

```txt
I want to gain weight, finish my driving license, and build a website for my business.
```

### ONE response

ONE should parse and create proposed processes.

Example:

```txt
I can turn that into 3 processes:

💪 Weight Gain
🚗 Driving License
💼 Business Website

Let's start with these.
```

Then show a lightweight preview of created process cards.

Then ask to save.

---

## 5. Save Your ONE

Appears after the user gets first value.

### Copy

```txt
Let's save your ONE
so we can continue later.
```

### Buttons

```txt
Continue with Apple
Continue with Google
Continue with Email
```

Secondary:

```txt
Sign in
```

---

## 6. Home Broadcast

### Goal

ONE speaks to the active identity.

Home is not dashboard.
Home is not task list.
Home is not chat.

It is a broadcast layer.

### Layout

```txt
[ONE face]

Broadcast message
max 2 lines

Processes
↓

[input]
What's next?
```

### Home input placeholder

```txt
What's next?
```

Do not rotate placeholder text.

### Broadcast rules

- 1–2 lines maximum.
- No bullets.
- No carousel dots.
- No categories.
- No technical labels.
- ONE speaks naturally.
- Messages are generated from active processes.
- The last message in a loop can hold longer and invite action.

### Example broadcast loop for user with processes

```txt
Good morning.
```

```txt
You have a few things moving.
```

```txt
Weight Gain needs a quick update.
```

```txt
Your next workout is at 2:00 PM.
```

```txt
Driving License is waiting for the next lesson.
```

```txt
The business website has open decisions.
```

```txt
Nothing is urgent right now.
```

Closing line:

```txt
What matters most right now?
```

### Empty new user broadcast

If no processes exist:

```txt
What matters most right now?
```

or:

```txt
Start anywhere.
```

---

## 7. Home → Processes transition

Home and Processes should not feel like separate screens.

Use a vertical scroll/snap interaction.

### Model

```txt
scrollY = 0
Home Broadcast mode

scrollY ≈ 70% screen height
Processes mode
```

### Animation behavior

As the user scrolls down:

- ONE face moves upward and becomes smaller.
- Broadcast text fades out.
- Identity name fades in.
- Processes list appears.
- Bottom input remains anchored.
- Motion should feel like iOS lock screen / notification center.

### Development approach

Use:
- React Native Reanimated
- useSharedValue
- useAnimatedScrollHandler
- interpolate
- snapToOffsets or custom snap logic

Do not navigate to another screen for Processes.

---

## 8. Processes List

### Goal

Show living process cards.

### Header

```txt
[ONE small face]
Ariel
```

or active identity name.

### No permanent filters in MVP

Do not show search/filter unless needed.

The list itself should be enough.

### Sorting

Sort by attention score.

Attention score inputs:
- recent updates,
- upcoming event,
- user action required,
- process stuck,
- priority,
- last touched,
- deadline.

### Process Card structure

```txt
💪 Weight Gain                        14:20
                                        2

Next workout today at 2:00 PM.
Protein goal reached yesterday.

Coach Eli +1              ▓▓▓▓▓░░░ 21/32
────────────────────────────────────
```

### Layers

1. Title + time + update count.
2. Two-line process broadcast.
3. Relationship / metadata + progress.
4. Thin category color line at the bottom.

### No tags on small cards

Do not show:
- Health
- Learning
- Business
- Money

Tags belong in filtering/profile/search, not on the small card.

### No primary state label

Do not show:
- Active
- Paused
- Waiting

State should be expressed in the broadcast text.

If paused:

```txt
Paused until next month.
No action is needed right now.
```

If waiting:

```txt
Waiting for the architect's approval.
Kitchen measurements are still missing.
```

### Card metadata examples

```txt
Coach Eli +1
Shared +2
Sarah Salon
Auto
Private
Public
4 files
```

### Progress

Use a small progress bar + count if steps are defined.

```txt
21/32
5/8
2/4
```

Do not use percentages in the card.

If no clear progress exists, hide progress.

---

## 9. Process Card tap behavior

Tap process card:

```txt
Card → Preview Sheet
```

Not:
```txt
Card → Chat
```

Process is not primarily a chat.
The chat is one mode inside the process.

---

## 10. Process Preview Sheet

### Goal

A quick peek into the process.

### Behavior

The sheet opens from the bottom, not centered.

Height:
- initial: 70–80% screen
- can expand to full-screen by scroll/pan

### Layout

```txt
[menu]                           [x]

💪 Weight Gain

You've gained 3 kg since you started.

Progress       Goal       Weight
+3 kg          78 kg      72 kg

[Log Weight] [Calories] [Workout] [Meal]

[input]
Add an update...
```

### Emoji placement

Use emoji inline with the title:

```txt
💪 Weight Gain
```

Do not use a large centered emoji as the main visual.

The process is not a character.

### Broadcast

Process Preview has a process-specific broadcast.

One line or max two lines.

Examples:

```txt
You've gained 3 kg since you started.
```

```txt
It's been 3 days since your last weigh-in.
```

```txt
Next workout today at 2:00 PM.
```

### Quick actions

Use up to 4 context-specific actions.

Weight Gain:
- Log Weight
- Calories
- Workout
- Meal

Driving License:
- Lesson
- Test
- Instructor
- Payment

Move Apartment:
- Payment
- Document
- Supplier
- Photo

Business Website:
- Task
- Design
- Copy
- Publish

Preview = frequent actions.

The plus/input menu = all actions.

---

## 11. Process Full Profile

Expanded from Preview by scroll/pan.

### Structure

Use vertical sections / accordions, not tabs.

Recommended order:

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

### Header

```txt
[menu]                           [x]

💪 Weight Gain
```

### Overview metrics

Horizontal App Store style cards.

For Weight Gain:

```txt
Weight
72 kg

Goal
78 kg

Progress
+3 kg

Calories
3600

Protein
160 g

Workouts
21

Sleep
7.5 h

Streak
14 days

Started
May 2026
```

### Sections

#### Next Steps

```txt
Today's workout
Record today's weight
Prepare tomorrow's meals
Book trainer session
Reach 73 kg milestone
```

#### People

```txt
Coach Eli
Training Partner
Nutritionist
Gym
```

#### Assets

```txt
Workout Plan
Meal Plan
Progress Photos
Weight Log
Supplements
Blood Tests
```

#### Timeline

```txt
Started Weight Gain
Reached 70 kg
Completed Workout #10
Reached Protein Goal
Reached 72 kg
```

#### Insights

Generated by ONE:

```txt
Weight increased by 1 kg in the last month.
Most successful weeks include 4 workouts.
Protein intake is consistent.
Training consistency is 82%.
```

#### History

Full chronological log.

#### Settings

Name, emoji, color, visibility, shared users, auto tracking, archive, delete.

---

## 12. Process Chat

Triggered by:
- tapping the input in Preview/Profile,
- tapping microphone,
- choosing a quick action that needs text input.

### Behavior

Same process sheet transforms into conversation mode.

Do not open a totally separate screen.

### Layout

```txt
[menu]                           [x]

💪 Weight Gain
21/32

[conversation]

[input]
Add an update...
[keyboard]
```

### Keyboard

The keyboard should feel inside the sheet/card, not floating above it.

### Returning to profile

Tap the process title/header to return to Profile mode.

### Input placeholder

Inside process:

```txt
Add an update...
```

Not:
```txt
What's next?
```

Home uses What's next.
Process uses Add an update.

---

## 13. General ONE Chat

Triggered from Home input.

### Layout

```txt
[ONE face]

What now?

[input]
What's next?
```

### Do not show

- X
- three dots
- history menu
- process-specific suggestions

General ONE Chat is open-ended.

Tap ONE:
- opens ONE Profile

Long press ONE:
- opens Identity Switch

---

## 14. ONE Profile

Tap ONE face.

### This is agent profile, not user profile.

Contains:

```txt
Active Identity
Memory
History
Connected Accounts
Tools
Settings
Identities
```

### Active Identity card

```txt
Ariel
Personal
```

Tap opens Identity Switch.

---

## 15. Identity Switch

### Title

```txt
Your Identities
```

### List

```txt
Ariel
Personal

ONE01
Business

Family
Family
```

### Add action

```txt
+ Add Identity
```

Small, centered, secondary capsule.

### No Continue button

Tap identity:
- select it,
- close sheet,
- update active identity.

### Switching identity

Identity is root context.

Preferred behavior:
- if on Home, show Home Broadcast for selected identity.
- if in Processes, show Processes for selected identity.
- if inside a process that does not exist in new identity, close process and show Processes.

---

## 16. Button system

### Primary button

Full black capsule.

Text examples:
- Start with ONE
- Save Your ONE
- Continue with Apple
- Continue with Google

### Secondary action

Gray text or soft capsule.

Examples:
- Sign in
- + Add Identity
- Maybe later

---

## 17. Copy rules

Use plain, truthful language.

Avoid:
- AI-powered
- productivity platform
- life OS
- revolutionary
- next-generation
- optimize your life
- manage everything

Prefer:
- move forward
- process
- what matters
- continue
- remember
- organize
- people, tasks and information
- one thing
- start anywhere
- turn intentions into action

---

## 18. Interaction summary

```txt
Welcome button → First Conversation

Home input → General ONE Chat

Scroll down Home → Processes

Process card tap → Preview Sheet

Preview scroll up → Full Process Profile

Process input tap → Process Chat

Process header tap → Profile mode

ONE face tap → ONE Profile

ONE face long press → Identity Switch

Identity tap → switch active identity

+ Add Identity → create new identity flow
```
