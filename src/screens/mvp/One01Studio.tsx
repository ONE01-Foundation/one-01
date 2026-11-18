/**
 * One01Studio — the ONE01 "company" / venture-factory surface, styled to the
 * ONE01 app design: a wallet header, a Featured "Creator — publish in one flow"
 * card, a Projects list (each venture a product with its own one01.io/<slug>),
 * and a bottom nav (shop · orb · +). Tapping a project opens an App-Store-style
 * detail where you manage it (status, custom domain, remove).
 *
 * ONE01 is the company that MAKES ventures. Each venture is spun up from a
 * reusable TEMPLATE — a website (product page) or an app (a clone of ONE, or a
 * subsystem: market / matching / profiles). ONE itself is the core venture,
 * set aside (never deleted). Virtual tokens only (no crypto yet).
 *
 * Reached from Settings → ONE01 (opt-in homeMode 'one01'); the consumer ONE app
 * is untouched. Demo-grade, local state (one01Store).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { rtlText, rtlRow } from '../../utils/rtl';
import { haptic } from '../../utils/haptics';
import { PlusIcon, PersonIcon, LinkIcon } from '../../components/mvp/icons';
import {
  useOne01Store,
  TEMPLATES,
  templateById,
  type Venture,
  type VentureKind,
  type VentureStatus,
} from '../../stores/one01Store';

/** Product-icon tile background — App-Store-style dark chip in both themes. */
const TILE = '#141418';
const GREEN = '#10B981';

const STATUS_META: Record<VentureStatus, { he: string; en: string; color: string }> = {
  idea: { he: 'רעיון', en: 'Idea', color: '#94A3B8' },
  building: { he: 'בבנייה', en: 'Building', color: '#F59E0B' },
  live: { he: 'חי', en: 'Live', color: GREEN },
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
  const resetDemo = useOne01Store((s) => s.resetDemo);

  // New-venture flow.
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<'name' | 'kind' | 'template'>('name');
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<VentureKind>('app');
  // When the flow was entered from the shop (template-first), skip kind/template.
  const [marketTemplateId, setMarketTemplateId] = useState<string | null>(null);

  // Shop (templates market) + account menu.
  const [marketOpen, setMarketOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Project detail / manage.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const detail = ventures.find((v) => v.id === detailId) ?? null;

  const kindLabel = (k: VentureKind) => (k === 'app' ? (he ? 'אפליקציה' : 'App') : he ? 'אתר' : 'Website');
  const templatesForKind = TEMPLATES.filter((t) => t.kind === draftKind);

  const openCreate = () => {
    haptic.tap();
    setMarketTemplateId(null);
    setDraftName('');
    setDraftKind('app');
    setStep('name');
    setCreating(true);
  };

  const commitCreate = (templateId: string) => {
    const tpl = templateById(templateId);
    if (!tpl) return;
    if (companyTokens < tpl.priceTokens) { haptic.warning(); return; }
    haptic.success();
    createVenture({ name: draftName, kind: draftKind, templateId });
    setCreating(false);
    setMarketTemplateId(null);
  };

  const onNameContinue = () => {
    if (!draftName.trim()) return;
    haptic.tap();
    if (marketTemplateId) commitCreate(marketTemplateId);
    else setStep('kind');
  };

  const buyFromMarket = (t: typeof TEMPLATES[number]) => {
    haptic.select();
    setMarketOpen(false);
    setMarketTemplateId(t.id);
    setDraftKind(t.kind);
    setDraftName('');
    setStep('name');
    setCreating(true);
  };

  const openDetail = (v: Venture) => {
    haptic.select();
    setDetailId(v.id);
    setDomainInput(v.domain ?? '');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]}>
      {/* ── Top bar: wallet + avatar ─────────────────────────────────────── */}
      <View style={[styles.topBar, rtlRow(lang)]}>
        <View style={[styles.wallet, rtlRow(lang)]}>
          <Text style={styles.walletGlyph}>⟡</Text>
          <Text style={[styles.walletValue, { color: colors.text }]}>{companyTokens.toLocaleString()}</Text>
        </View>
        <View style={styles.flex1} />
        <Pressable onPress={() => { haptic.tap(); setMenuOpen(true); }} hitSlop={8} style={[styles.avatar, { backgroundColor: colors.text }]}>
          <PersonIcon size={18} color={colors.background} />
          <View style={[styles.avatarBadge, { borderColor: colors.background }]}>
            <Text style={styles.avatarBadgeText}>{ventures.length}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* ── Featured: Creator ──────────────────────────────────────────── */}
        <Pressable onPress={openCreate} style={[styles.featured, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.featuredArt}>
            <Text style={styles.featuredRocket}>🚀</Text>
          </View>
          <Text style={[styles.featuredLabel, { color: GREEN }, rtl]}>{he ? 'מומלץ' : 'Featured'}</Text>
          <Text style={[styles.featuredTitle, { color: colors.text }, rtl]}>
            {he ? 'קריאייטור — פרסם בזרימה אחת' : 'Creator — publish in one flow'}
          </Text>
          <Text style={[styles.featuredSub, { color: colors.textSecondary }, rtl]}>
            {he ? 'הקם מיזם חדש מתוך שבלונה — אתר או אפליקציה.' : 'Spin up a new venture from a template — a site or an app.'}
          </Text>
        </Pressable>

        {/* ── Projects ───────────────────────────────────────────────────── */}
        <View style={[styles.sectionRow, rtlRow(lang)]}>
          <Text style={styles.sectionEmoji}>🚀</Text>
          <Text style={[styles.sectionTitle, { color: colors.text }, rtl]}>{he ? 'המיזמים שלך' : 'Projects'}</Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>({ventures.length})</Text>
        </View>

        {ventures.map((v) => {
          const sm = STATUS_META[v.status];
          return (
            <Pressable
              key={v.id}
              onPress={() => openDetail(v)}
              style={({ pressed }) => [styles.projRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }, rtlRow(lang)]}
            >
              <View style={[styles.tile, { backgroundColor: TILE }]}>
                <Text style={[styles.tileEmoji, { color: v.accent }]}>{v.emoji}</Text>
              </View>
              <View style={styles.flex1}>
                <View style={[styles.projNameRow, rtlRow(lang)]}>
                  <Text style={[styles.projName, { color: colors.text }, rtl]} numberOfLines={1}>{v.name}</Text>
                  {v.isCore && (
                    <View style={[styles.coreTag, { borderColor: colors.border }]}>
                      <Text style={[styles.coreTagText, { color: colors.textSecondary }]}>{he ? 'ליבה' : 'core'}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.projTagline, { color: colors.textSecondary }, rtl]} numberOfLines={1}>
                  {v.tagline || `one01.io/${v.slug}`}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sm.color + '22' }]}>
                <View style={[styles.statusDot, { backgroundColor: sm.color }]} />
                <Text style={[styles.statusText, { color: sm.color }]}>{he ? sm.he : sm.en}</Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={[styles.footNote, { color: colors.textSecondary }, rtl]}>
          {he ? 'טוקנים וירטואליים · חיבור קריפטו/סליקה אמיתית בעתיד.' : 'Virtual tokens · real settlement can connect later.'}
        </Text>
      </ScrollView>

      {/* ── Bottom nav: shop · orb · + ───────────────────────────────────── */}
      <View style={[styles.bottomNav, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={() => { haptic.tap(); setMarketOpen(true); }} hitSlop={10} style={styles.navBtn}>
          <Text style={styles.navShop}>🛍️</Text>
        </Pressable>
        <Pressable onPress={() => { haptic.tap(); onExit(); }} hitSlop={10} style={[styles.navOrb, { backgroundColor: colors.text }]}>
          <View style={[styles.navOrbInner, { backgroundColor: colors.background }]} />
        </Pressable>
        <Pressable onPress={openCreate} hitSlop={10} style={[styles.navBtn, styles.navPlus, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PlusIcon size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* ── Account menu ─────────────────────────────────────────────────── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>ONE01</Text>
            <Pressable onPress={() => { setMenuOpen(false); onExit(); }} style={[styles.menuRow, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
              <Text style={[styles.menuText, { color: colors.text }, rtl]}>{he ? 'חזרה לאפליקציית ONE' : 'Back to the ONE app'}</Text>
            </Pressable>
            <Pressable onPress={() => { haptic.warning(); resetDemo(); setMenuOpen(false); }} style={[styles.menuRow, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
              <Text style={[styles.menuText, { color: colors.textSecondary }, rtl]}>{he ? 'אפס את הדמו' : 'Reset demo'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Shop: templates market ───────────────────────────────────────── */}
      <Modal visible={marketOpen} transparent animationType="slide" onRequestClose={() => setMarketOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMarketOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>{he ? 'שבלונות — שוק' : 'Templates — market'}</Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }, rtl]}>{he ? 'בחר תשתית למיזם הבא.' : 'Pick a foundation for your next venture.'}</Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {TEMPLATES.map((t) => {
                const afford = companyTokens >= t.priceTokens;
                return (
                  <Pressable key={t.id} onPress={() => afford && buyFromMarket(t)} disabled={!afford} style={[styles.tplRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: afford ? 1 : 0.45 }, rtlRow(lang)]}>
                    <Text style={styles.tplEmoji}>{t.emoji}</Text>
                    <View style={styles.flex1}>
                      <Text style={[styles.tplName, { color: colors.text }, rtl]}>{he ? t.name[0] : t.name[1]}</Text>
                      <Text style={[styles.tplBlurb, { color: colors.textSecondary }, rtl]} numberOfLines={2}>{he ? t.blurb[0] : t.blurb[1]}</Text>
                    </View>
                    <View style={styles.tplRight}>
                      <Text style={[styles.tplKind, { color: colors.textSecondary }]}>{kindLabel(t.kind)}</Text>
                      <Text style={[styles.tplPrice, { color: colors.text }]}>⟡ {t.priceTokens}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── New-venture flow ─────────────────────────────────────────────── */}
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
                  onSubmitEditing={onNameContinue}
                />
                <Pressable disabled={!draftName.trim()} onPress={onNameContinue} style={[styles.primaryBtn, { backgroundColor: colors.text, opacity: draftName.trim() ? 1 : 0.4 }]}>
                  <Text style={[styles.primaryBtnText, { color: colors.background }]}>{marketTemplateId ? (he ? 'צור' : 'Create') : he ? 'המשך' : 'Continue'}</Text>
                </Pressable>
              </>
            )}
            {step === 'kind' && (
              <>
                <Text style={[styles.sheetTitle, { color: colors.text }, rtl]}>{he ? 'מה לבנות?' : 'What to build?'}</Text>
                <View style={[styles.kindRow, rtlRow(lang)]}>
                  {(['app', 'website'] as VentureKind[]).map((k) => (
                    <Pressable key={k} onPress={() => { haptic.select(); setDraftKind(k); setStep('template'); }} style={[styles.kindCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                      <Pressable key={t.id} onPress={() => commitCreate(t.id)} disabled={!afford} style={[styles.tplRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: afford ? 1 : 0.45 }, rtlRow(lang)]}>
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

      {/* ── Project detail (App-Store-style) + manage ────────────────────── */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetailId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetailId(null)}>
          <Pressable style={[styles.detailSheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.detailHead, rtlRow(lang)]}>
                  <View style={[styles.tileLg, { backgroundColor: TILE }]}>
                    <Text style={[styles.tileLgEmoji, { color: detail.accent }]}>{detail.emoji}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={[styles.detailName, { color: colors.text }, rtl]}>{detail.name}</Text>
                    <Text style={[styles.detailTagline, { color: colors.textSecondary }, rtl]} numberOfLines={1}>{detail.tagline || `one01.io/${detail.slug}`}</Text>
                  </View>
                </View>

                {/* App-Store-style stat row */}
                <View style={[styles.statRow, { borderColor: colors.border }, rtlRow(lang)]}>
                  <Stat label={he ? 'סטטוס' : 'Status'} value={he ? STATUS_META[detail.status].he : STATUS_META[detail.status].en} colors={colors} valueColor={STATUS_META[detail.status].color} />
                  <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                  <Stat label={he ? 'סוג' : 'Kind'} value={kindLabel(detail.kind)} colors={colors} />
                  <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                  <Stat label={he ? 'משתמשים' : 'Users'} value={String(detail.users)} colors={colors} />
                  <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                  <Stat label={he ? 'טוקנים' : 'Tokens'} value={`⟡${detail.tokens}`} colors={colors} />
                </View>

                {/* Address */}
                <Text style={[styles.blockTitle, { color: colors.text }, rtl]}>{he ? 'כתובת' : 'Address'}</Text>
                <View style={[styles.addrBox, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
                  <LinkIcon size={14} color={colors.textSecondary} />
                  <Text style={[styles.addrText, { color: colors.text }]} numberOfLines={1}>{detail.domain || `one01.io/${detail.slug}`}</Text>
                </View>
                <View style={[styles.addrInputRow, rtlRow(lang)]}>
                  <TextInput
                    value={domainInput}
                    onChangeText={setDomainInput}
                    placeholder={he ? 'דומיין עצמאי (לא חובה)' : 'Custom domain (optional)'}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1, marginBottom: 0, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign: he ? 'right' : 'left' }]}
                  />
                  <Pressable onPress={() => { haptic.tap(); connectDomain(detail.id, domainInput); }} style={[styles.connectBtn, { backgroundColor: colors.text }]}>
                    <Text style={[styles.primaryBtnText, { color: colors.background }]}>{he ? 'חבר' : 'Connect'}</Text>
                  </Pressable>
                </View>

                {/* Manage */}
                <Text style={[styles.blockTitle, { color: colors.text }, rtl]}>{he ? 'ניהול' : 'Manage'}</Text>
                <Pressable onPress={() => { haptic.select(); cycleStatus(detail.id); }} style={[styles.manageRow, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
                  <Text style={[styles.menuText, { color: colors.text }, rtl]}>{he ? 'קדם סטטוס' : 'Advance status'}</Text>
                  <View style={styles.flex1} />
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_META[detail.status].color + '22' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_META[detail.status].color }]} />
                    <Text style={[styles.statusText, { color: STATUS_META[detail.status].color }]}>{he ? STATUS_META[detail.status].he : STATUS_META[detail.status].en}</Text>
                  </View>
                </Pressable>

                {!detail.isCore ? (
                  <Pressable onPress={() => { haptic.tap(); removeVenture(detail.id); setDetailId(null); }} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>{he ? 'מחק מיזם' : 'Delete venture'}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.footNote, { color: colors.textSecondary }, rtl]}>
                    {he ? 'ONE היא מיזם הליבה — מופרד, לא נמחק.' : 'ONE is the core venture — set aside, not deleted.'}
                  </Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ label, value, colors, valueColor }: { label: string; value: string; colors: any; valueColor?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor || colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },

  topBar: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  wallet: { alignItems: 'center', gap: 6 },
  walletGlyph: { fontSize: 16, color: GREEN },
  walletValue: { fontSize: 18, fontWeight: '800' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, borderWidth: 1.5, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  avatarBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  featured: { borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 4, marginBottom: 18, overflow: 'hidden' },
  featuredArt: { position: 'absolute', top: 10, right: 14 },
  featuredRocket: { fontSize: 30 },
  featuredLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 },
  featuredTitle: { fontSize: 17, fontWeight: '800' },
  featuredSub: { fontSize: 12.5, marginTop: 4, lineHeight: 17 },

  sectionRow: { alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionCount: { fontSize: 14, fontWeight: '600' },

  projRow: { alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 10, marginBottom: 10 },
  tile: { width: 52, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 26 },
  projNameRow: { alignItems: 'center', gap: 6 },
  projName: { fontSize: 15.5, fontWeight: '700' },
  projTagline: { fontSize: 12.5, marginTop: 2 },
  coreTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  coreTagText: { fontSize: 9.5, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  footNote: { fontSize: 11.5, lineHeight: 16, marginTop: 14, textAlign: 'center' },

  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, paddingTop: 12, borderTopWidth: 1 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navShop: { fontSize: 22 },
  navPlus: { borderRadius: 14, borderWidth: 1 },
  navOrb: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  navOrbInner: { width: 14, height: 14, borderRadius: 7 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10 },
  detailSheet: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sheetSub: { fontSize: 12.5, marginBottom: 12 },

  menuRow: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  menuText: { fontSize: 14.5, fontWeight: '600' },

  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 10, fontSize: 15, marginBottom: 14 },
  primaryBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },

  kindRow: { gap: 12, marginBottom: 6 },
  kindCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  kindEmoji: { fontSize: 30 },
  kindTitle: { fontSize: 15, fontWeight: '700' },
  kindBlurb: { fontSize: 11.5, textAlign: 'center', lineHeight: 15 },

  tplRow: { alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  tplEmoji: { fontSize: 24 },
  tplName: { fontSize: 14.5, fontWeight: '700' },
  tplBlurb: { fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  tplRight: { alignItems: 'flex-end', gap: 2 },
  tplKind: { fontSize: 10.5, fontWeight: '600' },
  tplPrice: { fontSize: 13, fontWeight: '800' },

  detailHead: { alignItems: 'center', gap: 14, marginBottom: 16 },
  tileLg: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileLgEmoji: { fontSize: 38 },
  detailName: { fontSize: 20, fontWeight: '800' },
  detailTagline: { fontSize: 13, marginTop: 2 },

  statRow: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, marginBottom: 18, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  statValue: { fontSize: 13.5, fontWeight: '800' },
  statDiv: { width: 1, height: 26 },

  blockTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 4 },
  addrBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  addrText: { fontSize: 13.5, fontWeight: '600', flex: 1 },
  addrInputRow: { gap: 8, marginBottom: 18, alignItems: 'center' },
  connectBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: Platform.OS === 'web' ? 12 : 11, justifyContent: 'center' },

  manageRow: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  deleteBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});
