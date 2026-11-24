/**
 * ProductOnboarding — one reusable 3-screen skeleton used by every ONE01
 * product. Driven entirely by an `OnboardConfig` (see data/one01/onboarding.ts):
 *
 *   1. Splash  — product mark centered, a rounded gradient glow hugging the
 *                bottom (glow color per product). Auto-advances (tap to skip).
 *   2. Welcome — a SWIPEABLE carousel: mark + title + subtitle + progress dots,
 *                two floating emoji, a primary CTA, and a "Skip" link.
 *   3. Connect — logo + tagline + sign-in (Continue with Google / Apple /
 *                Email). On phones it's a bottom sheet that rises up; on wide
 *                screens it's a centered popup.
 *
 * Background is white ('light') or black ('dark') per the product's mode; the
 * only chromatic element is the per-product glow, which fades to fully
 * transparent so it blends into the background. On desktop the whole flow is
 * constrained to a centered phone-width column (never stretched full-width).
 * Auth is mocked — any button (and Skip) calls `onFinish`.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  TextInput,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { BlurView } from 'expo-blur';
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
  PhoneIcon,
  WalletIcon,
} from './brand';
import type { OnboardConfig, OnboardMode } from '../../data/one01/onboarding';
import type { MarkId } from '../../data/one01/platform';

const FRAME_MAX = 440; // phone-width column on wide screens
const WIDE_AT = 600;

function palette(mode: OnboardMode) {
  const dark = mode === 'dark';
  return {
    dark,
    bg: dark ? '#000000' : '#FFFFFF',
    text: dark ? '#FFFFFF' : '#0A0A0A',
    muted: dark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,10,0.5)',
    sheet: dark ? '#111113' : '#FFFFFF',
    // translucent tint laid over the blur so the glow bleeds through the sheet
    sheetGlass: dark ? 'rgba(12,12,16,0.42)' : 'rgba(255,255,255,0.5)',
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    sheetBorder: dark ? 'rgba(255,255,255,0.09)' : 'rgba(10,10,10,0.08)',
    ink: dark ? '#FFFFFF' : '#0A0A0A',
    inkText: dark ? '#0A0A0A' : '#FFFFFF',
    grabber: dark ? 'rgba(255,255,255,0.22)' : 'rgba(10,10,10,0.16)',
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

/** Rounded gradient glow, brightest at the bottom-center and fading to fully
 *  transparent so it blends into the background. userSpaceOnUse for exact
 *  bottom-anchored geometry on both native and web. */
function Glow({ color, mode, w, h, id }: { color: string; mode: OnboardMode; w: number; h: number; id: string }) {
  const gid = `glow_${id}`;
  const dark = mode === 'dark';
  return (
    <View pointerEvents="none" style={[styles.glowWrap, { height: h }]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={gid} cx={w / 2} cy={h} rx={w * 0.98} ry={h * 0.98} fx={w / 2} fy={h} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={dark ? 0.62 : 0.22} />
            <Stop offset="0.42" stopColor={color} stopOpacity={dark ? 0.24 : 0.08} />
            <Stop offset="0.72" stopColor={color} stopOpacity={dark ? 0.08 : 0.025} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h} rx={w * 0.98} ry={h * 0.98} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

/* ═══════════════════════════════ root ═══════════════════════════════ */

type Step = 'splash' | 'welcome' | 'connect';

export function ProductOnboarding({ config, onFinish }: { config: OnboardConfig; onFinish: () => void }) {
  const [step, setStep] = useState<Step>('splash');
  const [slide, setSlide] = useState(0);
  const p = palette(config.mode);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const wide = winW >= WIDE_AT;
  const frameW = wide ? FRAME_MAX : winW;
  const glowH = Math.round(winH * 0.62);

  useEffect(() => {
    if (step !== 'splash') return;
    const t = setTimeout(() => setStep('welcome'), 1300);
    return () => clearTimeout(t);
  }, [step]);

  const finish = () => {
    haptic.success();
    onFinish();
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bg, paddingTop: insets.top }]}>
      {/* glow spans the FULL window (behind the centered phone column) so on desktop
          it reads as an ambient backdrop instead of a cut mobile-width dome */}
      <Glow color={config.glow} mode={config.mode} w={winW} h={glowH} id={config.id} />
      <View style={[styles.frame, { width: frameW }]}>
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
            frameW={frameW}
            slide={slide}
            setSlide={setSlide}
            onConnect={() => setStep('connect')}
            onSkip={finish}
            bottomInset={insets.bottom}
          />
        )}

        {step === 'connect' && (
          <Connect
            config={config}
            p={p}
            wide={wide}
            onBack={() => setStep('welcome')}
            onFinish={finish}
            bottomInset={insets.bottom}
          />
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────── welcome ─────────────────────────────── */

function Welcome({
  config,
  p,
  frameW,
  slide,
  setSlide,
  onConnect,
  onSkip,
  bottomInset,
}: {
  config: OnboardConfig;
  p: ReturnType<typeof palette>;
  frameW: number;
  slide: number;
  setSlide: (n: number) => void;
  onConnect: () => void;
  onSkip: () => void;
  bottomInset: number;
}) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const pageH = winH - insets.top;
  const count = config.slides.length;
  const isLast = slide >= count - 1;

  const syncIndex = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / frameW);
    if (i !== slide && i >= 0 && i < count) setSlide(i);
  };

  const goTo = (i: number) => {
    const n = Math.max(0, Math.min(count - 1, i));
    scrollRef.current?.scrollTo({ x: n * frameW, animated: true });
    setSlide(n);
  };

  const onCta = () => {
    haptic.tap();
    if (!isLast) goTo(slide + 1);
    else onConnect();
  };

  return (
    <View style={styles.flex}>
      {/* only the text + emoji pages slide; the mark stays fixed */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={syncIndex}
        onMomentumScrollEnd={syncIndex}
        style={styles.flex}
      >
        {config.slides.map((item, i) => (
          <View key={i} style={{ width: frameW, height: pageH }}>
            <Text style={styles.emojiTop}>{item.emojiTop}</Text>
            <Text style={styles.emojiBottom}>{item.emojiBottom}</Text>
            <View style={styles.welcomeText}>
              <Text style={[styles.welcomeTitle, { color: p.text }]}>{item.title}</Text>
              <Text style={[styles.welcomeSub, { color: p.muted }]}>{item.subtitle}</Text>
              <View style={styles.dots}>
                {config.slides.map((_, d) => (
                  <View
                    key={d}
                    style={[styles.dot, { backgroundColor: d === i ? p.text : p.muted, opacity: d === i ? 1 : 0.45, width: d === i ? 18 : 6 }]}
                  />
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* fixed mark (does not move while pages slide underneath it) */}
      <View pointerEvents="none" style={styles.fixedMark}>
        <Mark mark={config.mark} size={54} accent={config.accent} />
      </View>

      {/* footer */}
      <View style={[styles.footerOverlay, { paddingBottom: Math.max(bottomInset, 20) + 40 }]}>
        <Pressable onPress={onCta} style={({ pressed }) => [styles.cta, { backgroundColor: p.ink }, pressed && { opacity: 0.85 }]}>
          <Text style={[styles.ctaTxt, { color: p.inkText }]}>{isLast ? config.ctaLabel : 'Next'}</Text>
        </Pressable>
        <Pressable onPress={onSkip} hitSlop={10} style={styles.dismiss}>
          <Text style={[styles.skipTxt, { color: p.muted }]}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─────────────────────────────── connect ─────────────────────────────── */

function Connect({
  config,
  p,
  wide,
  onBack,
  onFinish,
  bottomInset,
}: {
  config: OnboardConfig;
  p: ReturnType<typeof palette>;
  wide: boolean;
  onBack: () => void;
  onFinish: () => void;
  bottomInset: number;
}) {
  // Rise-up / fade-in on mount.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);

  // which secondary method the user tapped (opens an inline input / wallet picker)
  const [method, setMethod] = useState<null | 'email' | 'phone' | 'wallet'>(null);
  const [val, setVal] = useState('');
  const methodBg = config.mode === 'dark' ? '#1C1C20' : '#0A0A0A';

  const LogoInner = (
    <View style={styles.logoInner}>
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
  );

  const authButtons = method ? (
    <MethodPanel
      method={method}
      val={val}
      setVal={setVal}
      p={p}
      onBack={() => { haptic.tap(); setMethod(null); setVal(''); }}
      onSubmit={onFinish}
    />
  ) : (
    <>
      <AuthButton provider="google" mode={config.mode} onPress={onFinish} />
      <AuthButton provider="apple" mode={config.mode} onPress={onFinish} />
      {/* email / phone / wallet — each opens its own input or picker */}
      <View style={[styles.methodRow, { backgroundColor: methodBg }]}>
        {(['email', 'phone', 'wallet'] as const).map((m, i) => (
          <React.Fragment key={m}>
            {i > 0 && <View style={[styles.methodDiv, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />}
            <Pressable onPress={() => { haptic.tap(); setMethod(m); setVal(''); }} style={({ pressed }) => [styles.methodBtn, pressed && { opacity: 0.6 }]}>
              {m === 'email' && <MailIcon size={22} color="#fff" />}
              {m === 'phone' && <PhoneIcon size={22} color="#fff" />}
              {m === 'wallet' && <WalletIcon size={24} color="#fff" />}
            </Pressable>
          </React.Fragment>
        ))}
      </View>
      <Text style={[styles.legal, { color: p.muted }]}>
        By continuing, you acknowledge ONE01{' '}
        <Text style={{ textDecorationLine: 'underline' }}>Privacy Policy</Text> and agree to get occasional promotional emails and notifications.
      </Text>
    </>
  );

  return (
    <View style={styles.flex}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.connectBack}>
        <Text style={[styles.backChevron, { color: p.muted }]}>‹</Text>
      </Pressable>

      {wide ? (
        /* desktop: centered popup containing logo + sign-in */
        <View style={styles.popupCenter}>
          <Animated.View
            style={[
              styles.popup,
              { backgroundColor: p.sheet, borderColor: p.sheetBorder, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
            ]}
          >
            {LogoInner}
            <View style={{ height: 14 }} />
            {authButtons}
          </Animated.View>
        </View>
      ) : (
        /* mobile: logo above, sign-in rises from the bottom */
        <>
          <View style={styles.connectLogo}>{LogoInner}</View>
          <Animated.View
            style={[
              styles.sheet,
              { borderColor: p.sheetBorder, paddingBottom: Math.max(bottomInset, 18) + 14, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] },
            ]}
          >
            {/* frosted glass so the glow shows through the sheet */}
            <BlurView intensity={48} tint={p.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: p.sheetGlass }]} />
            <View style={[styles.grabber, { backgroundColor: p.grabber }]} />
            {authButtons}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const WALLETS = [
  { k: 'metamask', name: 'MetaMask', emoji: '🦊' },
  { k: 'coinbase', name: 'Coinbase Wallet', emoji: '🔵' },
  { k: 'walletconnect', name: 'WalletConnect', emoji: '🔗' },
  { k: 'rainbow', name: 'Rainbow', emoji: '🌈' },
  { k: 'phantom', name: 'Phantom', emoji: '👻' },
];

/** The panel that replaces the auth buttons once a secondary method is tapped:
 *  an email/phone text field (opens the right keyboard) or a wallet picker. */
function MethodPanel({ method, val, setVal, p, onBack, onSubmit }: {
  method: 'email' | 'phone' | 'wallet';
  val: string;
  setVal: (s: string) => void;
  p: ReturnType<typeof palette>;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const title = method === 'email' ? 'Continue with email' : method === 'phone' ? 'Continue with phone' : 'Connect a wallet';
  const fieldBg = p.dark ? 'rgba(255,255,255,0.05)' : 'rgba(10,10,10,0.04)';
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.methodHead}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.methodBack}><Text style={[styles.backChevron, { color: p.muted, fontSize: 24 }]}>‹</Text></Pressable>
        <Text style={[styles.methodTitle, { color: p.text }]}>{title}</Text>
      </View>

      {method === 'wallet' ? (
        <View style={{ gap: 8 }}>
          {WALLETS.map((w) => (
            <Pressable key={w.k} onPress={onSubmit} style={({ pressed }) => [styles.walletRow, { borderColor: p.sheetBorder, backgroundColor: fieldBg }, pressed && { opacity: 0.65 }]}>
              <Text style={{ fontSize: 22 }}>{w.emoji}</Text>
              <Text style={[styles.walletName, { color: p.text }]}>{w.name}</Text>
              <View style={styles.flex} />
              <Text style={{ color: p.muted, fontSize: 18 }}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <TextInput
            value={val}
            onChangeText={setVal}
            autoFocus
            keyboardType={method === 'phone' ? 'phone-pad' : 'email-address'}
            inputMode={method === 'phone' ? 'tel' : 'email'}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={method === 'phone' ? '+1 (555) 000-0000' : 'you@email.com'}
            placeholderTextColor={p.muted}
            onSubmitEditing={() => { if (val.trim()) onSubmit(); }}
            returnKeyType="go"
            style={[styles.methodInput, { color: p.text, borderColor: p.sheetBorder, backgroundColor: fieldBg }]}
          />
          <Pressable onPress={() => { if (val.trim()) onSubmit(); }} disabled={!val.trim()} style={({ pressed }) => [styles.methodCta, { backgroundColor: p.ink }, !val.trim() && { opacity: 0.4 }, pressed && val.trim() && { opacity: 0.85 }]}>
            <Text style={[styles.methodCtaTxt, { color: p.inkText }]}>Continue</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function AuthButton({ provider, mode, onPress }: { provider: 'google' | 'apple' | 'email'; mode: OnboardMode; onPress: () => void }) {
  const dark = mode === 'dark';
  let bg = '#FFFFFF';
  let fg = '#1F1F23';
  let border: string | undefined = dark ? undefined : 'rgba(10,10,10,0.1)';
  if (provider === 'apple') {
    bg = dark ? '#FFFFFF' : '#0A0A0A';
    fg = dark ? '#0A0A0A' : '#FFFFFF';
    border = undefined;
  } else if (provider === 'email') {
    bg = dark ? '#1C1C20' : '#0A0A0A';
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
  root: { flex: 1, alignItems: 'center' },
  frame: { flex: 1, alignSelf: 'center', overflow: 'hidden' },
  flex: { flex: 1 },

  glowWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  /* splash */
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashMark: { marginTop: -20 },

  /* welcome */
  fixedMark: { position: 'absolute', top: '34%', left: 0, right: 0, alignItems: 'center' },
  welcomeText: { position: 'absolute', top: '43%', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 34 },
  emojiTop: { position: 'absolute', top: '15%', right: '15%', fontSize: 42 },
  emojiBottom: { position: 'absolute', top: '57%', left: '13%', fontSize: 42 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  welcomeSub: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 10, maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  footerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 30, alignItems: 'center', gap: 14 },
  cta: { width: '100%', maxWidth: 380, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  ctaTxt: { fontSize: 16, fontWeight: '700' },
  dismiss: { padding: 6 },
  skipTxt: { fontSize: 15, fontWeight: '600' },

  /* connect — shared */
  connectBack: { position: 'absolute', top: 6, left: 14, zIndex: 3, padding: 8 },
  backChevron: { fontSize: 28, fontWeight: '400' },
  connectLogo: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 30 },
  logoInner: { alignItems: 'center', gap: 12 },
  connectName: { fontSize: 34, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  connectTagline: { fontSize: 13, fontWeight: '700', letterSpacing: 2.5, marginTop: 2 },

  /* connect — mobile bottom sheet */
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, gap: 12, overflow: 'hidden' },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 8 },

  /* connect — desktop popup */
  popupCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  popup: {
    width: '100%', maxWidth: 380, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 12,
  },

  /* auth buttons */
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 15, gap: 10 },
  authIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  authTxt: { fontSize: 15.5, fontWeight: '600' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 6, paddingHorizontal: 10 },

  /* email / phone / wallet method row */
  methodRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, height: 58, overflow: 'hidden' },
  methodBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 17 },
  methodDiv: { width: StyleSheet.hairlineWidth, height: 26 },

  /* method panel (email / phone input, wallet picker) */
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  methodBack: { padding: 4, marginLeft: -4 },
  methodTitle: { fontSize: 17, fontWeight: '800' },
  methodInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 16 },
  methodCta: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  methodCtaTxt: { fontSize: 15.5, fontWeight: '700' },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  walletName: { fontSize: 15, fontWeight: '700' },
});
