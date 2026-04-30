export type UnitStatus = 'draft' | 'active' | 'waiting' | 'completed' | 'cancelled';

export type SpaceKind = 'personal' | 'business' | 'health' | 'finance' | 'domain';

export type UnitType = 'driver_license' | 'generic';

export type EntityType = 'user' | 'provider' | 'system';

export type ApprovalScope = 'action' | 'provider_connection';

export type BlockKind =
  | 'overview'
  | 'tasks'
  | 'progress'
  | 'people'
  | 'timeline'
  | 'budget'
  | 'schedule'
  | 'files'
  | 'payments'
  | 'domain';

export interface UnitMetricSnapshot {
  completionPercent: number;
  tasksDone: number;
  tasksTotal: number;
  updatedAt: string;
}

export interface UnitEntity {
  id: string;
  type: EntityType;
  displayName: string;
  providerKind?: string;
  metadata?: Record<string, unknown>;
}

export interface UnitAction {
  id: string;
  type: string;
  label: string;
  requiresApproval: boolean;
  approvalScope?: ApprovalScope;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UnitTask {
  id: string;
  title: string;
  done: boolean;
  dueAt?: string;
  assigneeEntityId?: string;
  metadata?: Record<string, unknown>;
}

export interface UnitTimelineEvent {
  id: string;
  kind:
    | 'unit_created'
    | 'status_changed'
    | 'task_added'
    | 'task_completed'
    | 'provider_suggested'
    | 'provider_connected'
    | 'action_requested'
    | 'action_approved'
    | 'action_executed'
    | 'note';
  at: string;
  actorEntityId?: string;
  payload?: Record<string, unknown>;
}

export interface OverviewBlock {
  kind: 'overview';
  data: {
    goal: string;
    summary?: string;
    currentStep?: string;
  };
}

export interface TasksBlock {
  kind: 'tasks';
  data: {
    tasks: UnitTask[];
  };
}

export interface ProgressBlock {
  kind: 'progress';
  data: {
    mode: 'computed' | 'manual';
    statusLabel?: string;
    metric: UnitMetricSnapshot;
    manualPercent?: number;
  };
}

export interface PeopleBlock {
  kind: 'people';
  data: {
    entities: UnitEntity[];
    connectedProviderIds: string[];
  };
}

export interface TimelineBlock {
  kind: 'timeline';
  data: {
    events: UnitTimelineEvent[];
  };
}

export interface BudgetBlock {
  kind: 'budget';
  data: {
    estimatedTotal?: number;
    paidTotal?: number;
    currency?: 'ILS' | 'USD' | 'EUR';
    entries?: Array<{ id: string; label: string; amount: number; status: 'planned' | 'paid' }>;
  };
}

export interface ScheduleBlock {
  kind: 'schedule';
  data: {
    milestones?: Array<{ id: string; title: string; at?: string; status: 'planned' | 'done' }>;
  };
}

export interface FilesBlock {
  kind: 'files';
  data: {
    files: Array<{ id: string; name: string; url?: string; uploadedAt?: string }>;
  };
}

export interface PaymentsBlock {
  kind: 'payments';
  data: {
    transactions: Array<{
      id: string;
      amount: number;
      currency: 'ILS' | 'USD' | 'EUR';
      status: 'pending' | 'paid' | 'failed';
      at?: string;
    }>;
  };
}

export interface DomainBlock {
  kind: 'domain';
  data: {
    domainKey: string;
    payload: Record<string, unknown>;
  };
}

export type UnitBlock =
  | OverviewBlock
  | TasksBlock
  | ProgressBlock
  | PeopleBlock
  | TimelineBlock
  | BudgetBlock
  | ScheduleBlock
  | FilesBlock
  | PaymentsBlock
  | DomainBlock;

export interface UnitSpaceRef {
  id: string;
  kind: SpaceKind;
  label: string;
}

export interface UnitRecord {
  id: string;
  userId: string;
  type: UnitType;
  title: string;
  status: UnitStatus;
  primarySpace: UnitSpaceRef;
  blocks: UnitBlock[];
  actions: UnitAction[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DriverLicenseIntakeInput {
  city?: string;
  budgetLimit?: number;
  hasLearnerPermit?: boolean;
  targetTestMonth?: string;
  transmissionPreference?: 'manual' | 'automatic' | 'no_preference';
}

const DRIVER_LICENSE_TASK_TITLES = [
  'Choose license type',
  'Complete green form / medical form',
  'Complete eye test',
  'Start theory learning',
  'Pass theory test',
  'Choose driving teacher',
  'Complete driving lessons',
  'Book internal test',
  'Book practical test',
  'Complete license process',
] as const;

export function createDriverLicenseDraft(params: {
  id: string;
  userId: string;
  nowIso: string;
  spaceId: string;
  spaceLabel: string;
  intake?: DriverLicenseIntakeInput;
}): UnitRecord {
  const { id, userId, nowIso, spaceId, spaceLabel, intake } = params;

  const tasks: UnitTask[] = DRIVER_LICENSE_TASK_TITLES.map((title, index) => ({
    id: `${id}-task-${index + 1}`,
    title,
    done: false,
  }));

  return {
    id,
    userId,
    type: 'driver_license',
    title: 'Driver License',
    status: 'draft',
    primarySpace: { id: spaceId, kind: 'domain', label: spaceLabel },
    blocks: [
      {
        kind: 'overview',
        data: {
          goal: 'Get driver license',
          summary: 'Initial intake started',
          currentStep: 'Collecting user preferences and constraints',
        },
      },
      { kind: 'tasks', data: { tasks } },
      {
        kind: 'progress',
        data: {
          mode: 'computed',
          statusLabel: 'Draft',
          metric: { completionPercent: 0, tasksDone: 0, tasksTotal: tasks.length, updatedAt: nowIso },
        },
      },
      {
        kind: 'people',
        data: {
          entities: [{ id: userId, type: 'user', displayName: 'User' }],
          connectedProviderIds: [],
        },
      },
      {
        kind: 'timeline',
        data: {
          events: [
            { id: `${id}-evt-created`, kind: 'unit_created', at: nowIso, actorEntityId: userId },
            {
              id: `${id}-evt-intake`,
              kind: 'note',
              at: nowIso,
              actorEntityId: userId,
              payload: intake as Record<string, unknown> | undefined,
            },
          ],
        },
      },
    ],
    actions: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
