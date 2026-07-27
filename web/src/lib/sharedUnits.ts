import { getSupabase } from "./supabase";

// A unit two or more people share and correspond inside. Backed by the
// shared_units / shared_unit_members / shared_unit_messages tables via anon
// SECURITY DEFINER RPCs (see supabase/migrations/20260728_shared_units.sql).

export interface SharedUnit {
  id: string;
  code: string;
  title: string;
  emoji: string;
  type: string | null;
  unit: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface SharedMessage {
  id: string;
  unit_id: string;
  author: string;
  role: "human" | "one";
  text: string;
  created_at: string;
}
export interface SharedMember {
  id: string;
  unit_id: string;
  name: string;
  created_at: string;
}

/** Create a shared unit from a snapshot; returns the row (with its code). */
export async function createSharedUnit(input: {
  title: string;
  emoji?: string;
  type?: string | null;
  unit?: unknown;
  author?: string;
}): Promise<SharedUnit | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("create_shared_unit", {
      p_title: input.title,
      p_emoji: input.emoji ?? "",
      p_type: input.type ?? null,
      p_unit: input.unit ?? {},
      p_author: input.author ?? "",
    });
    if (error) return null;
    return (data as SharedUnit) ?? null;
  } catch {
    return null;
  }
}

/** Join a shared unit by code (adds you as a member); null if the code is unknown. */
export async function joinSharedUnit(code: string, name: string): Promise<SharedUnit | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("join_shared_unit", {
      p_code: code.trim(),
      p_name: name ?? "",
    });
    if (error) return null;
    return (data as SharedUnit) ?? null;
  } catch {
    return null;
  }
}

/** Poll the common thread — messages newer than `since` (ISO string, or null for all). */
export async function getSharedMessages(
  code: string,
  since?: string | null,
): Promise<SharedMessage[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client.rpc("get_shared_messages", {
      p_code: code.trim(),
      p_since: since ?? null,
    });
    if (error) return [];
    return (data as SharedMessage[]) ?? [];
  } catch {
    return [];
  }
}

/** Post a message into the common thread. */
export async function postSharedMessage(
  code: string,
  author: string,
  role: "human" | "one",
  text: string,
): Promise<SharedMessage | null> {
  const client = getSupabase();
  if (!client) return null;
  const body = text.trim();
  if (!body) return null;
  try {
    const { data, error } = await client.rpc("post_shared_message", {
      p_code: code.trim(),
      p_author: author || "Someone",
      p_role: role,
      p_text: body,
    });
    if (error) return null;
    return (data as SharedMessage) ?? null;
  } catch {
    return null;
  }
}

/** Who's in the room. */
export async function listSharedMembers(code: string): Promise<SharedMember[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client.rpc("list_shared_members", { p_code: code.trim() });
    if (error) return [];
    return (data as SharedMember[]) ?? [];
  } catch {
    return [];
  }
}
