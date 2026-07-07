/**
 * SignInSheet — bottom-sheet replacement for the SignIn full screen.
 *
 * Layout (per latest mockup):
 *   [── grabber ──]                  [X]
 *   Connect
 *
 *   [G  Continue with Google]
 *   [  Continue with Apple]
 *   [✉  Continue with Email]
 *
 *   Don't have an account?  Start with ONE
 *
 * Anchored on Home: when this sheet opens, the parent screen lifts its
 * Orb + broadcast up (same "keyboard-open" feel) and the broadcast text
 * reads "Welcome back." The sheet itself is a single static detent —
 * no scroll/expand needed, the content fits comfortably.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BottomSheet } from '../../components/mvp/BottomSheet';
import {
  CloseIcon,
  GoogleIcon,
  AppleIcon,
  MailIcon,
} from '../../components/mvp/icons';
import { useThemeStore } from '../../stores/themeStore';
import { useLanguage } from '../../i18n/useT';
import { supabaseService } from '../../services/supabaseService';

interface SignInSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful sign-in via any provider. */
  onSignedIn: () => void;
}

// Single-detent sheet — content is short enough that scroll/expand isn't
// needed. Snap sized to FIT the three buttons + footer link snugly
// without stretching toward the orb above. The Home Orb + "Welcome
// back." broadcast remain visible above the sheet at their default
// resting positions.
const SNAP_POINTS = ['42%'];

export function SignInSheet({ visible, onClose, onSignedIn }: SignInSheetProps) {
  const { colors } = useThemeStore();
  const lang = useLanguage();
  const he = lang === 'he';

  // Three sheet "modes": picker (default), email (showing email input),
  // or working (in-flight auth request).
  const [mode, setMode] = useState<'picker' | 'email'>('picker');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      // Reset when the sheet closes so the next open is fresh.
      setMode('picker');
      setEmail('');
      setBusy(false);
    }
  }, [visible]);

  // ── Auth handlers ───────────────────────────────────────────────────
  const showSoonAlert = (label: string) => {
    Alert.alert(
      label,
      he
        ? 'בקרוב — בינתיים נסה Email או התחל עם ONE.'
        : 'Coming soon — try Email or Start with ONE for now.',
    );
  };

  const handleGoogle = async () => {
    const client = supabaseService.getClient();
    if (!client) {
      Alert.alert(
        he ? 'Supabase לא מאותחל' : 'Supabase not initialized',
        he
          ? 'נדרשים EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY ב-.env'
          : 'Missing env vars',
      );
      return;
    }
    setBusy(true);
    const res = await supabaseService.signInWithProviderNative('google');
    setBusy(false);
    if (res.ok) {
      // The OneContext auth listener hydrates the store on SIGNED_IN.
      onSignedIn();
      return;
    }
    // User backed out of the browser — no error UI.
    if (res.error === 'cancelled') return;
    // Provider not turned on in the Supabase dashboard yet — the one step
    // that can't be done from the app. Point there explicitly.
    const providerDisabled = /provider.*not enabled|unsupported provider|not enabled/i.test(
      res.error ?? '',
    );
    Alert.alert(
      he ? 'התחברות עם Google נכשלה' : 'Google sign-in failed',
      providerDisabled
        ? he
          ? 'צריך להפעיל את Google בדאשבורד של Supabase (Auth → Providers → Google) ולהוסיף את כתובת ה-Redirect.'
          : 'Enable Google in your Supabase dashboard (Auth → Providers → Google) and add the redirect URL.'
        : res.error ?? (he ? 'שגיאה לא ידועה' : 'Unknown error'),
    );
  };

  const handleEmail = async () => {
    if (mode !== 'email') {
      setMode('email');
      return;
    }
    const v = email.trim();
    if (!v || !v.includes('@')) {
      Alert.alert(
        he ? 'אימייל לא תקין' : 'Invalid email',
        he ? 'הכנס כתובת מייל תקינה' : 'Enter a valid email address',
      );
      return;
    }
    const client = supabaseService.getClient();
    if (!client) {
      Alert.alert(
        he ? 'Supabase לא מאותחל' : 'Supabase not initialized',
        he ? 'נדרשים EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY ב-.env' : 'Missing env vars',
      );
      return;
    }
    setBusy(true);
    const { error } = await client.auth.signInWithOtp({ email: v });
    setBusy(false);
    if (error) {
      Alert.alert(he ? 'שגיאה' : 'Error', error.message);
      return;
    }
    Alert.alert(
      he ? 'בדוק את המייל' : 'Check your email',
      he
        ? `שלחנו קישור התחברות ל-${v}. פתח אותו במכשיר הזה.`
        : `We sent a sign-in link to ${v}. Open it on this device.`,
    );
    onClose();
  };

  const handleAnonymous = async () => {
    const client = supabaseService.getClient();
    if (!client) {
      // Truly offline / unconfigured — let them in locally only. This
      // is the explicit "no backend" path, NOT a silent failure.
      onSignedIn();
      return;
    }
    setBusy(true);
    const { error } = await client.auth.signInAnonymously();
    setBusy(false);
    if (error) {
      // Don't fake success here. If we flip hasCompletedOnboarding
      // without a session, every AI call silently falls back to mocks
      // and the user can't tell why ONE sounds canned. Surface it.
      const isDisabled = /anonymous.*disabled/i.test(error.message);
      Alert.alert(
        he ? 'התחברות נכשלה' : 'Sign-in failed',
        isDisabled
          ? he
            ? 'Anonymous Sign-Ins מושבת בדאשבורד של Supabase. הפעל אותו ב-Auth → Providers → Anonymous, או השתמש ב-Email.'
            : 'Anonymous Sign-Ins is disabled in your Supabase dashboard. Enable it under Auth → Providers → Anonymous, or use Email.'
          : error.message,
      );
      return;
    }
    // Auth listener in OneContext will pull profile / hydrate.
    onSignedIn();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      // Content-pan ON so swiping DOWN anywhere in the sheet body
      // dismisses it (not just the X). There's no scroll view inside so
      // the gesture can only mean "close the sheet" — no conflict.
      enableContentPan={true}
      sheetStyle={styles.sheet}
    >
      <View style={styles.body}>
        {/* No header — no title, no X. Close by dragging the sheet down
            (content-pan) or tapping the backdrop. */}

        {mode === 'email' ? (
          // ── Email input mode ─────────────────────────────────────
          <View style={styles.actions}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={he ? 'האימייל שלך' : 'your@email.com'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              style={[
                styles.emailInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  textAlign: he ? 'right' : 'left',
                },
              ]}
            />
            <ProviderButton
              kind="dark"
              icon={
                busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MailIcon size={20} color="#FFFFFF" />
                )
              }
              label={
                busy
                  ? he
                    ? 'שולח…'
                    : 'Sending…'
                  : he
                    ? 'שלח קישור התחברות'
                    : 'Send sign-in link'
              }
              onPress={handleEmail}
              colors={colors}
              disabled={busy}
            />
            <Pressable
              onPress={() => setMode('picker')}
              hitSlop={10}
              style={styles.backRow}
              disabled={busy}
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                {he ? '‹ חזור' : '‹ Back'}
              </Text>
            </Pressable>
          </View>
        ) : (
          // ── Provider picker (default) ────────────────────────────
          <View style={styles.actions}>
            <ProviderButton
              kind="light"
              icon={
                busy ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <GoogleIcon size={22} />
                )
              }
              label={
                busy
                  ? he
                    ? 'מתחבר…'
                    : 'Connecting…'
                  : he
                    ? 'המשך עם Google'
                    : 'Continue with Google'
              }
              onPress={handleGoogle}
              colors={colors}
              disabled={busy}
            />
            <ProviderButton
              kind="light"
              icon={<AppleIcon size={22} color={colors.text} />}
              label={he ? 'המשך עם Apple' : 'Continue with Apple'}
              onPress={() =>
                showSoonAlert(he ? 'Apple' : 'Continue with Apple')
              }
              colors={colors}
              disabled={busy}
            />
            <ProviderButton
              kind="dark"
              icon={<MailIcon size={20} color="#FFFFFF" />}
              label={he ? 'המשך עם אימייל' : 'Continue with Email'}
              onPress={handleEmail}
              colors={colors}
              disabled={busy}
            />
          </View>
        )}

        {/* Footer: try without an account → anonymous sign-in (or local
            fall-back). The Supabase auth listener in OneContext will
            hydrate the store after the session lands. */}
        {mode === 'picker' && (
          <Pressable
            onPress={handleAnonymous}
            hitSlop={10}
            style={styles.footer}
            disabled={busy}
          >
            <Text style={[styles.footerPrompt, { color: colors.textSecondary }]}>
              {he ? 'אין לך עדיין חשבון? ' : "Don't have an account? "}
              <Text style={[styles.footerLink, { color: colors.text }]}>
                {he ? 'התחל עם ONE' : 'Start with ONE'}
              </Text>
            </Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

interface ProviderButtonProps {
  kind: 'light' | 'dark';
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeStore>['colors'];
  disabled?: boolean;
}

function ProviderButton({ kind, icon, label, onPress, colors, disabled }: ProviderButtonProps) {
  const isDark = kind === 'dark';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        isDark
          ? { backgroundColor: '#000' }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        { opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.btnIcon}>{icon}</View>
      <Text
        style={[
          styles.btnLabel,
          { color: isDark ? '#FFFFFF' : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {},
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Softer, almost-flat shadow — matches the mockup's clean look.
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  emailInput: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 32,
    borderWidth: 1,
    fontSize: 16,
  },
  backRow: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 32,
    gap: 12,
  },
  btnIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 'auto',
  },
  footerPrompt: { fontSize: 14 },
  footerLink: { fontWeight: '700' },
});
