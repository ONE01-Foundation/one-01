import type {
  PeopleBlock,
  ProgressBlock,
  TasksBlock,
  TimelineBlock,
  UnitAction,
  UnitEntity,
  UnitRecord,
  UnitTask,
} from './unitSchema';
import { transitionUnitStatus, type UnitTransitionEvent } from './unitStateMachine';

function getBlock<T>(unit: UnitRecord, kind: T extends { kind: infer K } ? K : never): T | null {
  return (unit.blocks.find((block) => block.kind === kind) as T | undefined) ?? null;
}

function replaceBlock(unit: UnitRecord, nextBlock: UnitRecord['blocks'][number]): UnitRecord {
  return {
    ...unit,
    blocks: unit.blocks.map((block) => (block.kind === nextBlock.kind ? nextBlock : block)),
  };
}

function computeProgress(tasks: UnitTask[]) {
  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter((task) => task.done).length;
  const completionPercent = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  return { tasksTotal, tasksDone, completionPercent };
}

export function getTasks(unit: UnitRecord): UnitTask[] {
  const block = getBlock<TasksBlock>(unit, 'tasks');
  return block?.data.tasks ?? [];
}

export function updateTaskDone(unit: UnitRecord, taskId: string, done: boolean, nowIso: string): UnitRecord {
  const tasksBlock = getBlock<TasksBlock>(unit, 'tasks');
  if (!tasksBlock) return unit;

  const nextTasks = tasksBlock.data.tasks.map((task) => (task.id === taskId ? { ...task, done } : task));
  let nextUnit = replaceBlock(unit, { ...tasksBlock, data: { tasks: nextTasks } });

  const progressBlock = getBlock<ProgressBlock>(nextUnit, 'progress');
  if (progressBlock && progressBlock.data.mode === 'computed') {
    const metric = computeProgress(nextTasks);
    nextUnit = replaceBlock(nextUnit, {
      ...progressBlock,
      data: { ...progressBlock.data, metric: { ...metric, updatedAt: nowIso } },
    });
  }

  return addTimelineEvent(
    nextUnit,
    {
      id: `${unit.id}-evt-task-${Date.now()}`,
      kind: done ? 'task_completed' : 'task_added',
      at: nowIso,
      payload: { taskId, done },
    },
    nowIso
  );
}

export function setManualProgress(unit: UnitRecord, percent: number, nowIso: string): UnitRecord {
  const progressBlock = getBlock<ProgressBlock>(unit, 'progress');
  const tasks = getTasks(unit);
  if (!progressBlock) return unit;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const computed = computeProgress(tasks);
  const next = replaceBlock(unit, {
    ...progressBlock,
    data: {
      ...progressBlock.data,
      mode: 'manual',
      manualPercent: clamped,
      metric: {
        tasksTotal: computed.tasksTotal,
        tasksDone: computed.tasksDone,
        completionPercent: clamped,
        updatedAt: nowIso,
      },
    },
  });
  return addTimelineEvent(
    next,
    { id: `${unit.id}-evt-manual-${Date.now()}`, kind: 'note', at: nowIso, payload: { manualPercent: clamped } },
    nowIso
  );
}

export function ensureComputedProgress(unit: UnitRecord, nowIso: string): UnitRecord {
  const progressBlock = getBlock<ProgressBlock>(unit, 'progress');
  if (!progressBlock) return unit;
  const metric = computeProgress(getTasks(unit));
  return replaceBlock(unit, {
    ...progressBlock,
    data: { ...progressBlock.data, mode: 'computed', manualPercent: undefined, metric: { ...metric, updatedAt: nowIso } },
  });
}

export function addProviderEntity(unit: UnitRecord, provider: UnitEntity, nowIso: string): UnitRecord {
  const people = getBlock<PeopleBlock>(unit, 'people');
  if (!people) return unit;
  const exists = people.data.entities.some((entity) => entity.id === provider.id);
  const entities = exists ? people.data.entities : [...people.data.entities, provider];
  const connectedProviderIds = people.data.connectedProviderIds.includes(provider.id)
    ? people.data.connectedProviderIds
    : [...people.data.connectedProviderIds, provider.id];
  const nextUnit = replaceBlock(unit, {
    ...people,
    data: { entities, connectedProviderIds },
  });
  return addTimelineEvent(
    nextUnit,
    { id: `${unit.id}-evt-provider-${Date.now()}`, kind: 'provider_connected', at: nowIso, payload: { providerId: provider.id } },
    nowIso
  );
}

export function addAction(unit: UnitRecord, action: UnitAction, nowIso: string): UnitRecord {
  const next = {
    ...unit,
    actions: [action, ...unit.actions],
    updatedAt: nowIso,
  };
  return addTimelineEvent(
    next,
    { id: `${unit.id}-evt-action-${Date.now()}`, kind: 'action_requested', at: nowIso, payload: { actionId: action.id } },
    nowIso
  );
}

export function setActionStatus(
  unit: UnitRecord,
  actionId: string,
  status: UnitAction['status'],
  nowIso: string,
  approvedBy?: string
): UnitRecord {
  const actions = unit.actions.map((action) => {
    if (action.id !== actionId) return action;
    if (status === 'approved') {
      return { ...action, status, approvedAt: nowIso, approvedBy };
    }
    if (status === 'completed') {
      return { ...action, status, completedAt: nowIso };
    }
    return { ...action, status };
  });
  const next = { ...unit, actions, updatedAt: nowIso };
  return addTimelineEvent(
    next,
    {
      id: `${unit.id}-evt-action-status-${Date.now()}`,
      kind: status === 'approved' ? 'action_approved' : status === 'completed' ? 'action_executed' : 'note',
      at: nowIso,
      payload: { actionId, status },
    },
    nowIso
  );
}

export function transitionStatus(unit: UnitRecord, event: UnitTransitionEvent, nowIso: string): UnitRecord {
  const next = transitionUnitStatus(unit, event, nowIso);
  return addTimelineEvent(
    next,
    { id: `${unit.id}-evt-status-${Date.now()}`, kind: 'status_changed', at: nowIso, payload: { from: unit.status, to: next.status } },
    nowIso
  );
}

export function addTimelineEvent(unit: UnitRecord, event: TimelineBlock['data']['events'][number], nowIso: string): UnitRecord {
  const timeline = getBlock<TimelineBlock>(unit, 'timeline');
  if (!timeline) return { ...unit, updatedAt: nowIso };
  const nextTimeline = {
    ...timeline,
    data: { events: [event, ...timeline.data.events] },
  };
  return {
    ...replaceBlock(unit, nextTimeline),
    updatedAt: nowIso,
  };
}
