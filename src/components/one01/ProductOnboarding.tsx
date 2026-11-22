/**
 * ProductOnboarding — one reusable 3-screen skeleton used by every ONE01
 * product. Driven entirely by an `OnboardConfig` (see data/one01/onboarding.ts):
 *
 *   1. Splash  — product mark centered, a rounded gradient glow rising from the
 *                bottom (glow color per product). Auto-advances (tap to skip).
 *   2. Welcome — a carousel explaining the product: mark + title + subtitle +
 *                progress dots, two floating emoji, a primary CTA, and a
 *                dismiss (✕ or "Skip").
 *   3. Connect — the logo + tagline over a bottom sheet with Continue with
 *                Google / Apple / Email and a legal line.
 *
 * Background is white ('light') or black ('dark') per the product's mode; the
 * only chromatic element is the per-product glow. Auth is mocked — any button
 * (and Skip) calls `onFinish`.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import {
  One01Mark,
  One01Wordmark,
  OneMark,
  WinziMark,
  MixStarMark,
  GoogleIcon,
  AppleIcon,
  MailIcon,
} from './brand';
import type { OnboardConfig, OnboardMode } from '../../data/one01/onboarding';
import type { MarkId } from '../../data/one01/platform';

/* ─────────────────────────── palette per mode ─────────────────────────── */

function palette(mode: OnboardMode) {
  const dark = mode === 'dark';
  return {
    dark,
    bg: dark ? '#000000' : '#FFFFFF',
    text: dark ? '#FFFFFF' : '#0A0A0A',
    muted: dark ? 'rgba(255,255,255,0.56)' : 'rgba(10,10,10,0.5)',
    sheet: dark ? '#141414' : '#F4F5F7',
    sheetBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.06)',
    ink: dark ? '#FFFFFF' : '#0A0A0A', // primary button fill
    inkText: dark ? '#0A0A0A' : '#FFFFFF',
    grabber: dark ? 'rgba(255,255,255,0.22)' : 'rgba(10,10,10,0.18)',
  };
}

function Mark({ mark, size, accent }: { mark: MarkId; size: number; accent: string }) {
  switch (mark) {
    case 'one':
      return <OneMark size={size} color={accent} eye="#000000" />;
    case 'winzi':
      return <WinziMark size={size} />;
    case 'mixstar':
      return <MixStarMark size={size} />;
    case 'one01':
    default:
      return <One01Mark size={size} color={accent} />;
  }
}

/** Rounded gradient glow anchored at the bottom-center. */
function Glow({ color, mode, id }: { color: string; mode: OnboardMode; id: string }) {
  const gid = `glow_${id}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="98%" rx="78%" ry="56%" gradientUnits="objectBoundingBox">
          <Stop offset="0" stopColor={color} stopOpacity={mode === 'dark' ? 0.55 : 0.2} />
          <Stop offset="0.55" stopColor={color} stopOpacity={mode === 'dark' ? 0.16 : 0.06} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
    </Svg>
  );
}

/* ═══════════════════════════════ root ═══════════════════════════════ */

type Step = 'splash' | 'welcome' | 'connect';

export function ProductOnboarding({ config, onFinish }: { config: OnboardConfig; onFinish: () => void }) {
  const [step, setStep] = useState<Step>('splash');
  const [slide, setSlide] = useState(0);
  const p = palette(config.mode);
  const insets = useSafeAreaInsets();

  // Splash auto-advances.
  useEffect(() => {
    if (step !== 'splash') return;
    const t = setTimeout(() => setStep('welcome'), 1300);
    return () => clearTimeout(t);
  }, [step]);

  const isLast = slide >= config.slides.length - 1;

  const advance = () => {
    haptic.tap();
    if (!isLast) setSlide((s) => s + 1);
    else setStep('connect');
  };

  const finish = () => {
    haptic.success();
    onFinish();
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg, paddingTop: insets.top }]}>
      <Glow color={config.glow} mode={config.mode} id={config.id} />

      {step === 'splash' && (
        <Pressable style={styles.splash} onPress={() => setStep('welcome')}>
          <View style={styles.splashMark}>
            <Mark mark={config.mark} size={84} accent={config.accent} />
          </View>
        </Pressable>
      )}

      {step === 'welcome' && (
        <Welcome
          config={config}
          p={p}
          slide={slide}
          setSlide={setSlide}
          isLast={isLast}
          onAdvance={advance}
          onDismiss={finish}
          bottomInset={insets.bottom}
        />
      )}

      {step === 'connect' && (
        <Connect
          config={config}
          p={p}
          onBack={() => setStep('welcome')}
          onFinish={finish}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

/* ─────────────────────────────── welcome ─────────────────────────────── */

function Welcome({
  config,
  p,
  slide,
  setSlide,
  isLast,
  onAdvance,
  onDismiss,
  bottomInset,
}: {
  config: OnboardConfig;
  p: ReturnType<typeof palette>;
  slide: number;
  setSlide: (n: number) => void;
  isLast: boolean;
  onAdvance: () => void;
  onDismiss: () => void;
  bottomInset: number;
}) {
  const s = config.slides[slide];
  const { height } = useWindowDimensions();

  return (
    <View style={styles.flex}>
      {/* floating emoji */}
      <Text style={[styles.emojiTop, { fontSize: 42 }]}>{s.emojiTop}</Text>
      <Text style={[styles.emojiBottom, { fontSize: 42, top: height * 0.56 }]}>{s.emojiBottom}</Text>

      {/* centered content */}
      <View style={styles.welcomeCenter}>
        <View style={{ marginBottom: 22 }}>
          <Mark mark={config.mark} size={54} accent={config.accent} />
        </View>
        <Text style={[styles.welcomeTitle, { color: p.text }]}>{s.title}</Text>
        <Text style={[styles.welcomeSub, { color: p.muted }]}>{s.subtitle}</Text>
        <View style={styles.dots}>
          {config.slides.map((_, i) => (
            <Pressable key={i} onPress={() => setSlide(i)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i === slide ? p.text : p.muted, opacity: i === slide ? 1 : 0.4, width: i === slide ? 18 : 6 },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* CTA + dismiss */}
      <View style={[styles.welcomeFooter, { paddingBottom: Math.max(bottomInset, 18) + 10 }]}>
        <Pressable
          onPress={onAdvance}
          style={({ pressed }) => [styles.cta, { backgroundColor: p.ink }, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.ctaTxt, { color: p.inkText }]}>{isLast ? config.ctaLabel : 'Next'}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={10} style={styles.dismiss}>
          {config.dismiss === 'skip' ? (
            <Text style={[styles.skipTxt, { color: p.muted }]}>Skip</Text>
          ) : (
            <Text style={[styles.closeTxt, { color: p.muted }]}>✕</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ─────────────────────────────── connect ─────────────────────────────── */

function Connect({
  config,
  p,
  onBack,
  onFinish,
  bottomInset,
}: {
  config: OnboardConfig;
  p: ReturnType<typeof palette>;
  onBack: () => void;
  onFinish: () => void;
  bottomInset: number;
}) {
  return (
    <View style={styles.flex}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.connectBack}>
        <Text style={[styles.closeTxt, { color: p.muted, fontSize: 26 }]}>‹</Text>
      </Pressable>

      {/* logo + tagline */}
      <View style={styles.connectLogo}>
        {config.logo === 'horizontal' ? (
          <One01Wordmark height={40} color={p.text} />
        ) : (
          <>
            <Mark mark={config.mark} size={54} accent={config.accent} />
            <Text style={[styles.connectName, { color: p.text }]}>{config.name}</Text>
          </>
        )}
        <Text style={[styles.connectTagline, { color: config.mode === 'dark' ? config.accent : p.muted }]}>
          {config.connectTagline}
        </Text>
      </View>

      {/* bottom sheet */}
      <View style={[styles.sheet, { backgroundColor: p.sheet, borderColor: p.sheetBorder, paddingBottom: Math.max(bottomInset, 18) + 14 }]}>
        <View style={[styles.grabber, { backgroundColor: p.grabber }]} />
        <AuthButton provider="google" mode={config.mode} onPress={onFinish} />
        <AuthButton provider="apple" mode={config.mode} onPress={onFinish} />
        <AuthButton provider="email" mode={config.mode} onPress={onFinish} />
        <Text style={[styles.legal, { color: p.muted }]}>
          By continuing, you acknowledge ONE01{' '}
          <Text style={{ textDecorationLine: 'underline' }}>Privacy Policy</Text> and agree to get occasional promotional emails and notifications.
        </Text>
      </View>
    </View>
  );
}

function AuthButton({ provider, mode, onPress }: { provider: 'google' | 'apple' | 'email'; mode: OnboardMode; onPress: () => void }) {
  const dark = mode === 'dark';
  // Google: always white. Apple: black-on-light / white-on-dark (Apple guideline).
  // Email (primary): ink on light, near-black-with-border on dark.
  let bg = '#FFFFFF';
  let fg = '#1F1F23';
  let border: string | undefined = dark ? undefined : 'rgba(10,10,10,0.1)';
  if (provider === 'apple') {
    bg = dark ? '#FFFFFF' : '#0A0A0A';
    fg = dark ? '#0A0A0A' : '#FFFFFF';
    border = undefined;
  } else if (provider === 'email') {
    bg = dark ? '#111114' : '#0A0A0A';
    fg = '#FFFFFF';
    border = dark ? 'rgba(255,255,255,0.14)' : undefined;
  }

  const label = provider === 'google' ? 'Continue with Google' : provider === 'apple' ? 'Continue with Apple' : 'Continue with Email';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.authBtn,
        { backgroundColor: bg, borderColor: border ?? 'transparent', borderWidth: border ? 1 : 0 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.authIcon}>
        {provider === 'google' && <GoogleIcon size={20} />}
        {provider === 'apple' && <AppleIcon size={20} color={fg} />}
        {provider === 'email' && <MailIcon size={20} color={fg} />}
      </View>
      <Text style={[styles.authTxt, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ═══════════════════════════════ styles ═══════════════════════════════ */

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  /* splash */
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashMark: { marginTop: -20 },

  /* welcome */
  emojiTop: { position: 'absolute', top: '16%', right: '15%' },
  emojiBottom: { position: 'absolute', left: '13%' },
  welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  welcomeSub: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 22, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  welcomeFooter: { paddingHorizontal: 34, alignItems: 'center', gap: 16 },
  cta: { width: '100%', maxWidth: 360, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  ctaTxt: { fontSize: 16, fontWeight: '700' },
  dismiss: { padding: 6 },
  skipTxt: { fontSize: 15, fontWeight: '600' },
  closeTxt: { fontSize: 18, fontWeight: '400' },

  /* connect */
  connectBack: { position: 'absolute', top: 6, left: 14, zIndex: 2, padding: 8 },
  connectLogo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 30 },
  connectName: { fontSize: 34, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  connectTagline: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, marginTop: 2 },

  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 8 },
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 15, gap: 10 },
  authIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  authTxt: { fontSize: 15.5, fontWeight: '600' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 6, paddingHorizontal: 10 },
});
