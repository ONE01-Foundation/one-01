/**
 * Agent runtime interfaces for v0.2. No network in v0.1.1.
 * Swap in SocketRuntime later.
 */

import type { OneUser, OneProcess, ProcessFields } from './types';
import { chatCompletion } from '../services/ai';
import type { ChatMessage } from '../services/ai';

export interface AgentRuntime {
  reply(input: {
    user: OneUser;
    process: OneProcess;
    text: string;
  }): Promise<{ text: string; suggestedFields?: Partial<ProcessFields> }>;
}

/** Stub: local only, no network. */
export const LocalRuntime: AgentRuntime = {
  async reply({ process, text }) {
    const suggestedFields: Partial<ProcessFields> = {};
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('next:') || lower.startsWith('todo:')) {
      const rest = text.replace(/^(next|todo)\s*:?\s*/i, '').trim();
      if (rest) suggestedFields.nextSteps = [rest];
    }
    return {
      text: 'Noted. (Agent runs locally in v0.1.1; real replies in v0.2.)',
      suggestedFields: Object.keys(suggestedFields).length > 0 ? suggestedFields : undefined,
    };
  },
};

function buildSystemPrompt(process: OneProcess): string {
  const missingSlots = process.profileSlots
    ?.filter((s) => !s.value)
    .map((s) => s.label)
    .join(', ') || 'none';

  return [
    'You are ONE, a personal operational intelligence assistant. You help the user manage real-life processes and goals.',
    '',
    `Current unit: ${process.title}`,
    process.spaceId ? `Space: ${process.spaceId}` : '',
    process.domainId ? `Domain: ${process.domainId}` : '',
    `Status: ${process.status}`,
    `Missing information: ${missingSlots}`,
    `Progress: ${process.progress ?? 0}%`,
    '',
    "Respond conversationally in the user's language. Be concise and operational. Do not make up facts. If you don't know something, say so honestly.",
  ].filter(Boolean).join('\n');
}

/** AI-assisted runtime via Supabase Edge Function. Behind dev toggle. */
export const SupabaseRuntime: AgentRuntime = {
  async reply({ process, text }) {
    const systemPrompt = buildSystemPrompt(process);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const response = await chatCompletion({ messages });

    return {
      text: response.text,
      suggestedFields: undefined,
    };
  },
};
