import type { UnitRecord, UnitStatus } from './unitSchema';

export type UnitTransitionEvent =
  | 'intake_completed'
  | 'activate'
  | 'external_blocked'
  | 'resume'
  | 'complete'
  | 'cancel';

const ALLOWED_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['waiting', 'completed', 'cancelled'],
  waiting: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

const EVENT_TO_STATUS: Record<UnitTransitionEvent, UnitStatus> = {
  intake_completed: 'active',
  activate: 'active',
  external_blocked: 'waiting',
  resume: 'active',
  complete: 'completed',
  cancel: 'cancelled',
};

export function canTransition(from: UnitStatus, to: UnitStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextStatusForEvent(event: UnitTransitionEvent): UnitStatus {
  return EVENT_TO_STATUS[event];
}

export function transitionUnitStatus(
  unit: UnitRecord,
  event: UnitTransitionEvent,
  nowIso: string
): UnitRecord {
  const next = nextStatusForEvent(event);
  if (!canTransition(unit.status, next)) {
    throw new Error(`Invalid transition: ${unit.status} -> ${next}`);
  }

  return {
    ...unit,
    status: next,
    updatedAt: nowIso,
    completedAt: next === 'completed' ? nowIso : unit.completedAt,
  };
}

export function isTerminalStatus(status: UnitStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}
