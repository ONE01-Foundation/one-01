/**
 * ShareCardScreen – Preview + share code. No deep link yet.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { LENS_LABELS } from '../core/types';
import type { AppShellParamList } from '../navigation/types';

type Route = RouteProp<AppShellParamList, 'ShareCard'>;
type Nav = NativeStackNavigationProp<AppShellParamList, 'ShareCard'>;

export function ShareCardScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { getProcess } = useOne();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { processId } = route.params;

  const process = getProcess(processId);

  const { shareCode } = useMemo(() => {
    if (!process) return { shareCode: '' };
    const payload = {
      v: 1,
      processId: process.id,
      title: process.title,
      summary: process.summary,
      nextSteps: (process.fields?.nextSteps ?? []).slice(0, 3),
    };
    const json = JSON.stringify(payload);
    let base64: string;
    try {
      base64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : (global as any).Buffer?.from?.(json, 'utf8')?.toString('base64') ?? `ONE_${process.id.slice(-8)}`;
    } catch {
      base64 = `ONE_${process.id.slice(-8)}`;
    }
    return { shareCode: base64.slice(0, 48) };
  }, [process]);

  const topNextSteps = (process?.fields?.nextSteps ?? []).slice(0, 3);

  const copyToClipboard = async (text: string) => {
    const { setStringAsync } = await import('expo-clipboard');
    await setStringAsync(text);
  };

  const onShare = async () => {
    try {
      if (Platform.OS !== 'web' && Share.share) {
        await Share.share({
          message: `ONE Process: ${process?.title ?? ''}\nShare code: ${shareCode}`,
          title: process?.title ?? 'Process',
        });
      } else {
        await copyToClipboard(shareCode);
        Alert.alert('Copied', 'Share code copied to clipboard.');
      }
    } catch (e) {
      await copyToClipboard(shareCode);
      Alert.alert('Copied', 'Share code copied to clipboard.');
    }
  };

  const onCopyCode = async () => {
    await copyToClipboard(shareCode);
    Alert.alert('Copied', 'Share code copied to clipboard.');
  };

  if (!process) {
    navigation.goBack();
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <OrbAgent size={28} state="idle" mode="process" onPress={() => navigation.navigate('Home')} tappable />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Share</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.previewOrb}>
            <OrbAgent size={32} state="idle" mode="process" />
          </View>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{process.title}</Text>
          <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>{LENS_LABELS[process.lens]} · {process.status}</Text>
          <Text style={[styles.previewSummary, { color: colors.text }]}>{process.summary || '—'}</Text>
          {topNextSteps.length > 0 && (
            <>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Next steps</Text>
              {topNextSteps.map((s, i) => (
                <Text key={i} style={[styles.previewStep, { color: colors.text }]}>• {s}</Text>
              ))}
            </>
          )}
        </View>
        <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Share code</Text>
        <Text selectable style={[styles.codeValue, { color: colors.text }]}>{shareCode || '—'}</Text>
        <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onCopyCode}>
          <Text style={[styles.copyBtnText, { color: colors.text }]}>Copy code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={onShare}>
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backWrap: { padding: 4 },
  backText: { fontSize: 17 },
  title: { fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 60 },
  scroll: { flex: 1 },
  content: { padding: 24 },
  preview: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  previewOrb: { alignItems: 'center', marginBottom: 12 },
  previewTitle: { fontSize: 20, fontWeight: '700' },
  previewMeta: { fontSize: 13, marginTop: 6 },
  previewSummary: { fontSize: 15, marginTop: 12 },
  previewLabel: { fontSize: 12, marginTop: 16, textTransform: 'uppercase' },
  previewStep: { fontSize: 14, marginTop: 4 },
  codeLabel: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  codeValue: { fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 16 },
  copyBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, marginBottom: 12 },
  copyBtnText: { fontSize: 15 },
  shareBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
