# ONE — Data Model and Example Content

Audience: Claude / engineering

---

## 1. Core TypeScript types

These are suggested MVP types.

```ts
export type IdentityType = 'personal' | 'business' | 'family';

export type TagId =
  | 'health'
  | 'learning'
  | 'business'
  | 'money'
  | 'home'
  | 'family'
  | 'travel'
  | 'legal'
  | 'services'
  | 'fitness'
  | 'custom';

export interface Identity {
  id: string;
  name: string;
  type: IdentityType;
  avatarUrl?: string;
  initials?: string;
  updateCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  identityId: string;
  title: string;
  emoji: string;
  tagIds: TagId[];
  color?: string;

  broadcast: UnitBroadcastItem[];
  latestBroadcastText: [string, string?];

  lastUpdatedAt: string;
  unreadUpdates: number;

  relationLabel?: string; // Coach Eli +1, Shared +2, Sarah Salon
  visibility?: 'private' | 'shared' | 'public';

  progress?: {
    current: number;
    total: number;
    label?: string;
  };

  metrics?: UnitMetric[];
  quickActions?: UnitQuickAction[];
  nextSteps?: UnitStep[];
  people?: UnitPerson[];
  assets?: UnitAsset[];
  timeline?: UnitTimelineItem[];
  insights?: UnitInsight[];
  history?: UnitHistoryItem[];

  createdAt: string;
  updatedAt: string;
}

export interface UnitBroadcastItem {
  id: string;
  text: string;
  priority: number;
  type:
    | 'next_step'
    | 'event'
    | 'waiting'
    | 'progress'
    | 'missing_info'
    | 'attention'
    | 'calm'
    | 'system';
  createdAt: string;
}

export interface UnitMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trend?: string;
}

export interface UnitQuickAction {
  id: string;
  label: string;
  icon?: string;
  actionType:
    | 'log_weight'
    | 'add_calories'
    | 'start_workout'
    | 'add_meal'
    | 'schedule'
    | 'upload'
    | 'note'
    | 'payment'
    | 'custom';
}

export interface UnitStep {
  id: string;
  title: string;
  subtitle?: string;
  dueAt?: string;
  done?: boolean;
}

export interface UnitPerson {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  connectionType?: 'coach' | 'provider' | 'family' | 'client' | 'partner' | 'other';
}

export interface UnitAsset {
  id: string;
  title: string;
  type: 'file' | 'image' | 'link' | 'note' | 'document';
  url?: string;
  createdAt: string;
}

export interface UnitTimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  date: string;
}

export interface UnitInsight {
  id: string;
  text: string;
  createdAt: string;
}

export interface UnitHistoryItem {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  scope: 'one' | 'unit';
  unitId?: string;
  identityId: string;
  sender: 'user' | 'one' | 'person' | 'system';
  senderName?: string;
  text: string;
  createdAt: string;
}
```

---

## 2. Example Identity data

```ts
export const identities: Identity[] = [
  {
    id: 'identity_ariel',
    name: 'Ariel',
    type: 'personal',
    initials: 'A',
    updateCount: 3,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
  },
  {
    id: 'identity_one01',
    name: 'ONE01',
    type: 'business',
    initials: 'O',
    updateCount: 22,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
  },
];
```

---

## 3. Example Unit: Weight Gain

Correct English name:

```txt
Weight Gain
```

Not:
```txt
Game Weight
```

### Small process card

```txt
💪 Weight Gain                          14:20
                                          2

Next workout today at 2:00 PM.
Protein goal reached yesterday.

Coach Eli +1               ▓▓▓▓▓░░░ 21/32
────────────────────────────────────
```

### Preview

```txt
💪 Weight Gain

You've gained 3 kg since you started.

Progress       Goal       Weight
+3 kg          78 kg      72 kg

[Log Weight] [Calories] [Workout] [Meal]
```

### Full profile

```txt
💪 Weight Gain

It's been 3 days since your last weigh-in.

Overview

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

### Broadcast examples

```txt
Next workout today at 2:00 PM.
Protein target reached yesterday.
You've gained 3 kg since starting.
It's been 3 days since your last weigh-in.
Calories were below target yesterday.
Workout #22 is waiting.
You've completed 21 workouts.
Weight increased by 0.5 kg this week.
Your average sleep was 7.4 hours.
Time to record today's weight.
You've been consistent for 14 days.
```

### Quick actions

```txt
Log Weight
Calories
Workout
Meal
```

### Next steps

```txt
Today's workout
Record today's weight
Prepare tomorrow's meals
Book trainer session
Reach 73 kg milestone
```

### People

```txt
Coach Eli
Training Partner
Nutritionist
Gym
```

### Assets

```txt
Workout Plan
Meal Plan
Progress Photos
Weight Log
Supplements
Blood Tests
```

### Insights

```txt
Weight increased by 1 kg in the last month.
Most successful weeks include 4 workouts.
Protein intake is consistent.
Training consistency is 82%.
Weight updates become irregular after 3 days.
```

---

## 4. More example cards

### Driving License

```txt
🚗 Driving License                       12:34
                                          2

Next lesson is scheduled for Tuesday.
The next step is preparing for the test.

Instructor Eli              ▓▓▓▓░░░░ 5/8
────────────────────────────────────
```

### Move Apartment

```txt
🏠 Move Apartment                        Yesterday

Waiting for the architect's approval.
Kitchen measurements are still missing.

Shared +2                  ▓▓▓░░░░░ 4/9
────────────────────────────────────
```

### Injury Claim

```txt
⚖️ Injury Claim                          08:10
                                          1

Your lawyer is waiting for the medical report.
One document is still missing.

Lawyer Cohen               ▓▓░░░░░░ 3/7
────────────────────────────────────
```

### Business Website

```txt
💼 Business Website                      13:50
                                          3

The landing page is almost ready.
Payment flow still needs to be connected.

ONE01 Team                 ▓▓▓▓▓▓░░ 8/12
────────────────────────────────────
```

### Hair Appointment

```txt
💈 Hair Appointment                      10:02

Sarah Salon has openings this week.
Choose a time to continue.

Sarah Salon                ▓▓░░ 2/4
────────────────────────────────────
```

---

## 5. Broadcast generation rules

For each unit card, generate two lines:

```txt
Line 1 = what is true right now.
Line 2 = what should happen next / what is missing / what needs attention.
```

Examples:

```txt
Waiting for the architect's approval.
Kitchen measurements are still missing.
```

```txt
Next workout today at 2:00 PM.
Protein goal reached yesterday.
```

```txt
The landing page is almost ready.
Payment flow still needs to be connected.
```

```txt
Everything is up to date.
Nothing needs attention right now.
```

Do not use generic motivation as the main broadcast.

Avoid:

```txt
Believe in yourself.
You can do it.
Stay focused.
```

Allowed occasionally, but not as the main system.

---

## 6. Home Broadcast examples

Home broadcast is a reflection of all active processes.

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

Hold longer:

```txt
What matters most right now?
```

---

## 7. Empty state examples

If no processes exist:

```txt
What matters most right now?
```

```txt
Start anywhere.
```

```txt
Tell me what's on your mind.
```

```txt
One thing is enough to begin.
```

---

## 8. Visibility and relationship metadata

Use one short metadata label on the process card.

Examples:

```txt
Private
Shared +2
Public
Coach Eli +1
Sarah Salon
Lawyer Cohen
Auto
4 files
```

The metadata label should tell the user who or what is involved.

Do not show multiple labels on the small card.

More details belong inside the full process profile.
