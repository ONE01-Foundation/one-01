/**
 * ChatProcessCard — the process WIDGET ONE sends inside the conversation, as a
 * COLLAPSIBLE DRAWER. ONE opened (or updated) a process, and here it is, right
 * in the thread: expand it and you START WORKING the process in the same
 * conversation — tick off the next steps, see the reminders — without leaving
 * to a separate screen. Collapse it back to a one-liner when you're done.
 *
 * Looks the unit up live from the store, so it always reflects current state
 * (and quietly disappears if the process was deleted).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMvpStore } from '../../stores/mvpStore';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { TAG_COLORS } from '../../core/mvp/types';
import { rtlRow, rtlText } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { ArrowDownIcon, ClockIcon, HouseIcon, BriefcaseIcon, UsersIcon } from './icons';

// Space (identity) label + icon by type — shows which space ONE filed the
// process into, so with multiple spaces you trust it went to the right one.
const SPACE_META = {
  personal: { he: 'אישי', en: 'Personal', Icon: HouseIcon },
  business: { he: 'עסקי', en: 'Business', Icon: BriefcaseIcon },
  family: { he: 'משפחה', en: 'Family', Icon: UsersIcon },
} as const;

// Channel glyphs for the drafts ONE composed (no icon imports needed).
const CHANNEL_EMOJI: Record<string, string> = {
  whatsapp: '💬',
  email: '✉️',
  sms: '💬',
  call: '📞',
  form: '📝',
  note: '📄',
};
function channelLabel(channel: string, he: boolean) {
  switch (channel) {
    case 'whatsapp': return 'WhatsApp';
    case 'email': return he ? 'אימייל' : 'Email';
    case 'sms': return 'SMS';
    case 'call': return he ? 'שיחה' : 'Call';
    case 'form': return he ? 'טופס' : 'Form';
    default: return he ? 'הערה' : 'Note';
  }
}

export function ChatProcessCard({
  unitId,
  onOpen,
  defaultExpanded = true,
  folded = false,
  convoCount = 0,
  onToggleFold,
}: {
  unitId: string;
  onOpen?: (id: string) => void;
  /** New/just-touched processes open EXPANDED so you start working right away. */
  defaultExpanded?: boolean;
  /** This process's conversation bubbles are folded into the card. */
  folded?: boolean;
  /** How many of this process's chat bubbles would fold (for the label). */
  convoCount?: number;
  /** Toggle folding this process's conversation into the card. */
  onToggleFold?: () => void;
}) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const unit = useMvpStore((s) => s.units.find((u) => u.id === unitId));
  const updateUnit = useMvpStore((s) => s.updateUnit);
  const markDraftSent = useMvpStore((s) => s.markDraftSent);
  const identities = useMvpStore((s) => s.identities);
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!unit) return null;

  // Which space ONE filed this into — shown only when more than one space
  // exists (otherwise it's obvious).
  const space = identities.find((i) => i.id === unit.identityId);
  const spaceMeta = space ? SPACE_META[space.type] : null;
  const showSpace = identities.length > 1 && !!spaceMeta;
  const spaceLabel = space?.name?.trim()
    ? space.name
    : spaceMeta
      ? (he ? spaceMeta.he : spaceMeta.en)
      : '';

  const accent = unit.color ?? TAG_COLORS[unit.tagIds?.[0] ?? 'custom'] ?? colors.textSecondary;
  const line =
    unit.latestBroadcastText?.[0]?.trim() ||
    unit.nextSteps?.find((s) => !s.done)?.title?.trim() ||
    (he ? 'תהליך חדש' : 'New process');
  const done = unit.status === 'completed';
  const steps = unit.nextSteps ?? [];
  const doneCount = steps.filter((s) => s.done).length;
  const reminders = (unit.reminders ?? []).filter((r) => !r.done);
  const drafts = unit.drafts ?? [];
  // Metrics the user has actually filled (non-empty) — shown as chips that
  // appear as the conversation fills them.
  const filledMetrics = (unit.metrics ?? []).filter((m) => m.value != null && String(m.value).trim() !== '');
  // Header badge: a completed process reads "done"; one with steps shows live
  // progress (2/5); otherwise just "process".
  const badge = done
    ? he ? '✓ הושלם' : '✓ Done'
    : steps.length > 0
      ? `${doneCount}/${steps.length}`
      : he ? 'תהליך' : 'Process';

  const toggleStep = (stepId: string) => {
    haptic.select();
    const now = new Date().toISOString();
    updateUnit(unitId, {
      nextSteps: steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
      lastUpdatedAt: now,
      updatedAt: now,
    });
  };

  // Send a draft straight from the conversation — native share sheet (WhatsApp /
  // mail / …), and on share mark it sent. The intent → reality bridge, inline:
  // ONE drafts it, you send it without leaving the chat.
  const sendDraft = async (d: (typeof drafts)[number]) => {
    haptic.tap();
    try {
      const res = await Share.share({
        message: d.subject ? `${d.subject}\n\n${d.body}` : d.body,
      });
      if (res.action === Share.sharedAction) markDraftSent(unitId, d.id, lang);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.body}>
        {/* Header — tap to fold / unfold the drawer. */}
        <Pressable
          onPress={() => { haptic.tap(); setExpanded((e) => !e); }}
          style={[styles.head, rtlRow(lang)]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={unit.title}
        >
          <Text style={styles.emoji}>{unit.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
            {unit.title}
          </Text>
          {showSpace && spaceMeta && (
            // Tap to MOVE the process to the next space — correct ONE's filing
            // right here, at the moment it filed it (toggles between two spaces).
            <Pressable
              onPress={() => {
                const idx = identities.findIndex((i) => i.id === unit.identityId);
                const next = identities[(idx + 1) % identities.length];
                if (!next || next.id === unit.identityId) return;
                haptic.select();
                updateUnit(unitId, { identityId: next.id, updatedAt: new Date().toISOString() });
              }}
              hitSlop={6}
              style={[styles.spaceChip, { borderColor: colors.border, backgroundColor: colors.background }]}
              accessibilityRole="button"
              accessibilityLabel={he ? `מרחב: ${spaceLabel} — הקש להעברה` : `Space: ${spaceLabel} — tap to move`}
            >
              <spaceMeta.Icon size={11} color={colors.textSecondary} />
              <Text style={[styles.spaceChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                {spaceLabel}
              </Text>
            </Pressable>
          )}
          <View style={styles.flex1} />
          <Text style={[styles.tag, { color: done ? accent : colors.textSecondary }]}>
            {badge}
          </Text>
          {/* Chevron: down = collapsed (tap to open), up = expanded. */}
          <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <ArrowDownIcon size={18} color={colors.textSecondary} />
          </View>
        </Pressable>

        {!expanded ? (
          <Text style={[styles.line, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
            {line}
          </Text>
        ) : (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.drawer}>
            <Text style={[styles.line, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={3}>
              {line}
            </Text>

            {/* Filled details (metrics the user gave ONE) — each slides in as it
                gets filled through the conversation, so you SEE it fill. */}
            {filledMetrics.length > 0 && (
              <View style={[styles.metricsRow, rtlRow(lang)]}>
                {filledMetrics.map((m) => (
                  <Animated.View
                    key={m.id}
                    entering={FadeInDown.duration(260)}
                    style={[styles.metricChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
                      {m.value}
                      {m.unit ? ` ${m.unit}` : ''}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Next steps — tick them off right here, in the conversation. */}
            {steps.length > 0 ? (
              <View style={styles.steps}>
                {steps.map((step, i) => (
                  // Each step CASCADES in — on a new process the list fills
                  // itself row by row; a step added later slides in on its own.
                  // You see ONE build the process, not a static card.
                  <Animated.View key={step.id} entering={FadeInDown.delay(Math.min(i, 6) * 85).duration(320)}>
                  <Pressable
                    onPress={() => toggleStep(step.id)}
                    style={[styles.stepRow, rtlRow(lang)]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!step.done }}
                    accessibilityLabel={step.title}
                  >
                    <View
                      style={[
                        styles.check,
                        { borderColor: step.done ? accent : colors.border },
                        step.done && { backgroundColor: accent },
                      ]}
                    >
                      {step.done && <Text style={[styles.checkMark, { color: colors.background }]}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.stepText,
                        { color: step.done ? colors.textSecondary : colors.text },
                        step.done && styles.stepTextDone,
                        rtlText(lang),
                      ]}
                      numberOfLines={2}
                    >
                      {step.title}
                    </Text>
                  </Pressable>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Text style={[styles.hint, { color: colors.textSecondary }, rtlText(lang)]}>
                {he ? 'בוא נתחיל — ספר לי מה הצעד הראשון.' : "Let's start — tell me the first step."}
              </Text>
            )}

            {/* Reminders ONE is holding for this process. */}
            {reminders.map((r) => (
              <View key={r.id} style={[styles.remRow, rtlRow(lang)]}>
                <ClockIcon size={14} color={colors.textSecondary} />
                <Text style={[styles.remText, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                  {r.text}
                  {r.dueLabel ? ` · ${r.dueLabel}` : ''}
                </Text>
              </View>
            ))}

            {/* Drafts ONE composed for this process — the outward messages
                (the intent→reality bridge). Tap the body to open the full
                process to edit; tap Send to fire the native share sheet right
                from the conversation. */}
            {drafts.map((d) => (
              <View
                key={d.id}
                style={[styles.draftRow, { borderColor: colors.border }, rtlRow(lang)]}
              >
                <Pressable
                  onPress={() => { haptic.tap(); onOpen?.(unitId); }}
                  style={[styles.draftMain, rtlRow(lang)]}
                  accessibilityRole="button"
                  accessibilityLabel={d.to || channelLabel(d.channel, he)}
                >
                  <Text style={styles.draftIcon}>{CHANNEL_EMOJI[d.channel] ?? '📄'}</Text>
                  <View style={styles.flex1}>
                    <Text style={[styles.draftTo, { color: colors.text }, rtlText(lang)]} numberOfLines={1}>
                      {d.to || channelLabel(d.channel, he)}
                    </Text>
                    <Text style={[styles.draftBody, { color: colors.textSecondary }, rtlText(lang)]} numberOfLines={1}>
                      {d.body}
                    </Text>
                  </View>
                </Pressable>
                {d.status === 'sent' ? (
                  <Text style={[styles.draftStatus, { color: accent }]}>{he ? '✓ נשלח' : '✓ sent'}</Text>
                ) : (
                  <Pressable
                    onPress={() => sendDraft(d)}
                    hitSlop={8}
                    style={[styles.draftSend, { backgroundColor: colors.text }]}
                    accessibilityRole="button"
                    accessibilityLabel={he ? 'שלח' : 'Send'}
                  >
                    <Text style={[styles.draftSendText, { color: colors.surface }]}>{he ? 'שלח' : 'Send'}</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {/* Into the full process page for everything else. */}
            <Pressable
              onPress={() => { haptic.tap(); onOpen?.(unitId); }}
              style={styles.openFull}
              accessibilityRole="button"
            >
              <Text style={[styles.openFullText, { color: colors.text }, rtlText(lang)]}>
                {he ? 'פתח תהליך מלא ←' : 'Open full process →'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Fold the process's CONVERSATION (the bubbles above this card) into
            the card — "collapse" the back-and-forth, leaving the clean drawer. */}
        {onToggleFold && convoCount > 0 && (
          <Pressable
            onPress={onToggleFold}
            hitSlop={6}
            style={[styles.foldRow, rtlRow(lang)]}
            accessibilityRole="button"
            accessibilityLabel={folded ? (he ? 'הצג שיחה' : 'Show conversation') : (he ? 'קפל שיחה' : 'Fold conversation')}
          >
            <Text style={[styles.foldText, { color: colors.textSecondary }, rtlText(lang)]}>
              {folded
                ? (he ? `הצג שיחה (${convoCount}) ⌄` : `Show chat (${convoCount}) ⌄`)
                : (he ? 'קפל שיחה למגירה ⌃' : 'Fold chat into card ⌃')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Hairline progress along the bottom edge — live sense of how far the
          process has come, visible even while the drawer is folded. */}
      {steps.length > 0 && !done && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]} pointerEvents="none">
          <View
            style={[
              styles.progressFill,
              { backgroundColor: accent, width: `${Math.round((doneCount / steps.length) * 100)}%` },
              he ? styles.progressFillRTL : styles.progressFillLTR,
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    borderBottomStartRadius: 6,
    overflow: 'hidden',
  },
  accent: { width: 4 },
  body: { flex: 1, padding: 15, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  emoji: { fontSize: 22 },
  title: { fontSize: 15.5, fontWeight: '700', flexShrink: 1 },
  flex1: { flex: 1 },
  tag: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  spaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  spaceChipText: { fontSize: 11, fontWeight: '600', maxWidth: 80 },
  line: { fontSize: 13.5, lineHeight: 19 },
  drawer: { gap: 10 },
  steps: { gap: 8, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19 },
  stepTextDone: { textDecorationLine: 'line-through' },
  hint: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', opacity: 0.9 },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  remText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  // The body (icon + to + preview) is its own Pressable so the Send pill beside
  // it stays a separate tap target.
  draftMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  draftIcon: { fontSize: 17 },
  draftTo: { fontSize: 13.5, fontWeight: '700' },
  draftBody: { fontSize: 12.5, lineHeight: 16, marginTop: 1 },
  draftStatus: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  draftSend: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  draftSendText: { fontSize: 12.5, fontWeight: '700' },
  openFull: { paddingTop: 2 },
  openFullText: { fontSize: 13.5, fontWeight: '700' },
  foldRow: { paddingTop: 8, marginTop: 2 },
  foldText: { fontSize: 12, fontWeight: '600', opacity: 0.8 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  metricLabel: { fontSize: 11.5, fontWeight: '600' },
  metricValue: { fontSize: 12.5, fontWeight: '700' },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    opacity: 0.6,
  },
  progressFill: { position: 'absolute', bottom: 0, height: 3 },
  progressFillLTR: { left: 0 },
  progressFillRTL: { right: 0 },
});
