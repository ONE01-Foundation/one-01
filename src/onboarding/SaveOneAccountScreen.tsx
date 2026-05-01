import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../stores/themeStore';
import { useLocaleStore } from '../stores/localeStore';
import { useOne } from '../core/OneContext';
import { useOnboardingDraftStore } from '../stores/onboardingDraftStore';
import { supabaseService } from '../services/supabaseService';
import { inferLensFromGoal } from '../utils/inferLensFromGoal';

/** תוכן כפתורי השמירה — לשימוש במסך מלא או בתוך מודאל */
export function SaveOneAccountPanel() {
  const { colors } = useThemeStore();
  const { language } = useLocaleStore();
  const he = language === 'he';
  const insets = useSafeAreaInsets();
  const { completeProductOnboarding } = useOne();
  const draft = useOnboardingDraftStore();

  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const finishLocal = async () => {
    if (!draft.persona) {
      Alert.alert(he ? 'חסר סגנון' : 'Missing style', he ? 'חזרו לבחירת דמות.' : 'Go back and pick a character style.');
      return;
    }
    const title = draft.firstUnitTitle.trim() || (he ? 'יחידה ראשונה' : 'First unit');
    const summary =
      draft.firstUnitSummary.trim() ||
      (he
        ? `יחידה ראשונה: ${title}. נעקוב אחרי צעדים, חוסמים ועדכונים קצרים.`
        : `First unit: ${title}. We’ll track steps, blockers, and short updates.`);
    const lens = inferLensFromGoal(`${title} ${summary}`);
    setBusy(true);
    try {
      await completeProductOnboarding({
        userName: draft.userName.trim() || (he ? 'אורח' : 'Guest'),
        agentName: draft.agentName.trim() || 'ONE',
        persona: draft.persona,
        firstUnitTitle: title,
        firstUnitSummary: summary,
        lens,
      });
      useOnboardingDraftStore.getState().reset();
    } finally {
      setBusy(false);
    }
  };

  const afterAuthSync = async () => {
    const title = draft.firstUnitTitle.trim() || (he ? 'יחידה ראשונה' : 'First unit');
    const summary =
      draft.firstUnitSummary.trim() ||
      (he
        ? `יחידה ראשונה: ${title}. נעקוב אחרי צעדים, חוסמים ועדכונים קצרים.`
        : `First unit: ${title}. We’ll track steps, blockers, and short updates.`);
    const lens = inferLensFromGoal(`${title} ${summary}`);
    if (!draft.persona) return;
    setBusy(true);
    try {
      await completeProductOnboarding({
        userName: draft.userName.trim() || (he ? 'אורח' : 'Guest'),
        agentName: draft.agentName.trim() || 'ONE',
        persona: draft.persona,
        firstUnitTitle: title,
        firstUnitSummary: summary,
        lens,
      });
      useOnboardingDraftStore.getState().reset();
    } finally {
      setBusy(false);
    }
  };

  const onAnonymous = async () => {
    supabaseService.initialize();
    const client = supabaseService.getClient();
    if (!client) {
      await finishLocal();
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseService.signInAnonymously();
      if (error) {
        await finishLocal();
        return;
      }
      await afterAuthSync();
    } catch {
      await finishLocal();
    }
  };

  const onEmailSubmit = async () => {
    if (!email.includes('@') || password.length < 6) {
      Alert.alert(
        he ? 'פרטים חסרים' : 'Missing details',
        he ? 'הזינו אימייל תקין וסיסמה באורך 6 לפחות.' : 'Use a valid email and a password of at least 6 characters.'
      );
      return;
    }
    supabaseService.initialize();
    const client = supabaseService.getClient();
    if (!client) {
      Alert.alert('Supabase', he ? 'השרת לא מוגדר (EXPO_PUBLIC_SUPABASE_*).' : 'Supabase env vars missing (EXPO_PUBLIC_SUPABASE_*).');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabaseService.signUp(email.trim(), password);
      if (error) {
        Alert.alert(he ? 'הרשמה' : 'Sign up', error.message);
        return;
      }
      setEmailOpen(false);
      await afterAuthSync();
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    supabaseService.initialize();
    const client = supabaseService.getClient();
    if (!client) {
      Alert.alert('Supabase', he ? 'חסרים מפתחות בסביבה.' : 'Missing Supabase keys.');
      return;
    }
    if (Platform.OS === 'web') {
      setBusy(true);
      try {
        const { data, error } = await supabaseService.signInWithOAuth('google');
        if (error) Alert.alert('Google', error.message);
        if (data?.url) {
          await Linking.openURL(data.url);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    Alert.alert(
      he ? 'Google' : 'Google',
      he
        ? 'ב-iOS/Android יש לחבר deep link ל-Supabase OAuth. עד אז: אימייל או המשך אורח.'
        : 'On native, wire Supabase OAuth deep links. For now use Email or Continue without account.'
    );
  };

  const onApple = () => {
    Alert.alert(
      he ? 'Apple' : 'Apple',
      he ? 'התחברות Apple דורשת הגדרה ב-Supabase וב-Apple Developer.' : 'Apple Sign-In requires Supabase + Apple Developer setup.'
    );
  };

  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 520 }}
        contentContainerStyle={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 20,
            backgroundColor: '#0a0a0a',
          },
        ]}
      >
        <Text style={styles.sheetTitle}>{he ? 'שמירת ה-ONE' : 'Save your One'}</Text>
        <Text style={styles.sheetSub}>
          {he
            ? 'שומרים את הסוכן והיחידה בענן. אפשר גם להמשיך מקומית ללא חשבון.'
            : 'Keep your agent and unit in the cloud—or continue locally without an account.'}
        </Text>

        <TouchableOpacity style={styles.rowBtn} onPress={onGoogle} disabled={busy}>
          <Text style={styles.rowIcon}>G</Text>
          <Text style={styles.rowTxt}>{he ? 'המשך עם Google' : 'Continue with Google'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rowBtn} onPress={onApple} disabled={busy}>
          <Text style={[styles.rowIcon, { opacity: 0 }]}>·</Text>
          <Text style={styles.rowTxt}>{he ? 'המשך עם Apple' : 'Continue with Apple'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rowBtn} onPress={() => setEmailOpen(true)} disabled={busy}>
          <Text style={styles.rowIcon}>✉</Text>
          <Text style={styles.rowTxt}>{he ? 'המשך עם אימייל' : 'Continue with Email'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowBtnAlt} onPress={onAnonymous} disabled={busy}>
          <Text style={styles.rowTxtAlt}>{he ? 'התחברות אנונימית + שמירה' : 'Anonymous save (Supabase)'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skip} onPress={finishLocal} disabled={busy}>
          <Text style={styles.skipTxt}>{he ? 'דילוג — רק במכשיר' : 'Skip — device only'}</Text>
        </TouchableOpacity>

        {busy ? <ActivityIndicator color="#fff" style={{ marginTop: 16 }} /> : null}
      </ScrollView>

      <Modal visible={emailOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{he ? 'הרשמה באימייל' : 'Email sign up'}</Text>
            <TextInput
              style={[styles.inp, { color: colors.text, borderColor: colors.border }]}
              placeholder="email@example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={[styles.inp, { color: colors.text, borderColor: colors.border }]}
              placeholder={he ? 'סיסמה (6+)' : 'Password (6+)'}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={[styles.modalCta, { backgroundColor: colors.primary }]} onPress={onEmailSubmit}>
              <Text style={styles.modalCtaTxt}>{he ? 'צור חשבון' : 'Create account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEmailOpen(false)}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>{he ? 'ביטול' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function SaveOneAccountScreen() {
  return (
    <View style={styles.fullRoot}>
      <View style={styles.scrim} />
      <View style={styles.sheetDock}>
        <SaveOneAccountPanel />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullRoot: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetDock: {
    marginTop: 'auto',
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sheetTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sheetSub: { color: 'rgba(255,255,255,0.72)', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  rowBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  rowIcon: { fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center', color: '#111' },
  rowTxt: { fontSize: 16, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  rowBtnAlt: {
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 6,
  },
  rowTxtAlt: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 15 },
  skip: { marginTop: 18, paddingVertical: 10 },
  skipTxt: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  inp: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 16 },
  modalCta: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  modalCtaTxt: { fontWeight: '800', fontSize: 16, color: '#111' },
});
