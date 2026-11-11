/**
 * MeetOne — the first-run CONVERSATION and the real entry point of the product.
 * Instead of swipe-through explainer cards over an empty home, the user STARTS
 * by meeting ONE: ONE introduces itself, learns the user's name, asks whether
 * they're here for themselves or representing a business, sets that up (a
 * business gets its own space + an open "what we do" fact ONE can tell
 * customers), asks what to take on first (and opens that as a real process on
 * the spot), explains selective disclosure, then hands off to the home.
 *
 * It answers the core question "how does a user — or a business — start?".
 * It writes everything itself (name, optional business space, the first Unit,
 * onboarding flags) and calls onDone when finished; the host (MvpStack) then
 * shows the home with the first process already waiting.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../stores/themeStore';
import { useLocaleStore } from '../../stores/localeStore';
import { useMvpStore } from '../../stores/mvpStore';
import { Orb } from '../../components/mvp/Orb';
import { haptic } from '../../utils/haptics';
import { rtlText, rtlRow } from '../../utils/rtl';
import { buildLocalProcess } from '../../utils/localProcess';
import { ONBOARDING_CARDS_VERSION } from './OnboardingOverlay';

interface MeetOneProps {
  /** Called once the intro is complete (name saved, optional business space and
   *  first process created, onboarding flags set). Receives the first Unit id. */
  onDone: (firstUnitId?: string) => void;
}

type Turn = { from: 'one' | 'user'; text: string };
/** The conversation is a small state machine. `who` and `disclosure` use tap
 *  controls; the rest use the text composer. */
type Phase = 'name' | 'who' | 'bizName' | 'bizWhat' | 'help' | 'disclosure';
type Mode = 'personal' | 'business';

export function MeetOne({ onDone }: MeetOneProps) {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const language = useLocaleStore((s) => s.language);
  const he = language === 'he';
  const lang = he ? 'he' : 'en';

  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>('name');
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const modeRef = useRef<Mode>('personal');
  const bizNameRef = useRef<string>('');
  const firstUnitIdRef = useRef<string | undefined>(undefined);
  const store = useMvpStore;

  const push = useCallback((t: Turn) => setTurns((prev) => [...prev, t]), []);
  const after = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  // ONE speaks one or more lines with a typing beat between them.
  const oneSay = useCallback(
    (lines: string[], done?: () => void) => {
      let delay = 0;
      lines.forEach((line, i) => {
        after(delay, () => setTyping(true));
        delay += 520 + Math.min(line.length * 14, 900);
        after(delay, () => {
          setTyping(false);
          push({ from: 'one', text: line });
          if (i === lines.length - 1) done?.();
        });
        delay += 180;
      });
    },
    [after, push],
  );

  // Opening — ONE introduces itself, then asks the name.
  useEffect(() => {
    oneSay(
      he
        ? ['היי 👋 אני ONE.', 'הנציג הדיגיטלי שלך — אני מדבר בשמך, סוגר תהליכים מול העולם, ומבקש אותך רק כשצריך.', 'איך קוראים לך?']
        : ["Hi 👋 I'm ONE.", 'Your digital representative — I speak for you, close things with the world, and only ask you when I must.', 'What should I call you?'],
    );
    return () => { timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [turns, typing]);

  // ── Step 1: name ────────────────────────────────────────────────────────
  const submitName = useCallback(
    (raw: string) => {
      const n = raw.trim();
      if (!n) return;
      haptic.tap();
      push({ from: 'user', text: n });
      store.getState().setName(n);
      setDraft('');
      setPhase('who');
      oneSay(
        he
          ? [`נעים מאוד, ${n}.`, 'אתה כאן בשביל עצמך, או שאתה מייצג גם עסק או ארגון?']
          : [`Great to meet you, ${n}.`, 'Are you here for yourself, or do you also represent a business or organization?'],
      );
    },
    [he, oneSay, push, store],
  );

  // ── Step 2: who — personal or business ──────────────────────────────────
  const promptHelp = useCallback(() => {
    setPhase('help');
    oneSay(
      modeRef.current === 'business'
        ? he
          ? ['במה שאטפל קודם מול הלקוחות? אפשר לבחור, או לכתוב לי.']
          : ['What should I handle first with your customers? Pick one, or just tell me.']
        : he
          ? ['במה הכי בא לך שאטפל קודם? אפשר לבחור, או פשוט לכתוב לי.']
          : ['What should I take on first? Pick one, or just tell me.'],
    );
  }, [he, oneSay]);

  const chooseWho = useCallback(
    (mode: Mode) => {
      haptic.tap();
      modeRef.current = mode;
      if (mode === 'personal') {
        push({ from: 'user', text: he ? 'בשביל עצמי' : 'For myself' });
        promptHelp();
      } else {
        push({ from: 'user', text: he ? 'מייצג עסק / ארגון' : 'I represent a business' });
        setPhase('bizName');
        oneSay(
          he
            ? ['יופי. איך קוראים לעסק?']
            : ["Great. What's the business called?"],
        );
      }
    },
    [he, oneSay, promptHelp, push],
  );

  // ── Step 2a (business): name → create a business space ──────────────────
  const submitBizName = useCallback(
    (raw: string) => {
      const n = raw.trim();
      if (!n) return;
      haptic.tap();
      push({ from: 'user', text: n });
      bizNameRef.current = n;
      // A business is its OWN space (profile). Creating it makes it active, so
      // the "what we do" fact and the first process land on the business, not
      // the personal space.
      store.getState().addIdentity('business', n);
      setDraft('');
      setPhase('bizWhat');
      oneSay(
        he
          ? ['ומה אתם עושים? משפט קצר — זה מה שאציג ללקוחות כשאפעל בשם העסק.']
          : ['And what do you do? One line — this is what I\'ll tell customers when I act for the business.'],
      );
    },
    [he, oneSay, push, store],
  );

  // ── Step 2b (business): what we do → an OPEN disclosure fact ─────────────
  const submitBizWhat = useCallback(
    (raw: string) => {
      const txt = raw.trim();
      if (!txt) return;
      haptic.tap();
      push({ from: 'user', text: txt });
      // Open, because ONE should tell customers what the business does.
      store.getState().addDisclosureField(he ? 'מה אנחנו עושים' : 'What we do', txt, 'open');
      setDraft('');
      haptic.success();
      oneSay(
        he
          ? [`מעולה. ${bizNameRef.current} מוכן.`]
          : [`Perfect. ${bizNameRef.current} is set up.`],
        promptHelp,
      );
    },
    [he, oneSay, promptHelp, push, store],
  );

  // ── Step 3: first intent → a real process ───────────────────────────────
  const toDisclosure = useCallback(() => {
    setPhase('disclosure');
    const biz = modeRef.current === 'business';
    oneSay(
      he
        ? [
            'דבר אחרון שחשוב שתדע:',
            biz
              ? 'אני אף פעם לא מתחזה אליך. אתה מחליט מה אני חושף ללקוחות — פתוח, לפי בקשה, או פרטי. אפשר לשנות בכל רגע.'
              : 'אני אף פעם לא מתחזה אליך. אתה מחליט מה אני חושף לכל גורם — פתוח, לפי בקשה, או פרטי. אפשר לשנות בכל רגע.',
          ]
        : [
            'One last thing worth knowing:',
            biz
              ? "I never impersonate you. You decide what I reveal to customers — open, on request, or private. Change it anytime."
              : "I never impersonate you. You decide what I reveal to each party — open, on request, or private. Change it anytime.",
          ],
    );
  }, [he, oneSay]);

  const submitHelp = useCallback(
    (raw: string) => {
      const txt = raw.trim();
      if (!txt) return;
      haptic.tap();
      push({ from: 'user', text: txt });
      setDraft('');
      // Turn the first intent into a real, enriched process immediately — in the
      // active space (business space when the user set one up).
      const st = store.getState();
      const created = buildLocalProcess(txt, st.identities, st.activeIdentityId);
      st.addUnit(created);
      st.pushUnitNotification({ unitId: created.id, text: `New process: ${created.title}`, emoji: created.emoji, kind: 'created' });
      haptic.success();
      firstUnitIdRef.current = created.id;
      oneSay(
        he
          ? [`מעולה — פתחתי לך תהליך: ${created.emoji} ${created.title}.`, 'נבנה אותו יחד, צעד-צעד.']
          : [`Done — I opened a process for you: ${created.emoji} ${created.title}.`, "We'll build it together, step by step."],
        toDisclosure,
      );
    },
    [he, oneSay, push, store, toDisclosure],
  );

  const skipHelp = useCallback(() => {
    haptic.tap();
    push({ from: 'user', text: he ? 'רק מסתכל/ת בינתיים' : 'Just looking for now' });
    oneSay(
      he ? ['אין בעיה. מתי שתרצה — פשוט תגיד לי מה צריך.'] : ["No problem. Whenever you're ready, just tell me what you need."],
      toDisclosure,
    );
  }, [he, oneSay, push, toDisclosure]);

  const finish = useCallback(() => {
    haptic.press();
    const st = store.getState();
    st.completeMeetOne();
    st.setOnboardingCardsSeen(ONBOARDING_CARDS_VERSION);
    onDone(firstUnitIdRef.current);
  }, [onDone, store]);

  // Composer dispatch — the active text phase decides what a submit means.
  const submitComposer = useCallback(() => {
    if (phase === 'name') return submitName(draft);
    if (phase === 'bizName') return submitBizName(draft);
    if (phase === 'bizWhat') return submitBizWhat(draft);
    if (phase === 'help') return submitHelp(draft);
  }, [phase, draft, submitName, submitBizName, submitBizWhat, submitHelp]);

  const helpChips =
    modeRef.current === 'business'
      ? he
        ? ['מענה לפניות לקוחות', 'ניהול תורים ללקוחות', 'גבייה ותשלומים', 'פרסום שירות חדש']
        : ['Answer customer inquiries', 'Manage customer bookings', 'Collect payments', 'Promote a new service']
      : he
        ? ['תור לרופא עור', 'ביטוח רכב זול יותר', 'חידוש דרכון', 'שיפוצניק לבית']
        : ['A dermatologist appointment', 'Cheaper car insurance', 'Renew my passport', 'A handyman'];

  const placeholder =
    phase === 'name'
      ? he ? 'השם שלך' : 'Your name'
      : phase === 'bizName'
        ? he ? 'שם העסק' : 'Business name'
        : phase === 'bizWhat'
          ? he ? 'מה אתם עושים' : 'What you do'
          : he ? 'כתוב לי מה צריך…' : 'Tell me what you need…';

  const showComposer =
    phase === 'name' || phase === 'bizName' || phase === 'bizWhat' || phase === 'help';

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Orb size={62} alive trackPointer />
        <Text style={[styles.brand, { color: colors.text }]}>ONE</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {turns.map((t, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                t.from === 'one'
                  ? [styles.one, { backgroundColor: colors.surface }]
                  : [styles.you, { backgroundColor: colors.text }],
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: t.from === 'one' ? colors.text : colors.background },
                  rtlText(lang),
                ]}
              >
                {t.text}
              </Text>
            </View>
          ))}
          {typing && (
            <View style={[styles.bubble, styles.one, styles.typing, { backgroundColor: colors.surface }]}>
              <Text style={[styles.bubbleText, { color: colors.textSecondary }]}>…</Text>
            </View>
          )}

          {phase === 'disclosure' && !typing && (
            <View style={[styles.tiers, rtlRow(lang)]}>
              {[
                { c: '#0f8f6b', t: he ? 'פתוח' : 'Open' },
                { c: '#b2822a', t: he ? 'לפי בקשה' : 'On request' },
                { c: '#868a92', t: he ? 'פרטי' : 'Private' },
              ].map((x) => (
                <View key={x.t} style={[styles.tier, { borderColor: colors.border }]}>
                  <View style={[styles.dot, { backgroundColor: x.c }]} />
                  <Text style={[styles.tierText, { color: colors.textSecondary }]}>{x.t}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input area — changes per phase */}
        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Step 2 — the person/business fork, as two clear choices. */}
          {phase === 'who' && !typing && (
            <View style={[styles.choices, rtlRow(lang)]}>
              <Pressable
                onPress={() => chooseWho('personal')}
                style={[styles.choice, { borderColor: colors.border, backgroundColor: colors.surface }]}
                accessibilityRole="button"
              >
                <Text style={styles.choiceEmoji}>🙋</Text>
                <Text style={[styles.choiceText, { color: colors.text }]}>{he ? 'בשבילי' : 'For myself'}</Text>
              </Pressable>
              <Pressable
                onPress={() => chooseWho('business')}
                style={[styles.choice, { borderColor: colors.border, backgroundColor: colors.surface }]}
                accessibilityRole="button"
              >
                <Text style={styles.choiceEmoji}>🏢</Text>
                <Text style={[styles.choiceText, { color: colors.text }]}>{he ? 'עסק / ארגון' : 'A business'}</Text>
              </Pressable>
            </View>
          )}

          {phase === 'help' && !typing && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              {helpChips.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => submitHelp(c)}
                  style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{c}</Text>
                </Pressable>
              ))}
              <Pressable onPress={skipHelp} style={[styles.chip, { borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>{he ? 'אחר כך' : 'Later'}</Text>
              </Pressable>
            </ScrollView>
          )}

          {phase === 'disclosure' ? (
            <Pressable
              onPress={finish}
              style={[styles.cta, { backgroundColor: colors.text }]}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaText, { color: colors.background }]}>
                {he ? 'יאללה, בוא נתחיל' : "Let's begin"}
              </Text>
            </Pressable>
          ) : showComposer ? (
            <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }, rtlRow(lang)]}>
              <TextInput
                style={[styles.input, { color: colors.text }, rtlText(lang)]}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submitComposer}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="send"
                autoFocus={!typing}
                blurOnSubmit={false}
                editable={!typing}
              />
              <Pressable
                onPress={submitComposer}
                disabled={!draft.trim() || typing}
                style={[styles.send, { backgroundColor: draft.trim() && !typing ? colors.text : colors.border }]}
              >
                <Text style={[styles.sendGlyph, { color: colors.background }]}>↑</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  brand: { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  thread: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, gap: 9 },
  bubble: { maxWidth: '86%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18 },
  one: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  you: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  typing: { paddingVertical: 8 },
  tiers: { flexDirection: 'row', gap: 8, alignSelf: 'flex-start', marginTop: 4 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  tierText: { fontSize: 12, fontWeight: '700' },
  dock: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 6 },
  choiceEmoji: { fontSize: 22 },
  choiceText: { fontSize: 14.5, fontWeight: '700' },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 7 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 5, minWidth: 0 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { fontSize: 18, fontWeight: '800' },
  cta: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800' },
});
