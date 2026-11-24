/**
 * ProfileSetup — shown ONCE, right after the first successful sign-in, before
 * the ONE01 Platform opens. Lets the user pick a display name and (optionally) a
 * photo. The name is pre-filled from the provider (Google full name) or derived
 * from the email local-part, so "Continue" works in one tap. "Skip" keeps the
 * suggested name and no photo.
 *
 * Matches the ONE01 onboarding look (light bg, yellow glow, wordmark) so it feels
 * like one continuous flow out of the Connect sheet. Commits name/handle/email/
 * method + avatar to the platform store, then calls onDone (the parent flips
 * `entered` → the app opens).
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { haptic } from '../../utils/haptics';
import { One01Wordmark } from './brand';
import { pickAvatar } from './Panels';
import { useOne01PlatformStore } from '../../stores/one01PlatformStore';

export interface AuthPrefill {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  method: 'google' | 'apple' | 'email' | 'whatsapp' | 'wallet' | 'guest';
}

const ACCENT = '#111318';
const GLOW = '#E8B923';
const FRAME_MAX = 440;

/** "ariel.bar_18" → "Ariel Bar 18" */
function nameFromEmail(email?: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] || '';
  return local
    .replace(/[._\-+]+/g, ' ')
    .replace(/\d+$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}

/** A clean @handle from the name, falling back to the email local-part. */
function handleFrom(name: string, email?: string | null): string {
  const base = (name || (email ? email.split('@')[0] : '') || 'one').toLowerCase();
  const h = base.replace(/[^a-z0-9]/g, '');
  return h || 'one';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '🙂';
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) ?? '')).toUpperCase();
}

function label(method: AuthPrefill['method']): string {
  switch (method) {
    case 'google': return 'Signed in with Google';
    case 'apple': return 'Signed in with Apple';
    case 'email': return 'Signed in with email';
    case 'whatsapp': return 'Signed in with WhatsApp';
    case 'wallet': return 'Wallet connected';
    default: return 'Welcome';
  }
}

function Glow({ w, h }: { w: number; h: number }) {
  return (
    <View pointerEvents="none" style={styles.glowWrap}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="ps_glow" cx={w / 2} cy={h} rx={w * 0.98} ry={h * 0.98} fx={w / 2} fy={h} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={GLOW} stopOpacity={0.22} />
            <Stop offset="0.42" stopColor={GLOW} stopOpacity={0.08} />
            <Stop offset="0.72" stopColor={GLOW} stopOpacity={0.025} />
            <Stop offset="1" stopColor={GLOW} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h} rx={w * 0.98} ry={h * 0.98} fill="url(#ps_glow)" />
      </Svg>
    </View>
  );
}

export function ProfileSetup({ prefill, onDone }: { prefill: AuthPrefill; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const setProfile = useOne01PlatformStore((s) => s.setProfile);
  const setAvatar = useOne01PlatformStore((s) => s.setAvatar);
  const setEntered = useOne01PlatformStore((s) => s.setEntered);

  const suggested = useMemo(
    () => (prefill.name?.trim() || nameFromEmail(prefill.email) || ''),
    [prefill.name, prefill.email],
  );
  const [name, setName] = useState(suggested);
  // local picked photo (data/file URI) — falls back to the provider avatar
  const [photo, setPhoto] = useState<string | null>(prefill.avatarUrl ?? null);

  const frameW = Math.min(winW, FRAME_MAX);
  const glowH = Math.round(winH * 0.6);

  const choosePhoto = async () => {
    const uri = await pickAvatar();
    if (uri) { haptic.success(); setPhoto(uri); }
  };

  const commit = (finalName: string) => {
    const nm = finalName.trim() || suggested || 'Guest';
    setProfile({
      displayName: nm,
      handle: handleFrom(nm, prefill.email),
      email: prefill.email ?? null,
      authMethod: prefill.method,
    });
    if (photo) setAvatar(photo);
    haptic.success();
    setEntered(true);
    onDone();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Glow w={winW} h={glowH} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.frame, { width: frameW }]}>
            <View style={styles.header}>
              <One01Wordmark height={30} color={ACCENT} />
              <Text style={styles.badge}>{label(prefill.method)}</Text>
            </View>

            <Text style={styles.title}>Make it yours</Text>
            <Text style={styles.sub}>Choose how you show up on ONE01. You can change this anytime.</Text>

            <Pressable onPress={choosePhoto} style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials(name || suggested)}</Text>
                )}
              </View>
              <View style={styles.cam}><Text style={{ fontSize: 13 }}>📷</Text></View>
            </Pressable>
            <Text style={styles.photoHint}>{photo ? 'Tap to change photo' : 'Add a photo (optional)'}</Text>

            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(10,10,10,0.35)"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => commit(name)}
              style={styles.input}
            />
            {prefill.email ? <Text style={styles.email}>{prefill.email}</Text> : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 10, width: frameW }]}>
          <Pressable
            onPress={() => commit(name)}
            disabled={!name.trim() && !suggested}
            style={({ pressed }) => [styles.cta, (!name.trim() && !suggested) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaTxt}>Continue</Text>
          </Pressable>
          <Pressable onPress={() => commit(suggested)} hitSlop={10} style={styles.skip}>
            <Text style={styles.skipTxt}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center' },
  flex: { flex: 1, width: '100%', alignItems: 'center' },
  glowWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 10 },
  frame: { alignSelf: 'center', paddingHorizontal: 28 },

  header: { alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 18 },
  badge: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, color: 'rgba(10,10,10,0.42)' },

  title: { fontSize: 26, fontWeight: '800', color: '#0A0A0A', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 20, color: 'rgba(10,10,10,0.5)', textAlign: 'center', marginTop: 8, marginBottom: 22, paddingHorizontal: 8 },

  avatarWrap: { alignSelf: 'center', width: 104, height: 104 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#F2F2F4', borderWidth: 2, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 104, height: 104, borderRadius: 52 },
  avatarInitials: { fontSize: 34, fontWeight: '800', color: ACCENT },
  cam: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: GLOW, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoHint: { alignSelf: 'center', fontSize: 12.5, fontWeight: '600', color: 'rgba(10,10,10,0.42)', marginTop: 10, marginBottom: 24 },

  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: 'rgba(10,10,10,0.5)', marginBottom: 7, letterSpacing: 0.2 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,10,10,0.18)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, color: '#0A0A0A', backgroundColor: 'rgba(10,10,10,0.02)' },
  email: { fontSize: 13, color: 'rgba(10,10,10,0.4)', marginTop: 10, marginLeft: 2 },

  footer: { alignSelf: 'center', paddingHorizontal: 28, gap: 12, alignItems: 'center' },
  cta: { width: '100%', backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  ctaTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skip: { padding: 6 },
  skipTxt: { fontSize: 14.5, fontWeight: '600', color: 'rgba(10,10,10,0.45)' },
});
