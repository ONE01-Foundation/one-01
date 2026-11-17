/**
 * One01Studio — the ONE01 "company" / venture-factory demo surface.
 *
 * ONE01 is the company that makes ventures. This screen is the factory floor:
 * see your ventures (each a product with its own one01.io/<slug> + optional
 * custom domain), spin up a new one from a reusable TEMPLATE (a website or an
 * app — a clone of ONE, or a subsystem like market / matching / profiles), and
 * manage each. ONE itself shows here as the core venture, set aside.
 *
 * Virtual tokens only (no crypto yet). Reached from Settings → ONE01; the
 * consumer ONE app is untouched. Demo-grade, local state (one01Store).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { CloseIcon, PlusIcon, LinkIcon, UsersIcon } from '../../components/mvp/icons';
import {
  useOne01Store,
  TEMPLATES,
  templateById,
  type Venture,
  type VentureKind,
  type VentureStatus,
} from '../../stores/one01Store';

const STATUS_META: Record<VentureStatus, { he: string; en: string; color: string }> = {
  idea: { he: 'רעיון', en: 'Idea', color: '#94A3B8' },
  building: { he: 'בבנייה', en: 'Building', color: '#F59E0B' },
  live: { he: 'חי', en: 'Live', color: '#10B981' },
};

export function One01Studio({ onExit }: { onExit: () => void }) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';
  const insets = useSafeAreaInsets();
  const rtl = rtlText(lang);

  const companyTokens = useOne01Store((s) => s.companyTokens);
  const ventures = useOne01Store((s) => s.ventures);
  const createVenture = useOne01Store((s) => s.createVenture);
  const cycleStatus = useOne01Store((s) => s.cycleStatus);
  const connectDomain = useOne01Store((s) => s.connectDomain);
  const removeVenture = useOne01Store((s) => s.removeVenture);

  // New-venture flow.
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<'name' | 'kind' | 'template'>('name');
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<VentureKind>('app');

  // Manage flow.
  const [manageId, setManageId] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const manageVenture = ventures.find((v) => v.id === manageId) ?? null;

  const openCreate = () => {
    haptic.tap();
    setDraftName('');
    setDraftKind('app');
    setStep('name');
    setCreating(true);
  };

  const pickTemplate = (templateId: string) => {
    const tpl = templateById(templateId);
    if (!tpl) return;
    if (companyTokens < tpl.priceTokens) {
      haptic.warning();
      return;
    }
    haptic.success();
    createVenture({ name: draftName, kind: draftKind, templateId });
    setCreating(false);
  };

  const openManage = (v: Venture) => {
    haptic.select();
    setManageId(v.id);
    setDomainInput(v.domain ?? '');
  };

  const kindLabel = (k: VentureKind) => (k === 'app' ? (he ? 'אפליקציה' : 'App') : he ? 'אתר' : 'Website');
  const templatesForKind = TEMPLATES.filter((t) => t.kind === draftKind);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, rtlRow(lang)]}>
        <Pressable onPress={() => { haptic.tap(); onExit(); }} hitSlop={10} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CloseIcon size={16} color={colors.text} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={[styles.title, { color: colors.text }, rtl]}>ONE01</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
            {he ? 'בית חרושת למיזמים' : 'Venture factory'}
          </Text>
        </View>
        <View style={[styles.tokensPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.tokensValue, { color: colors.text }]}>⟡ {companyTokens.toLocaleString()}</Text>
          <Text style={[styles.tokensNote, { color: colors.textSecondary }]}>{he ? 'וירטואלי' : 'virtual'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }, rtl]}>
          {he ? `המיזמים שלך · ${ventures.length}` : `Your ventures · ${ventures.length}`}
        </Text>

        {ventures.map((v) => {
          const sm = STATUS_META[v.status];
          const tpl = templateById(v.templateId);
          return (
            <Pressable
              key={v.id}
              onPress={() => openManage(v)}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.cardTop, rtlRow(lang)]}>
                <View style={[styles.ventureEmojiWrap, { backgroundColor: v.accent + '22' }]}>
                  <Text style={styles.ventureEmoji}>{v.emoji}</Text>
                </View>
                <View style={styles.flex1}>
                  <View style={[styles.nameRow, rtlRow(lang)]}>
                    <Text style={[styles.ventureName, { color: colors.text }, rtl]} numberOfLines={1}>{v.name}</Text>
                    {v.isCore && (
                      <View style={[styles.coreTag, { borderColor: colors.border }]}>
                        <Text style={[styles.coreTagText, { color: colors.textSecondary }]}>{he ? 'ליבה' : 'core'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.ventureSlug, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                    {v.domain ? v.domain : `one01.io/${v.slug}`}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: sm.color + '22' }]}>
                  <View style={[styles.statusDot, { backgroundColor: sm.color }]} />
                  <Text style={[styles.statusText, { color: sm.color }]}>{he ? sm.he : sm.en}</Text>
                </View>
              </View>
              <View style={[styles.cardMeta, rtlRow(lang)]}>
                <Text style={[styles.metaChip, { color: colors.textSecondary, borderColor: colors.border }]}>{kindLabel(v.kind)}</Text>
                {tpl && <Text style={[styles.metaChip, { color: colors.textSecondary, borderColor: colors.border }]}>{tpl.emoji} {he ? tpl.name[0] : tpl.name[1]}</Text>}
                <View style={styles.flex1} />
                <View style={[styles.miniStat, rtlRow(lang)]}>
                  <UsersIcon size={12} color={colors.textSecondary} />
                  <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>{v.users}</Text>
                </View>
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>⟡ {v.tokens}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* New venture */}
        <Pressable onPress={openCreate} style={[styles.newBtn, { borderColor: colors.border }]}>
          <PlusIcon size={18} color={colors.text} />
          <Text style={[styles.newBtnText, { color: colors.text }]}>{he ? 'מיזם חדש' : 'New venture'}</Text>
        </Pressable>

        <Text style={[styles.footNote, { color: colors.textSecondary }, rtl]}>
          {he
            ? 'טוקנים וירטואליים · חיבור קריפטו/סליקה אמיתית בעתיד, אחרי רגולציה.'
            : 'Virtual tokens · real crypto/settlement can connect later, after regulation.'}
        </Text>
      </ScrollView>

      {/* ── New-venture modal ─────────────────────────────────────────────── */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {step === 'name' && (
              <>
                <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>{he ? 'איך קוראים למיזם?' : 'Name your venture'}</Text>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder={he ? 'שם המיזם' : 'Venture name'}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign: he ? 'right' : 'left' }]}
                  autoFocus
                  onSubmitEditing={() => draftName.trim() && setStep('kind')}
                />
                <Pressable
                  disabled={!draftName.trim()}
                  onPress={() => { haptic.tap(); setStep('kind'); }}
                  style={[styles.primaryBtn, { backgroundColor: colors.text, opacity: draftName.trim() ? 1 : 0.4 }]}
                >
                  <Text style={[styles.primaryBtnText, { color: colors.background }]}>{he ? 'המשך' : 'Continue'}</Text>
                </Pressable>
              </>
            )}
            {step === 'kind' && (
              <>
                <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>{he ? 'מה לבנות?' : 'What to build?'}</Text>
                <View style={[styles.kindRow, rtlRow(lang)]}>
                  {(['app', 'website'] as VentureKind[]).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => { haptic.select(); setDraftKind(k); setStep('template'); }}
                      style={[styles.kindCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Text style={styles.kindEmoji}>{k === 'app' ? '📱' : '🌐'}</Text>
                      <Text style={[styles.kindTitle, { color: colors.text }]}>{kindLabel(k)}</Text>
                      <Text style={[styles.kindBlurb, { color: colors.textSecondary }, rtl]}>
                        {k === 'app' ? (he ? 'שכפול של ONE או מערכת' : 'A ONE clone or a subsystem') : (he ? 'דף מוצר ב-one01.io' : 'A product page on one01.io')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {step === 'template' && (
              <>
                <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>{he ? 'בחר שבלונה' : 'Pick a template'}</Text>
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {templatesForKind.map((t) => {
                    const afford = companyTokens >= t.priceTokens;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => pickTemplate(t.id)}
                        disabled={!afford}
                        style={[styles.tplRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: afford ? 1 : 0.45 }, rtlRow(lang)]}
                      >
                        <Text style={styles.tplEmoji}>{t.emoji}</Text>
                        <View style={styles.flex1}>
                          <Text style={[styles.tplName, { color: colors.text }, rtl]}>{he ? t.name[0] : t.name[1]}</Text>
                          <Text style={[styles.tplBlurb, { color: colors.textSecondary }, rtl]} numberOfLines={2}>{he ? t.blurb[0] : t.blurb[1]}</Text>
                        </View>
                        <Text style={[styles.tplPrice, { color: colors.text }]}>⟡ {t.priceTokens}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Manage modal ──────────────────────────────────────────────────── */}
      <Modal visible={!!manageVenture} transparent animationType="fade" onRequestClose={() => setManageId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setManageId(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {manageVenture && (
              <>
                <View style={[styles.manageHead, rtlRow(lang)]}>
                  <View style={[styles.ventureEmojiWrap, { backgroundColor: manageVenture.accent + '22' }]}>
                    <Text style={styles.ventureEmoji}>{manageVenture.emoji}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: 0 }, rtl]}>{manageVenture.name}</Text>
                    <Text style={[styles.ventureSlug, { color: colors.textSecondary }, rtl]}>{manageVenture.domain || `one01.io/${manageVenture.slug}`}</Text>
                  </View>
                </View>

                {/* Status */}
                <Pressable onPress={() => { haptic.select(); cycleStatus(manageVenture.id); }} style={[styles.manageRow, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
                  <Text style={[styles.manageLabel, { color: colors.text }, rtl]}>{he ? 'סטטוס' : 'Status'}</Text>
                  <View style={styles.flex1} />
                  <View style={[styles.statusPill, { backgroundColor: STATUS_META[manageVenture.status].color + '22' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_META[manageVenture.status].color }]} />
                    <Text style={[styles.statusText, { color: STATUS_META[manageVenture.status].color }]}>{he ? STATUS_META[manageVenture.status].he : STATUS_META[manageVenture.status].en}</Text>
                  </View>
                  <Text style={[styles.tapHint, { color: colors.textSecondary }]}>{he ? 'הקש לשינוי' : 'tap'}</Text>
                </Pressable>

                {/* Custom domain */}
                <View style={[styles.manageRow, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <View style={[rtlRow(lang), { alignItems: 'center', gap: 6 }]}>
                    <LinkIcon size={14} color={colors.textSecondary} />
                    <Text style={[styles.manageLabel, { color: colors.text }, rtl]}>{he ? 'דומיין עצמאי' : 'Custom domain'}</Text>
                  </View>
                  <View style={[rtlRow(lang), { gap: 8 }]}>
                    <TextInput
                      value={domainInput}
                      onChangeText={setDomainInput}
                      placeholder={he ? 'example.com (לא חובה)' : 'example.com (optional)'}
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                      style={[styles.input, { flex: 1, marginBottom: 0, color: colors.text, backgroundColor: colors.background, borderColor: colors.border, textAlign: he ? 'right' : 'left' }]}
                    />
                    <Pressable
                      onPress={() => { haptic.tap(); connectDomain(manageVenture.id, domainInput); }}
                      style={[styles.connectBtn, { backgroundColor: colors.text }]}
                    >
                      <Text style={[styles.primaryBtnText, { color: colors.background }]}>{he ? 'חבר' : 'Connect'}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Delete (not for core) */}
                {!manageVenture.isCore ? (
                  <Pressable onPress={() => { haptic.tap(); removeVenture(manageVenture.id); setManageId(null); }} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>{he ? 'מחק מיזם' : 'Delete venture'}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.footNote, { color: colors.textSecondary }, rtl]}>
                    {he ? 'ONE היא מיזם הליבה — מופרד, לא נמחק.' : 'ONE is the core venture — set aside, not deleted.'}
                  </Text>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { fontSize: 12.5, marginTop: 1 },
  tokensPill: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  tokensValue: { fontSize: 14, fontWeight: '800' },
  tokensNote: { fontSize: 9.5, marginTop: -1 },

  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 10 },

  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardTop: { alignItems: 'center', gap: 12 },
  ventureEmojiWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ventureEmoji: { fontSize: 22 },
  nameRow: { alignItems: 'center', gap: 6 },
  ventureName: { fontSize: 16, fontWeight: '700' },
  coreTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  coreTagText: { fontSize: 9.5, fontWeight: '700' },
  ventureSlug: { fontSize: 12.5, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  cardMeta: { alignItems: 'center', gap: 8, marginTop: 12 },
  metaChip: { fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  miniStat: { alignItems: 'center', gap: 3 },
  miniStatText: { fontSize: 12, fontWeight: '600' },

  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', paddingVertical: 14, marginTop: 4 },
  newBtnText: { fontSize: 14, fontWeight: '700' },

  footNote: { fontSize: 11.5, lineHeight: 16, marginTop: 16, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 10, fontSize: 15, marginBottom: 14 },
  primaryBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },

  kindRow: { gap: 12 },
  kindCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  kindEmoji: { fontSize: 30 },
  kindTitle: { fontSize: 15, fontWeight: '700' },
  kindBlurb: { fontSize: 11.5, textAlign: 'center', lineHeight: 15 },

  tplRow: { alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  tplEmoji: { fontSize: 24 },
  tplName: { fontSize: 14.5, fontWeight: '700' },
  tplBlurb: { fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  tplPrice: { fontSize: 13, fontWeight: '800' },

  manageHead: { alignItems: 'center', gap: 12, marginBottom: 14 },
  manageRow: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  manageLabel: { fontSize: 14, fontWeight: '600' },
  tapHint: { fontSize: 10.5, marginLeft: 6 },
  connectBtn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },

  deleteBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});
