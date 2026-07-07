/**
 * ProcessScreen – Card detail, Compile Card, fields UI, notes timeline, Mark done.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import { compileProcess } from '../core/compiler';
import { OrbAgent } from '../components/OrbAgent';
import type { OrbState } from '../components/OrbAgent';
import { LENS_LABELS } from '../core/types';
import type { AppShellParamList } from '../navigation/types';
import type { OneProcess } from '../core/types';

type Route = RouteProp<AppShellParamList, 'Process'>;
type Nav = NativeStackNavigationProp<AppShellParamList, 'Process'>;

function FieldBlock({
  label,
  value,
  items,
  colors,
}: {
  label: string;
  value?: string;
  items?: string[];
  colors: { text: string; textSecondary: string; surface: string; border: string };
}) {
  if (!value && (!items || items.length === 0)) return null;
  return (
    <View style={[styles.fieldBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {value ? <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text> : null}
      {items && items.length > 0 ? (
        <View style={styles.fieldList}>
          {items.map((item, i) => (
            <Text key={i} style={[styles.fieldBullet, { color: colors.text }]}>• {item}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ProcessScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    getProcess,
    addProcessMessage,
    updateProcess,
    setProcessStatus,
    setProcessOutcome,
    setAgentStatusText,
  } = useOne();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { processId } = route.params;

  const process = getProcess(processId);
  const [input, setInput] = useState('');
  const [outcomeInput, setOutcomeInput] = useState('');
  const [showOutcome, setShowOutcome] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');

  useEffect(() => {
    if (!process) navigation.goBack();
  }, [process, navigation]);

  if (!process) return null;

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await addProcessMessage(processId, 'user', text);
    const reply = 'Ready. What do we execute now?';
    await addProcessMessage(processId, 'agent', reply);
    setAgentStatusText(reply);
  };

  const onCompileCard = async () => {
    setOrbState('thinking');
    const compiled = compileProcess(process);
    await updateProcess(processId, compiled);
    setOrbState('idle');
  };

  const onMarkDone = () => {
    setShowOutcome(true);
  };

  const onConfirmDone = async () => {
    if (outcomeInput.trim()) await setProcessOutcome(processId, outcomeInput.trim());
    await setProcessStatus(processId, 'done');
    setShowOutcome(false);
    setOutcomeInput('');
  };

  const f = process.fields ?? {};

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.topBar, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <View style={styles.topBarLeft}>
          <OrbAgent
            size={28}
            state={orbState}
            mode="process"
            onPress={() => navigation.navigate('Home')}
            tappable
          />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ShareCard', { processId })} style={styles.shareBtnTop}>
          <Text style={[styles.shareBtnTopText, { color: colors.primary }]}>Share</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{process.title}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {LENS_LABELS[process.lens]} · {process.status}
          </Text>
        </View>

        <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Summary</Text>
          <Text style={[styles.summaryText, { color: colors.text }]}>{process.summary || '—'}</Text>
          <TouchableOpacity
            style={[styles.compileBtn, { backgroundColor: colors.primary }]}
            onPress={onCompileCard}
          >
            <Text style={styles.compileBtnText}>Compile Card</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Card fields</Text>
        <FieldBlock label="Goal" value={f.goal} colors={colors} />
        <FieldBlock label="Context" value={f.context} colors={colors} />
        <FieldBlock label="Constraints" items={f.constraints} colors={colors} />
        <FieldBlock label="Next steps" items={f.nextSteps} colors={colors} />
        <FieldBlock label="Risks" items={f.risks} colors={colors} />
        <FieldBlock label="Resources" items={f.resources} colors={colors} />
        {process.status === 'done' && f.outcome ? (
          <FieldBlock label="Outcome" value={f.outcome} colors={colors} />
        ) : null}

        {process.status === 'active' && (
          <>
            {showOutcome ? (
              <View style={[styles.outcomeWrap, { borderColor: colors.border }]}>
                <Text style={[styles.outcomeLabel, { color: colors.textSecondary }]}>Outcome (optional)</Text>
                <TextInput
                  style={[styles.outcomeInput, { borderColor: colors.border, color: colors.text }]}
                  value={outcomeInput}
                  onChangeText={setOutcomeInput}
                  placeholder="What was the result?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
                <View style={styles.outcomeActions}>
                  <TouchableOpacity style={[styles.outcomeBtn, { borderColor: colors.border }]} onPress={() => setShowOutcome(false)}>
                    <Text style={[styles.outcomeBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.outcomeBtn, { backgroundColor: colors.primary }]} onPress={onConfirmDone}>
                    <Text style={styles.outcomeBtnTextPrimary}>Mark done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMarkDone}>
                <Text style={[styles.doneBtnText, { color: colors.text }]}>Mark done</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notes</Text>
        {process.messages.map((m) => (
          <View key={m.id} style={[styles.msg, { backgroundColor: colors.surface }]}>
            <Text style={[styles.msgSender, { color: colors.textSecondary }]}>{m.sender}</Text>
            <Text style={[styles.msgText, { color: colors.text }]}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Add a note..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: colors.surface, borderColor: colors.border }, orbState === 'listening' && { borderColor: colors.primary }]}
          onPressIn={() => setOrbState('listening')}
          onPressOut={async () => {
            setOrbState('idle');
            await addProcessMessage(processId, 'user', '(voice note placeholder)');
          }}
        >
          <Text style={styles.micBtnText}>🎤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={onSend}
          disabled={!input.trim()}
        >
          <Text style={styles.sendBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 17 },
  shareBtnTop: { padding: 4 },
  shareBtnTopText: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 24 },
  header: { paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { fontSize: 14, marginTop: 6 },
  summaryRow: { padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1 },
  summaryLabel: { fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  summaryText: { fontSize: 15 },
  compileBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  compileBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  fieldBlock: { padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  fieldLabel: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14 },
  fieldList: { marginTop: 4 },
  fieldBullet: { fontSize: 14, marginBottom: 2 },
  outcomeWrap: { marginTop: 16, padding: 14, borderRadius: 10, borderWidth: 1 },
  outcomeLabel: { fontSize: 12, marginBottom: 6 },
  outcomeInput: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 60, fontSize: 14 },
  outcomeActions: { flexDirection: 'row', marginTop: 10, gap: 10 },
  outcomeBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  outcomeBtnText: { fontSize: 15 },
  outcomeBtnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '600' },
  doneBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  doneBtnText: { fontSize: 15 },
  notesLabel: { fontSize: 12, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  msg: { padding: 12, borderRadius: 10, marginBottom: 8 },
  msgSender: { fontSize: 12, marginBottom: 4 },
  msgText: { fontSize: 15 },
  footer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  micBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  micBtnText: { fontSize: 20 },
  sendBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
});
