/**
 * HomeFocus — an ALTERNATE Home layout ("focus" mode), switchable from
 * Settings → "מסך הבית". It pulls the same real building blocks as the classic
 * HomeScreen (the Orb, the user's actual Units, visibility/disclosure, ONE's
 * chat brain) but composes them from a blank canvas into a calmer, product-grade
 * launcher:
 *
 *   ┌─────────────────────────────┐
 *   │  space ⌄            ⚙︎       │   header: switch space · settings
 *   │                             │
 *   │           ◕◕               │   the figure (tap → ONE profile)
 *   │     Good morning, Ariel     │   ONE speaks: greeting + what needs you
 *   │                             │
 *   │  צריך ממך ─────────────────  │   0–2 things that need the user
 *   │  [ card ]  [ card ]          │
 *   │  בטיפול ───────────────────  │   the live processes
 *   │  [ card ] [ card ] [ card ]  │
 *   │                             │
 *   │  [ + ][ תן ל-ONE משימה…  ➤ ] │   composer (talks to ONE)
 *   │       Want more? Upgrade     │
 *   └─────────────────────────────┘
 *
 * The flow: ONE reports in at the top → the few things that need you → the work
 * it's handling → one way in (talk / +). Tapping a card opens the real Unit
 * sheet; the + opens Quick Actions; the orb opens ONE's profile; the composer
 * runs a real turn with ONE (invokeAiChat) and persists into the shared homeChat.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLocaleStore } from '../../stores/localeStore';
import {
  useActiveUnits,
  useActiveIdentity,
  useMvpStore,
  disclosureForIdentity,
} from '../../stores/mvpStore';
import type { Unit } from '../../core/mvp/types';
import { Orb } from '../../components/mvp/Orb';
import { haptic } from '../../utils/haptics';
import { rtlText, rtlRow } from '../../utils/rtl';
import { invokeOneIntent } from '../../services/aiChat';
import { personalityPrompt } from '../../data/mvp/agentAppearance';
import { desireToUnit } from '../../utils/mvpInferUnit';
import { openDisclosureStrings } from '../../data/mvp/disclosure';
import { unitFromIntent, findSimilarUnit } from '../../utils/intentToUnit';
import { resolveSpaceIdentityId } from '../../utils/spaceRouting';
import { enrichUnitFromArchetype } from '../../data/mvp/unitArchetype';
import { localOneIntent } from '../../utils/localIntent';
import { buildLocalProcess } from '../../utils/localProcess';

export interface HomeFocusProps {
  /** Open a process (Unit) sheet. */
  onTapUnit: (id: string) => void;
  /** Long-press a process → open straight into its chat. */
  onLongPressUnit?: (id: string) => void;
  /** Tap the orb → ONE's profile (or sign-in when not onboarded). */
  onTapOrb: () => void;
  /** Long-press the orb / tap the gear → Settings. */
  onLongPressOrb?: () => void;
  /** Tap the space chip → identity switch. */
  onTapHeader?: () => void;
  /** The + → Quick Actions (new process). */
  onCreateProcess: () => void;
  /** Not-onboarded taps route here. */
  onSignIn?: () => void;
  /** The "Upgrade" line → pricing. */
  onUpgrade?: () => void;
}

const ATTENTION_TYPES = ['attention', 'missing_info', 'waiting'];

function relTime(iso: string | undefined, he: boolean): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return he ? 'עכשיו' : 'now';
  if (m < 60) return `${m}${he ? ' ד׳' : 'm'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${he ? ' ש׳' : 'h'}`;
  const d = Math.floor(h / 24);
  if (d === 1) return he ? 'אתמול' : '1d';
  return `${d}${he ? ' י׳' : 'd'}`;
}

function visMeta(vis: Unit['visibility'], he: boolean): { label: string; icon: string } {
  switch (vis) {
    case 'shared':
      return { label: he ? 'משותף' : 'Shared', icon: '👥' };
    case 'public':
      return { label: he ? 'ציבורי' : 'Public', icon: '🌐' };
    default:
      return { label: he ? 'פרטי' : 'Private', icon: '🔒' };
  }
}

export function HomeFocus({
  onTapUnit,
  onLongPressUnit,
  onTapOrb,
  onLongPressOrb,
  onTapHeader,
  onCreateProcess,
  onSignIn,
  onUpgrade,
}: HomeFocusProps) {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const language = useLocaleStore((s) => s.language);
  const he = language === 'he';
  const lang = he ? 'he' : 'en';

  const units = useActiveUnits();
  const identity = useActiveIdentity();
  const name = useMvpStore((s) => s.name);
  const plan = useMvpStore((s) => s.plan);
  const hasOnboarded = useMvpStore((s) => s.hasCompletedOnboarding);

  // ── Derive the three bands from real unit state ────────────────────────────
  const active = useMemo(() => units.filter((u) => u.status !== 'completed'), [units]);
  const completedCount = units.length - active.length;
  const needsYou = useMemo(
    () =>
      active
        .filter(
          (u) =>
            u.unreadUpdates > 0 ||
            (u.broadcast?.[0] && ATTENTION_TYPES.includes(u.broadcast[0].type)),
        )
        .slice(0, 3),
    [active],
  );
  const needIds = useMemo(() => new Set(needsYou.map((u) => u.id)), [needsYou]);
  const inProgress = useMemo(() => active.filter((u) => !needIds.has(u.id)), [active, needIds]);

  // ── ONE speaks ─────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const g =
      h < 12 ? (he ? 'בוקר טוב' : 'Good morning')
      : h < 18 ? (he ? 'צהריים טובים' : 'Good afternoon')
      : (he ? 'ערב טוב' : 'Good evening');
    return name ? `${g}, ${name}` : g;
  }, [he, name]);

  const summary = useMemo(() => {
    if (needsYou.length > 0)
      return he
        ? `${needsYou.length} ${needsYou.length === 1 ? 'דבר צריך' : 'דברים צריכים'} אותך — השאר אצלי.`
        : `${needsYou.length} ${needsYou.length === 1 ? 'thing needs' : 'things need'} you — I've got the rest.`;
    if (active.length > 0) return he ? 'הכול בטיפול. אני על זה.' : "Everything's handled. I'm on it.";
    return he ? 'ספר לי מה לקדם, ואני אדאג לזה.' : "Tell me what to move forward — I'll handle it.";
  }, [needsYou.length, active.length, he]);

  // ── Composer → a real turn with ONE (persists into the shared homeChat) ──────
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [userEcho, setUserEcho] = useState<string | null>(null);
  const [oneReply, setOneReply] = useState<string | null>(null);

  const clearPeek = useCallback(() => {
    setUserEcho(null);
    setOneReply(null);
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    if (!hasOnboarded) {
      onSignIn?.();
      return;
    }
    haptic.tap();
    setDraft('');
    setUserEcho(text);
    setOneReply(null);
    setThinking(true);
    const ts = Date.now();
    const he2 = lang === 'he';
    const store = useMvpStore.getState();
    const aid = store.activeIdentityId;
    const activeUnits = store.units.filter((u) => u.identityId === aid);
    store.appendHomeChat({ id: `u_${ts}`, from: 'user', text, ts });
    try {
      // The REAL ONE brain — the same intent pipeline the classic home uses. ONE
      // doesn't just chat: a durable intention becomes a live process on the home.
      const intent = await invokeOneIntent(text, {
        identityName: store.identities.find((i) => i.id === aid)?.name,
        unitsCount: activeUnits.length,
        voiceStyle: personalityPrompt(store.agentPersonality, lang),
        history: store.homeChat
          .slice(-6)
          .map((m) => ({ role: (m.from === 'one' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.text })),
        userMemories: store.memories.map((m) => m.text),
        userDisclosure: openDisclosureStrings(disclosureForIdentity(aid), he2),
        existingUnits: activeUnits.slice(0, 12).map((u) => ({ title: u.title, emoji: u.emoji, tags: u.tagIds })),
        spaces: store.identities.map((i) => ({ type: i.type, name: i.name, active: i.id === aid })),
      });
      let reply = intent.reply;

      if (intent.kind === 'create_process') {
        const proposedTitle = intent.process?.title?.trim() || text;
        const similar = findSimilarUnit(proposedTitle, activeUnits, aid);
        if (similar) {
          // Don't spawn a duplicate — fold the new intent into the matching
          // process as fresh next-steps (mirrors the classic home's guard).
          const target = activeUnits.find((u) => u.id === similar.id);
          if (target) {
            const stepTitles =
              intent.process?.nextSteps && intent.process.nextSteps.length > 0
                ? intent.process.nextSteps
                : [proposedTitle];
            const newSteps = stepTitles.slice(0, 3).map((title, i) => ({ id: `ns_${Date.now()}_${i}`, title, done: false }));
            store.updateUnit(target.id, {
              nextSteps: [...(target.nextSteps ?? []), ...newSteps],
              unreadUpdates: (target.unreadUpdates ?? 0) + 1,
              lastUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            store.pushUnitNotification({
              unitId: target.id,
              text: `Captured: ${newSteps.map((s) => s.title).join(', ')}`,
              emoji: target.emoji,
              kind: 'capture',
            });
            reply = he2 ? `הוספתי ל-${target.title}. ${intent.reply}` : `Added to ${target.title}. ${intent.reply}`;
          }
        } else {
          // A new process is born — enriched from its domain archetype so it
          // never opens as a bare title, routed to the right space.
          const targetId = resolveSpaceIdentityId(intent.process?.space, store.identities, aid);
          const base = unitFromIntent(intent, targetId, lang) ?? desireToUnit(text, targetId);
          const created = enrichUnitFromArchetype(base, text, lang);
          store.addUnit(created);
          haptic.success();
          store.pushUnitNotification({
            unitId: created.id,
            text: `New process: ${created.title}`,
            emoji: created.emoji,
            kind: 'created',
          });
        }
      }

      const rts = Date.now();
      store.appendHomeChat({ id: `o_${rts}`, from: 'one', text: reply, ts: rts });
      setOneReply(reply);
    } catch {
      // OFFLINE BRAIN — the AI backend is unreachable (no network / blocked edge
      // function / CORS in a browser). Classify the message LOCALLY and still ACT,
      // so ONE generates a real, enriched process instead of a dead "try again".
      // Mirrors the classic home's offline path.
      const contentHe = /[֐-׿]/.test(text);
      const cLang: 'he' | 'en' = contentHe ? 'he' : 'en';
      const li = localOneIntent(text, { lang: cLang });
      if (li.kind === 'create_process') {
        const created = buildLocalProcess(text, store.identities, aid);
        store.addUnit(created);
        haptic.success();
        store.pushUnitNotification({
          unitId: created.id,
          text: `New process: ${created.title}`,
          emoji: created.emoji,
          kind: 'created',
        });
        const r = he2
          ? `פתחתי תהליך: ${created.emoji} ${created.title}. נבנה אותו יחד.`
          : `Opened a process: ${created.emoji} ${created.title}. Let's build it together.`;
        store.appendHomeChat({ id: `o_${Date.now()}`, from: 'one', text: r, ts: Date.now() });
        setOneReply(r);
      } else {
        const r = he2
          ? 'קיבלתי — אני מחזיק את זה. (אין חיבור כרגע; כשיחזור אדייק ואקדם.)'
          : "Got it — I'm holding it. (Offline right now; I'll refine and move it when I'm back.)";
        store.appendHomeChat({ id: `o_${Date.now()}`, from: 'one', text: r, ts: Date.now() });
        setOneReply(r);
      }
    } finally {
      setThinking(false);
    }
  }, [draft, thinking, hasOnboarded, onSignIn, lang]);

  const heroLine = oneReply ?? summary;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header: space chip · settings gear */}
      <View style={[styles.header, rtlRow(lang)]}>
        <Pressable
          onPress={() => (hasOnboarded ? onTapHeader?.() : onSignIn?.())}
          style={[styles.spaceChip, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'החלף מרחב' : 'Switch space'}
        >
          <Text style={[styles.spaceChipText, { color: colors.text }]} numberOfLines={1}>
            {identity?.name || (he ? 'אישי' : 'Personal')}
          </Text>
          <Text style={[styles.spaceChevron, { color: colors.textSecondary }]}>⌄</Text>
        </Pressable>
        <Pressable
          onPress={() => (hasOnboarded ? onLongPressOrb?.() : onSignIn?.())}
          hitSlop={12}
          style={[styles.gear, { backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={he ? 'הגדרות' : 'Settings'}
        >
          <Text style={[styles.gearGlyph, { color: colors.text }]}>⚙︎</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── The figure + ONE's line ─────────────────────────────────── */}
          <View style={styles.hero}>
            <Pressable
              onPress={() => (hasOnboarded ? onTapOrb() : onSignIn?.())}
              onLongPress={() => (hasOnboarded ? onLongPressOrb?.() : onSignIn?.())}
              delayLongPress={420}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={he ? 'הפרופיל של ONE' : 'ONE profile'}
            >
              <Orb size={96} alive trackPointer skinOverride={!hasOnboarded ? 'classic' : undefined} />
            </Pressable>
            <Text style={[styles.hello, { color: colors.text }, rtlText(lang)]}>{greeting}</Text>
            {userEcho && (
              <Text style={[styles.echo, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                {he ? 'את/ה: ' : 'You: '}
                {userEcho}
              </Text>
            )}
            {thinking ? (
              <View style={[styles.thinkRow, rtlRow(lang)]}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={[styles.heroSub, { color: colors.textSecondary }, rtlText(lang)]}>
                  {he ? 'ONE חושב…' : 'ONE is thinking…'}
                </Text>
              </View>
            ) : (
              <Pressable disabled={!oneReply} onPress={clearPeek}>
                <Text style={[styles.heroSub, { color: colors.textSecondary }, rtlText(lang)]}>
                  {heroLine}
                  {oneReply ? (he ? '   ✕' : '   ✕') : ''}
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Needs you ────────────────────────────────────────────────── */}
          {needsYou.length > 0 && (
            <View style={styles.section}>
              <SectionTitle text={he ? 'צריך ממך' : 'Needs you'} colors={colors} lang={lang} accent />
              {needsYou.map((u) => (
                <ProcessCard
                  key={u.id}
                  unit={u}
                  colors={colors}
                  he={he}
                  lang={lang}
                  highlight
                  onPress={() => onTapUnit(u.id)}
                  onLongPress={() => onLongPressUnit?.(u.id)}
                />
              ))}
            </View>
          )}

          {/* ── In progress ─────────────────────────────────────────────── */}
          {inProgress.length > 0 && (
            <View style={styles.section}>
              <SectionTitle text={he ? 'בטיפול' : 'In progress'} colors={colors} lang={lang} />
              {inProgress.map((u) => (
                <ProcessCard
                  key={u.id}
                  unit={u}
                  colors={colors}
                  he={he}
                  lang={lang}
                  onPress={() => onTapUnit(u.id)}
                  onLongPress={() => onLongPressUnit?.(u.id)}
                />
              ))}
            </View>
          )}

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {active.length === 0 && (
            <Pressable
              onPress={() => (hasOnboarded ? onCreateProcess() : onSignIn?.())}
              style={[styles.empty, { borderColor: colors.border }]}
            >
              <Text style={styles.emptyGlyph}>✨</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }, rtlText(lang)]}>
                {he ? 'אין כאן עדיין תהליכים' : 'Nothing here yet'}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? 'ספר ל-ONE מה לקדם — ואני אפתח לך תהליך.' : "Tell ONE what to move forward — I'll open a process."}
              </Text>
            </Pressable>
          )}

          {completedCount > 0 && (
            <Text style={[styles.completedLine, { color: colors.textSecondary }, rtlText(lang)]}>
              {he ? `${completedCount} הושלמו ✓` : `${completedCount} completed ✓`}
            </Text>
          )}
        </ScrollView>

        {/* ── Composer + Upgrade ───────────────────────────────────────── */}
        <View style={[styles.dock, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
            <Pressable
              onPress={() => (hasOnboarded ? onCreateProcess() : onSignIn?.())}
              hitSlop={10}
              style={[styles.plusBtn, { borderColor: colors.border }]}
              accessibilityLabel={he ? 'תהליך חדש' : 'New process'}
            >
              <Text style={[styles.plusGlyph, { color: colors.text }]}>＋</Text>
            </Pressable>
            <TextInput
              style={[styles.input, { color: colors.text }, rtlText(lang)]}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              placeholder={he ? 'תן ל-ONE משימה…' : 'Give ONE a task…'}
              placeholderTextColor={colors.textSecondary}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || thinking}
              style={[
                styles.sendBtn,
                { backgroundColor: draft.trim() && !thinking ? colors.text : colors.border },
              ]}
              accessibilityLabel={he ? 'שלח' : 'Send'}
            >
              <Text style={[styles.sendGlyph, { color: colors.background }]}>↑</Text>
            </Pressable>
          </View>
          {plan === 'free' && (hasOnboarded ? onUpgrade : onSignIn) && (
            <Pressable onPress={() => (hasOnboarded ? onUpgrade?.() : onSignIn?.())} style={styles.upgradeRow}>
              <Text style={[styles.upgradePrompt, { color: colors.textSecondary }]}>
                {he ? 'רוצה יותר מ-ONE? ' : 'Want more from ONE? '}
                <Text style={[styles.upgradeLink, { color: colors.text }]}>{he ? 'שדרוג' : 'Upgrade'}</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionTitle({
  text,
  colors,
  lang,
  accent,
}: {
  text: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
  lang: 'he' | 'en';
  accent?: boolean;
}) {
  return (
    <Text
      style={[
        styles.sectionTitle,
        { color: accent ? colors.text : colors.textSecondary },
        rtlText(lang),
      ]}
    >
      {text}
    </Text>
  );
}

function ProcessCard({
  unit,
  colors,
  he,
  lang,
  onPress,
  onLongPress,
  highlight,
}: {
  unit: Unit;
  colors: ReturnType<typeof useThemeStore>['colors'];
  he: boolean;
  lang: 'he' | 'en';
  onPress: () => void;
  onLongPress?: () => void;
  highlight?: boolean;
}) {
  const vis = visMeta(unit.visibility, he);
  const line = unit.latestBroadcastText?.[0];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={420}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: highlight ? colors.text : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={unit.title}
    >
      <View style={[styles.cardRow, rtlRow(lang)]}>
        <View style={[styles.cardGlyph, { backgroundColor: colors.background }]}>
          <Text style={styles.cardEmoji}>{unit.emoji || '•'}</Text>
        </View>
        <View style={styles.flex1}>
          <View style={[styles.cardTopRow, rtlRow(lang)]}>
            <Text style={[styles.cardTitle, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
              {unit.title}
            </Text>
            <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
              {relTime(unit.lastUpdatedAt, he)}
            </Text>
          </View>
          {!!line && (
            <Text style={[styles.cardLine, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
              {line}
            </Text>
          )}
          <View style={[styles.cardFooter, rtlRow(lang)]}>
            <View style={[styles.visPill, { backgroundColor: colors.background }]}>
              <Text style={[styles.visText, { color: colors.textSecondary }]}>
                {vis.icon} {vis.label}
              </Text>
            </View>
            {unit.unreadUpdates > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.text }]}>
                <Text style={[styles.badgeText, { color: colors.background }]}>{unit.unreadUpdates}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  spaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 200,
  },
  spaceChipText: { fontSize: 13.5, fontWeight: '700' },
  spaceChevron: { fontSize: 14, marginTop: -2 },
  gear: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gearGlyph: { fontSize: 17 },

  scroll: { paddingHorizontal: 16, gap: 18 },

  hero: { alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 4 },
  hello: { fontSize: 22, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  echo: { fontSize: 12.5, maxWidth: 300, textAlign: 'center' },
  heroSub: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  thinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  section: { gap: 9 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginBottom: 1, paddingHorizontal: 2 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardGlyph: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 19 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  cardTime: { fontSize: 11 },
  cardLine: { fontSize: 13, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  visPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  visText: { fontSize: 11, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', gap: 7, paddingVertical: 34, paddingHorizontal: 20, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed' },
  emptyGlyph: { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyHint: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 260 },

  completedLine: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },

  dock: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 7 },
  plusBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  plusGlyph: { fontSize: 18, fontWeight: '600' },
  input: { flex: 1, fontSize: 15, paddingVertical: 4, minWidth: 0 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { fontSize: 18, fontWeight: '800' },

  upgradeRow: { alignItems: 'center', paddingVertical: 2 },
  upgradePrompt: { fontSize: 13 },
  upgradeLink: { fontWeight: '800' },
});
