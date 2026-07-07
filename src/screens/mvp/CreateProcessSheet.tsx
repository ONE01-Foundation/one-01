/**
 * CreateProcessSheet — manual "+" creation flow for a new Process.
 *
 * Spec rule: ONE creates Processes from conversation. This is the secondary
 * path for users who want to type a title directly (and avoids Apple's
 * "missing functionality" §2.3 risk that comes from a no-op + button).
 *
 * Layout:
 *   Grabber
 *   Title:    "New process"                  ✕
 *   Emoji picker row (8 quick options)
 *   Text input: "What are you working on?"
 *   Tag chip picker (Health / Learning / …)
 *   [Create]                                  (primary)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { useMvpStore } from '../../stores/mvpStore';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import { TAG_COLORS, TAG_LABELS, type TagId, type Unit } from '../../core/mvp/types';

const SCREEN_H = Dimensions.get('window').height;

const QUICK_EMOJIS = ['🎯', '💪', '🚗', '🏠', '💼', '⚖️', '💰', '✈️', '📚', '🩺'];

const QUICK_TAGS: TagId[] = ['health', 'learning', 'business', 'money', 'home', 'family', 'travel', 'legal'];

interface CreateProcessSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the new Unit after successful create. */
  onCreated?: (unit: Unit) => void;
}

export function CreateProcessSheet({ visible, onClose, onCreated }: CreateProcessSheetProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const addUnit = useMvpStore((s) => s.addUnit);
  const activeIdentityId = useMvpStore((s) => s.activeIdentityId);

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState(QUICK_EMOJIS[0]);
  const [selectedTags, setSelectedTags] = useState<TagId[]>([]);

  const reset = () => {
    setTitle('');
    setEmoji(QUICK_EMOJIS[0]);
    setSelectedTags([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const id = `unit_${Date.now()}`;
    const primaryTag = selectedTags[0];
    // Same seed line the AI-created path uses — treated as "no real broadcast
    // yet" by unitStatusLine, so the card derives a live line instead.
    const seedLine = he
      ? 'רגע להתחלה — מה הכי חשוב שנדייק קודם?'
      : 'Fresh start — what matters most to nail down first?';
    const unit: Unit = {
      id,
      identityId: activeIdentityId,
      title: title.trim(),
      emoji,
      tagIds: selectedTags.length ? selectedTags : ['custom'],
      color: primaryTag ? TAG_COLORS[primaryTag] : TAG_COLORS.custom,
      broadcast: [
        {
          id: `b_${id}_1`,
          text: seedLine,
          priority: 60,
          type: 'calm',
          createdAt: now,
        },
      ],
      latestBroadcastText: [seedLine, undefined],
      lastUpdatedAt: now,
      unreadUpdates: 0,
      relationLabel: he ? 'פרטי' : 'Private',
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
    };
    addUnit(unit);
    reset();
    onClose();
    onCreated?.(unit);
  };

  const toggleTag = (t: TagId) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      // Card-feel, not full takeover.
      snapPoints={['75%', '92%']}
      sheetStyle={[styles.sheet]}
    >
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]}>New process</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={[styles.closeX, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        {/* Emoji picker */}
        <Section title="Icon" colors={colors}>
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={({ pressed }) => [
                  styles.emojiBtn,
                  {
                    backgroundColor: e === emoji ? colors.surface : 'transparent',
                    borderColor: e === emoji ? colors.text : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={styles.emojiGlyph}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Title */}
        <Section title="What are you working on?" colors={colors}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Move apartment"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </Section>

        {/* Tag */}
        <Section title="Tag (optional)" colors={colors}>
          <View style={styles.tagRow}>
            {QUICK_TAGS.map((t) => {
              const active = selectedTags.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => toggleTag(t)}
                  style={({ pressed }) => [
                    styles.tagChip,
                    {
                      backgroundColor: active ? TAG_COLORS[t] : 'transparent',
                      borderColor: active ? TAG_COLORS[t] : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      { color: active ? '#fff' : colors.text },
                    ]}
                  >
                    {TAG_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Pressable
          onPress={handleCreate}
          disabled={!title.trim()}
          style={({ pressed }) => [
            styles.createBtn,
            {
              backgroundColor: colors.circle,
              opacity: !title.trim() ? 0.3 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.createBtnText, { color: colors.background }]}>
            Create
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useThemeStore>['colors'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheet: {},

  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '600' },
  closeX: { fontSize: 20 },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiGlyph: { fontSize: 22 },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagChipText: { fontSize: 13, fontWeight: '500' },

  createBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '600' },
});
