import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeStore } from '../stores/themeStore';
import { useOne } from '../core/OneContext';
import type { AppShellParamList } from '../navigation/types';
import {
  addAction,
  addProviderEntity,
  createDriverLicenseDraft,
  ensureComputedProgress,
  getTasks,
  setActionStatus,
  setManualProgress,
  transitionStatus,
  updateTaskDone,
  type UnitAction,
  type UnitEntity,
  type UnitRecord,
} from '../one01';
import { providersApi, unitApi } from '../services';
import type { ProviderRecord } from '../services/providersApi';

type Nav = NativeStackNavigationProp<AppShellParamList, 'Units'>;

type UiMessage = {
  id: string;
  sender: 'one' | 'user';
  text: string;
};

function nowIso() {
  return new Date().toISOString();
}

function mkMessage(sender: UiMessage['sender'], text: string): UiMessage {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, sender, text };
}

export function UnitsScreen() {
  const { colors } = useThemeStore();
  const navigation = useNavigation<Nav>();
  const { user } = useOne();

  const [chatInput, setChatInput] = useState('');
  const [unit, setUnit] = useState<UnitRecord | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    mkMessage('one', 'ONE is ready. Share your intent to start a Unit.'),
  ]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('Tel Aviv');
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);

  const tasks = useMemo(() => (unit ? getTasks(unit) : []), [unit]);
  const progress = useMemo(() => {
    const progressBlock = unit?.blocks.find((block) => block.kind === 'progress');
    return progressBlock?.kind === 'progress' ? progressBlock.data : null;
  }, [unit]);
  const peopleBlock = useMemo(() => {
    const block = unit?.blocks.find((item) => item.kind === 'people');
    return block?.kind === 'people' ? block.data : null;
  }, [unit]);

  const activeProviderIds = new Set(peopleBlock?.connectedProviderIds ?? []);

  const persistUnit = async (nextUnit: UnitRecord) => {
    setUnit(nextUnit);
    setSaving(true);
    try {
      await unitApi.upsertUnit(nextUnit);
    } catch (error) {
      console.warn('Failed to persist unit:', error);
    } finally {
      setSaving(false);
    }
  };

  const createUnitFromIntent = async (intent: string) => {
    const userId = user?.id ?? 'demo-user';
    const created = createDriverLicenseDraft({
      id: `unit_${Date.now()}`,
      userId,
      nowIso: nowIso(),
      spaceId: 'space_driver_license',
      spaceLabel: 'Driver License Space',
      intake: { city: selectedLocation },
    });
    await persistUnit(created);
    setMessages((prev) => [
      ...prev,
      mkMessage('one', `Created Driver License Unit from intent: "${intent}"`),
      mkMessage('one', 'Use widgets below to update tasks, connect provider, and approve actions.'),
    ]);
  };

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    setMessages((prev) => [...prev, mkMessage('user', text)]);

    if (!unit) {
      await createUnitFromIntent(text);
      return;
    }

    const updated = {
      ...unit,
      updatedAt: nowIso(),
    };
    await persistUnit(updated);
    setMessages((prev) => [...prev, mkMessage('one', 'Captured. Unit state updated from chat input.')]);
  };

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const data = await providersApi.listProvidersByType('driving_teacher', selectedLocation);
      setProviders(data);
      setMessages((prev) => [...prev, mkMessage('one', `Loaded ${data.length} providers for ${selectedLocation}.`)]);
    } catch (error) {
      console.warn('Failed to load providers:', error);
      setMessages((prev) => [...prev, mkMessage('one', 'Could not load providers from Supabase right now.')]);
    } finally {
      setLoadingProviders(false);
    }
  };

  const onToggleTask = async (taskId: string, done: boolean) => {
    if (!unit) return;
    const next = updateTaskDone(unit, taskId, done, nowIso());
    await persistUnit(next);
  };

  const onRequestProviderConnection = async (provider: ProviderRecord) => {
    if (!unit) return;
    const action: UnitAction = {
      id: `action_${Date.now()}`,
      type: 'provider_connection',
      label: `Connect provider: ${provider.name}`,
      requiresApproval: true,
      approvalScope: 'provider_connection',
      status: 'pending',
      createdAt: nowIso(),
      metadata: { providerId: provider.id, reason: `Strong match for ${selectedLocation}` },
    };
    const next = addAction(unit, action, nowIso());
    await persistUnit(next);
    setMessages((prev) => [
      ...prev,
      mkMessage('one', `Approval required: connect ${provider.name}. Why this provider: high rating, local fit, current availability.`),
    ]);
  };

  const onApproveAction = async (actionId: string) => {
    if (!unit) return;
    let next = setActionStatus(unit, actionId, 'approved', nowIso(), user?.id ?? 'user');
    next = setActionStatus(next, actionId, 'completed', nowIso(), user?.id ?? 'user');
    const action = next.actions.find((item) => item.id === actionId);
    const providerId = (action?.metadata?.providerId as string | undefined) ?? null;

    if (providerId) {
      const provider = providers.find((item) => item.id === providerId);
      if (provider) {
        const providerEntity: UnitEntity = {
          id: provider.id,
          type: 'provider',
          displayName: provider.name,
          providerKind: provider.type,
          metadata: { location: provider.location, rating: provider.rating },
        };
        next = addProviderEntity(next, providerEntity, nowIso());
      }
    }

    await persistUnit(next);
    setMessages((prev) => [...prev, mkMessage('one', 'Approved and completed. Unit truth layer updated.')]);
  };

  const onRejectAction = async (actionId: string) => {
    if (!unit) return;
    const next = setActionStatus(unit, actionId, 'rejected', nowIso(), user?.id ?? 'user');
    await persistUnit(next);
  };

  const onActivate = async () => {
    if (!unit) return;
    const next = transitionStatus(unit, 'activate', nowIso());
    await persistUnit(next);
  };

  const onSetWaiting = async () => {
    if (!unit) return;
    const next = transitionStatus(unit, 'external_blocked', nowIso());
    await persistUnit(next);
  };

  const onResume = async () => {
    if (!unit) return;
    const next = transitionStatus(unit, 'resume', nowIso());
    await persistUnit(next);
  };

  const onComplete = async () => {
    if (!unit) return;
    const incomplete = tasks.filter((task) => !task.done);
    if (incomplete.length > 0) {
      Alert.alert('Completion blocked', 'Complete all tasks before marking unit as completed.');
      return;
    }
    const next = transitionStatus(unit, 'complete', nowIso());
    await persistUnit(next);
    setMessages((prev) => [...prev, mkMessage('one', 'Unit completed. Summary generated below.')]);
  };

  const onSwitchToManualProgress = async () => {
    if (!unit) return;
    const next = setManualProgress(unit, progress?.metric.completionPercent ?? 0, nowIso());
    await persistUnit(next);
  };

  const onSwitchToComputedProgress = async () => {
    if (!unit) return;
    const next = ensureComputedProgress(unit, nowIso());
    await persistUnit(next);
  };

  useEffect(() => {
    if (unit) return;
    // Keep an empty-state prompt that guides the first action.
    setMessages((prev) =>
      prev.length > 1 ? prev : [...prev, mkMessage('one', 'Try: "I want to get a driver license"')]
    );
  }, [unit]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>ONE Units</Text>
        <Text style={[styles.saveState, { color: colors.textSecondary }]}>{saving ? 'syncing...' : 'synced'}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Chat (Input Layer)</Text>
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.msg, { backgroundColor: msg.sender === 'one' ? colors.background : colors.surface }]}>
              <Text style={[styles.msgSender, { color: colors.textSecondary }]}>{msg.sender === 'one' ? 'ONE' : 'You'}</Text>
              <Text style={[styles.msgText, { color: colors.text }]}>{msg.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Interactive Widgets</Text>
          {!unit ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Send an intent in chat to create the Driver License Unit.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={fetchProviders}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>
                    {loadingProviders ? 'Loading providers...' : `Load providers (${selectedLocation})`}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={onActivate}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>Set Active</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={onSetWaiting}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>Set Waiting</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={onResume}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>Resume</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={onSwitchToManualProgress}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>Progress: Manual</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.widgetBtn, { borderColor: colors.border }]} onPress={onSwitchToComputedProgress}>
                  <Text style={[styles.widgetBtnText, { color: colors.text }]}>Progress: Computed</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {unit && (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>Unit (Truth Layer)</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{unit.title} · {unit.status}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              Progress: {progress?.metric.completionPercent ?? 0}% ({progress?.mode ?? 'computed'})
            </Text>

            <Text style={[styles.section, { color: colors.text }]}>Tasks</Text>
            {tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, { borderColor: colors.border }]}
                onPress={() => onToggleTask(task.id, !task.done)}
              >
                <Text style={[styles.taskMark, { color: task.done ? '#22c55e' : colors.textSecondary }]}>{task.done ? '✓' : '○'}</Text>
                <Text style={[styles.taskText, { color: colors.text }]}>{task.title}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.section, { color: colors.text }]}>Providers</Text>
            {providers.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>No providers loaded yet.</Text>
            ) : (
              providers.map((provider) => (
                <View key={provider.id} style={[styles.providerCard, { borderColor: colors.border }]}>
                  <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                  <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>
                    {provider.location} · {provider.priceRange} · {provider.rating.toFixed(1)} ★
                  </Text>
                  <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>{provider.availabilityText}</Text>
                  <Text style={[styles.whyText, { color: colors.textSecondary }]}>
                    Why this provider: local context fit, strong historical rating, and near-term availability.
                  </Text>
                  <TouchableOpacity
                    style={[styles.connectBtn, { backgroundColor: activeProviderIds.has(provider.id) ? '#22c55e' : colors.primary }]}
                    disabled={activeProviderIds.has(provider.id)}
                    onPress={() => onRequestProviderConnection(provider)}
                  >
                    <Text style={styles.connectBtnText}>
                      {activeProviderIds.has(provider.id) ? 'Connected' : 'Request connection approval'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={[styles.section, { color: colors.text }]}>Pending approvals</Text>
            {unit.actions.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>No actions yet.</Text>
            ) : (
              unit.actions.map((action) => (
                <View key={action.id} style={[styles.actionRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                    <Text style={[styles.actionMeta, { color: colors.textSecondary }]}>status: {action.status}</Text>
                  </View>
                  {action.status === 'pending' ? (
                    <View style={styles.actionBtns}>
                      <TouchableOpacity style={[styles.smallBtn, { borderColor: colors.border }]} onPress={() => onRejectAction(action.id)}>
                        <Text style={[styles.smallBtnText, { color: colors.text }]}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.primary }]} onPress={() => onApproveAction(action.id)}>
                        <Text style={styles.smallBtnTextPrimary}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))
            )}

            <TouchableOpacity style={[styles.completeBtn, { backgroundColor: colors.primary }]} onPress={onComplete}>
              <Text style={styles.completeBtnText}>Complete Unit</Text>
            </TouchableOpacity>

            {unit.status === 'completed' && (
              <View style={[styles.summaryCard, { borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Completion summary</Text>
                <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
                  Tasks completed: {progress?.metric.tasksDone}/{progress?.metric.tasksTotal}
                </Text>
                <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
                  Providers connected: {peopleBlock?.connectedProviderIds.length ?? 0}
                </Text>
                <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
                  Approved actions: {unit.actions.filter((action) => action.status === 'approved' || action.status === 'completed').length}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputDock, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Chat is input/control. Try: I want to get a driver license"
          placeholderTextColor={colors.textSecondary}
          value={chatInput}
          onChangeText={setChatInput}
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={onSendChat}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backWrap: { padding: 4, marginRight: 12 },
  backText: { fontSize: 17 },
  title: { fontSize: 20, fontWeight: '700', flex: 1 },
  saveState: { fontSize: 12 },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 12, paddingBottom: 110 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 12 },
  panelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  msg: { borderRadius: 10, padding: 10, marginBottom: 8 },
  msgSender: { fontSize: 12, marginBottom: 4 },
  msgText: { fontSize: 14 },
  hint: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  widgetBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  widgetBtnText: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 13, marginBottom: 4 },
  section: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  taskRow: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  taskMark: { fontSize: 18, width: 22, textAlign: 'center' },
  taskText: { fontSize: 14, flex: 1 },
  providerCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  providerName: { fontSize: 14, fontWeight: '700' },
  providerMeta: { fontSize: 12, marginTop: 2 },
  whyText: { fontSize: 12, marginTop: 8 },
  connectBtn: { marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  connectBtnText: { color: '#fff', fontWeight: '600' },
  actionRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', gap: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  actionMeta: { fontSize: 12, marginTop: 2 },
  actionBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  smallBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnText: { fontSize: 12 },
  smallBtnTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '600' },
  completeBtn: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: '700' },
  summaryCard: { marginTop: 12, borderWidth: 1, borderRadius: 10, padding: 10 },
  summaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  summaryLine: { fontSize: 12, marginBottom: 2 },
  inputDock: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 96 },
  sendBtn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnText: { color: '#fff', fontWeight: '700' },
});
