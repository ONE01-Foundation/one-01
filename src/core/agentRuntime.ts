/**
 * Agent runtime interfaces for v0.2. No network in v0.1.1.
 * Swap in SocketRuntime later.
 */

import type { OneUser, OneProcess, ProcessFields } from './types';

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
