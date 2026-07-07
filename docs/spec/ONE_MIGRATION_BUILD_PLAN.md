# ONE — Migration / Build Plan for Existing `one-01` Repo

Audience: Claude / coding agent

---

## 1. Context

The existing repo may contain old concepts:

- NOW Sphere
- Spaces
- Lenses
- Discovery
- Provider CRM
- Merchant surfaces
- HomePager
- huge OneScreen.tsx

The new spec is different.

Do not keep building the old product.

---

## 2. Key refactor

### Rename concepts

```txt
SpaceId → IdentityId
Lens → Tag
Unit remains Unit in code
Process is UI terminology
```

`personal`, `business`, `family` can remain values, but they are Identity types/context, not Spaces.

### Remove or freeze old features

Archive or disconnect:
- Discovery screens
- Provider profile screens
- Merchant CRM
- HomePager if it conflicts
- old Lenses UI
- old Space-first navigation

Do not delete permanently if unsure. Move to `_archive/`.

---

## 3. Important architectural split

If there is a huge `OneScreen.tsx`, split it.

Target files:

```txt
src/screens/WelcomeScreen.tsx
src/screens/FirstConversationScreen.tsx
src/screens/HomeBroadcastScreen.tsx
src/screens/OneChatScreen.tsx
src/features/processes/ProcessesList.tsx
src/features/processes/ProcessCard.tsx
src/features/processes/ProcessPreviewSheet.tsx
src/features/processes/ProcessProfile.tsx
src/features/processes/ProcessChatMode.tsx
src/features/identity/IdentitySwitchSheet.tsx
src/features/one-profile/OneProfileSheet.tsx
```

---

## 4. Suggested folder structure

```txt
src/
  app/
  screens/
    WelcomeScreen.tsx
    FirstConversationScreen.tsx
    HomeBroadcastScreen.tsx
    OneChatScreen.tsx

  features/
    home/
      HomeBroadcast.tsx
      HomeToProcessesScroll.tsx
      BroadcastText.tsx

    processes/
      ProcessCard.tsx
      ProcessesList.tsx
      ProcessPreviewSheet.tsx
      ProcessProfile.tsx
      ProcessChatMode.tsx
      ProcessQuickActions.tsx
      ProcessMetrics.tsx
      ProcessSections.tsx

    identity/
      IdentitySwitchSheet.tsx
      IdentityRow.tsx
      AddIdentityButton.tsx

    one-profile/
      OneProfileSheet.tsx

    onboarding/
      WelcomeLoop.tsx
      FirstConversation.tsx
      SaveYourOne.tsx

  core/
    identity.ts
    unit.ts
    tags.ts
    broadcast.ts
    attentionScore.ts

  data/
    mockIdentities.ts
    mockUnits.ts
    mockBroadcasts.ts

  theme/
    colors.ts
    spacing.ts
    typography.ts
    radii.ts

  docs/
```

---

## 5. Build order

### Step 1 — Make it visible

Build these with mock data:

1. Welcome
2. First Conversation
3. Home Broadcast
4. Home → Processes vertical scroll
5. Process card
6. Process preview sheet

Do not block on backend.

### Step 2 — Add process depth

1. Full Process Profile
2. Process Chat mode
3. Quick Actions
4. Process input behavior
5. Keyboard handling

### Step 3 — Add identity

1. Identity switch sheet
2. Active identity data filtering
3. Identity name in Processes
4. ONE Profile

### Step 4 — Connect old logic

Only after the visible skeleton works:
- connect compiler,
- connect existing units schema,
- connect broadcast engine,
- connect persistence.

---

## 6. Attention score

Create a simple MVP function.

```ts
export function attentionScore(unit: Unit): number {
  let score = 0;

  score += unit.unreadUpdates * 10;

  if (unit.broadcast?.[0]?.type === 'attention') score += 50;
  if (unit.broadcast?.[0]?.type === 'missing_info') score += 40;
  if (unit.broadcast?.[0]?.type === 'event') score += 30;
  if (unit.broadcast?.[0]?.type === 'waiting') score += 20;

  // Recency
  const hoursSinceUpdate = getHoursSince(unit.lastUpdatedAt);
  score += Math.max(0, 24 - hoursSinceUpdate);

  return score;
}
```

Use this to sort process cards.

---

## 7. Home scroll implementation

Use one screen.

Pseudo:

```tsx
const scrollY = useSharedValue(0);

const onScroll = useAnimatedScrollHandler({
  onScroll: (event) => {
    scrollY.value = event.contentOffset.y;
  },
});

const oneStyle = useAnimatedStyle(() => ({
  transform: [
    { scale: interpolate(scrollY.value, [0, SNAP], [1, 0.55]) },
    { translateY: interpolate(scrollY.value, [0, SNAP], [0, -160]) },
  ],
}));

const broadcastStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [0, SNAP * 0.6], [1, 0]),
}));

const identityStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.value, [SNAP * 0.4, SNAP], [0, 1]),
}));
```

Snap points:

```ts
const SNAP_HOME = 0;
const SNAP_PROCESSES = screenHeight * 0.72;
```

---

## 8. Bottom sheet

Use either:
- `@gorhom/bottom-sheet`, or
- custom Reanimated sheet.

Preferred for speed:
`@gorhom/bottom-sheet`

Process Preview snap points:

```ts
['72%', '100%']
```

Process Chat:
- same sheet,
- mode state changes from `profile` to `chat`,
- keyboard handling enabled.

---

## 9. Minimum docs to update

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

Every completed implementation step should update:

- TODO.md
- DECISIONS.md

---

## 10. Definition of first success

The first success is not a perfect backend.

The first success is seeing this on device:

```txt
Welcome
↓
Start with ONE
↓
First Conversation
↓
Home Broadcast
↓
Swipe down to Processes
↓
Tap Weight Gain
↓
Preview opens
↓
Swipe up to full profile
↓
Tap input
↓
Chat mode
```

This is the MVP spine.
