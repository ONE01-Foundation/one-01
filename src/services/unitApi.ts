import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';
import type { UnitRecord, UnitStatus } from '../one01/unitSchema';

type UnitRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  status: UnitStatus;
  primary_space: unknown;
  blocks: unknown;
  actions: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function getClientOrThrow(): SupabaseClient {
  if (!supabaseService.getClient()) {
    supabaseService.initialize();
  }
  const client = supabaseService.getClient();
  if (!client) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return client;
}

function toRow(unit: UnitRecord): UnitRow {
  return {
    id: unit.id,
    user_id: unit.userId,
    type: unit.type,
    title: unit.title,
    status: unit.status,
    primary_space: unit.primarySpace,
    blocks: unit.blocks,
    actions: unit.actions,
    created_at: unit.createdAt,
    updated_at: unit.updatedAt,
    completed_at: unit.completedAt ?? null,
  };
}

function fromRow(row: UnitRow): UnitRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as UnitRecord['type'],
    title: row.title,
    status: row.status,
    primarySpace: row.primary_space as UnitRecord['primarySpace'],
    blocks: row.blocks as UnitRecord['blocks'],
    actions: row.actions as UnitRecord['actions'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

/**
 * Minimal v0.1 API contract (table: units)
 *
 * Expected columns:
 * id (text/uuid), user_id (text/uuid), type (text), title (text), status (text),
 * primary_space (jsonb), blocks (jsonb), actions (jsonb),
 * created_at (timestamptz), updated_at (timestamptz), completed_at (timestamptz nullable)
 */
export const unitApi = {
  async upsertUnit(unit: UnitRecord): Promise<UnitRecord> {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from('units')
      .upsert(toRow(unit))
      .select('*')
      .single<UnitRow>();

    if (error) throw error;
    return fromRow(data);
  },

  async getUnitById(unitId: string): Promise<UnitRecord | null> {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from('units')
      .select('*')
      .eq('id', unitId)
      .maybeSingle<UnitRow>();

    if (error) throw error;
    return data ? fromRow(data) : null;
  },

  async listActiveUnitsForUser(userId: string): Promise<UnitRecord[]> {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from('units')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['draft', 'active', 'waiting'])
      .order('updated_at', { ascending: false })
      .returns<UnitRow[]>();

    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async updateUnitStatus(params: { unitId: string; status: UnitStatus; nowIso: string }): Promise<UnitRecord> {
    const client = getClientOrThrow();
    const patch: Partial<UnitRow> = {
      status: params.status,
      updated_at: params.nowIso,
      completed_at: params.status === 'completed' ? params.nowIso : null,
    };
    const { data, error } = await client
      .from('units')
      .update(patch)
      .eq('id', params.unitId)
      .select('*')
      .single<UnitRow>();

    if (error) throw error;
    return fromRow(data);
  },
};
