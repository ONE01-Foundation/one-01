/**
 * DiscoveryScreen – Protocol library + Providers tab. Start something.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { OrbAgent } from '../components/OrbAgent';
import { UnitsBadge } from '../components/UnitsBadge';
import { PROTOCOLS } from '../data/protocols';
import { PROVIDERS } from '../data/providers';
import { LENS_LABELS } from '../core/types';
import type { LifeLens } from '../core/types';
import type { Protocol } from '../data/protocols';
import type { AppShellParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Discovery'>;

type Tab = 'protocols' | 'providers';

export function DiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user, startProcessFromProtocol } = useOne();
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('protocols');
  const [search, setSearch] = useState('');
  const [lensFilter, setLensFilter] = useState<LifeLens | null>(null);
  const [protocolDetail, setProtocolDetail] = useState<Protocol | null>(null);
  const [starting, setStarting] = useState(false);

  const filteredProtocols = useMemo(() => {
    let list = PROTOCOLS;
    if (lensFilter) list = list.filter((p) => p.lens === lensFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, lensFilter]);

  const onStartProtocol = async (protocolId: string) => {
    if (!user) return;
    setStarting(true);
    const process = await startProcessFromProtocol(protocolId);
    setStarting(false);
    setProtocolDetail(null);
    if (process) navigation.replace('Process', { processId: process.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <OrbAgent
            size={28}
            state="idle"
            mode="units"
            onPress={() => navigation.navigate('Home')}
            tappable
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Discovery</Text>
        <UnitsBadge />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'protocols' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('protocols')}
        >
          <Text style={[styles.tabText, { color: colors.text }]}>Protocols</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'providers' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('providers')}
        >
          <Text style={[styles.tabText, { color: colors.text }]}>Providers</Text>
        </TouchableOpacity>
      </View>

      {tab === 'protocols' && (
        <>
          <TextInput
            style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search protocols..."
            placeholderTextColor={colors.textSecondary}
          />
          <ScrollView horizontal style={styles.lensRow} contentContainerStyle={styles.lensRowContent} showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.lensChip, { backgroundColor: colors.surface, borderColor: colors.border }, lensFilter === null && { borderColor: colors.primary, borderWidth: 2 }]}
              onPress={() => setLensFilter(null)}
            >
              <Text style={[styles.lensChipText, { color: colors.text }]}>All</Text>
            </TouchableOpacity>
            {(['health', 'finance', 'knowledge', 'business'] as LifeLens[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.lensChip, { backgroundColor: colors.surface, borderColor: colors.border }, lensFilter === l && { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => setLensFilter(l)}
              >
                <Text style={[styles.lensChipText, { color: colors.text }]}>{LENS_LABELS[l]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {filteredProtocols.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setProtocolDetail(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{p.title}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{LENS_LABELS[p.lens]} · ~{p.estimateMinutes} min</Text>
                <Text style={[styles.cardDesc, { color: colors.text }]} numberOfLines={2}>{p.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {tab === 'providers' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.comingSoonBanner, { color: colors.textSecondary }]}>Providers (full flow in v0.2). Mock list below.</Text>
          {PROVIDERS.map((prov) => (
            <TouchableOpacity
              key={prov.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('ProviderProfile', { providerId: prov.id })}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>{prov.displayName}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{LENS_LABELS[prov.lens]} · {prov.priceRange} · {prov.rating}★</Text>
              <Text style={[styles.cardDesc, { color: colors.text }]} numberOfLines={2}>{prov.bio}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Protocol detail modal */}
      <Modal visible={!!protocolDetail} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setProtocolDetail(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            {protocolDetail && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{protocolDetail.title}</Text>
                <Text style={[styles.modalMeta, { color: colors.textSecondary }]}>{LENS_LABELS[protocolDetail.lens]} · ~{protocolDetail.estimateMinutes} min</Text>
                <Text style={[styles.modalDesc, { color: colors.text }]}>{protocolDetail.description}</Text>
                <Text style={[styles.stepsLabel, { color: colors.textSecondary }]}>Steps</Text>
                {protocolDetail.stepsPreview.map((s, i) => (
                  <Text key={i} style={[styles.stepBullet, { color: colors.text }]}>• {s}</Text>
                ))}
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: colors.primary }]}
                  onPress={() => onStartProtocol(protocolDetail.id)}
                  disabled={starting}
                >
                  <Text style={styles.startBtnText}>{starting ? 'Starting…' : 'Start Process'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setProtocolDetail(null)}>
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 16, fontWeight: '500' },
  search: { margin: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  lensRow: { maxHeight: 48, marginBottom: 8 },
  lensRowContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  lensChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  lensChipText: { fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  card: { padding: 18, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardMeta: { fontSize: 13, marginTop: 4 },
  cardDesc: { fontSize: 14, marginTop: 8 },
  comingSoonBanner: { fontSize: 13, marginBottom: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  modalMeta: { fontSize: 14, marginTop: 6 },
  modalDesc: { fontSize: 15, marginTop: 12 },
  stepsLabel: { fontSize: 12, marginTop: 16, textTransform: 'uppercase' },
  stepBullet: { fontSize: 15, marginTop: 4 },
  startBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  cancelBtnText: { fontSize: 15 },
});
