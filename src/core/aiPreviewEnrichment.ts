import type { ChatMessage } from '../services/ai/types';
import type { SpaceId, DomainId } from './spaces';

export interface AiPreviewEnrichment {
  description: string;
  suggestedSteps: string[];
  clarifyingQuestions: string[];
  risksOrBlockers: string[];
  realWorldNotes: string;
}

export function buildPreviewEnrichmentPrompt(
  goalText: string,
  spaceId: SpaceId,
  domainId: DomainId | undefined,
  language: 'he' | 'en',
): ChatMessage[] {
  const lang = language === 'he' ? 'Hebrew' : 'English';
  return [
    {
      role: 'system',
      content: [
        'You are ONE, an operational intelligence assistant.',
        'The user wants to create a unit for a real-life goal.',
        'Analyze this goal and respond with EXACTLY this JSON structure:',
        '{',
        '  "description": "1-sentence operational description",',
        '  "suggestedSteps": ["step1", "step2", ...],',
        '  "clarifyingQuestions": ["q1", "q2"],',
        '  "risksOrBlockers": ["risk1"],',
        '  "realWorldNotes": "timeframe, costs, common considerations"',
        '}',
        '',
        'Rules:',
        '- suggestedSteps: 3-6 practical steps',
        '- clarifyingQuestions: 1-2 questions to better understand the goal',
        '- risksOrBlockers: 1-2 common obstacles',
        '- realWorldNotes: practical real-world context',
        `- Respond in ${lang}`,
        '- Be practical and grounded',
        '- Do not invent specific numbers unless commonly known',
        '- If uncertain about something, say so honestly',
        '- Return ONLY valid JSON, no markdown fences, no extra text',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Goal: "${goalText}"`,
        `Space: ${spaceId}`,
        domainId ? `Domain: ${domainId}` : '',
      ].filter(Boolean).join('\n'),
    },
  ];
}

export function parseAiEnrichmentResponse(raw: string): AiPreviewEnrichment | null {
  console.log('[AI-PARSE] attempting to parse:', raw?.slice(0, 200));
  try {
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.description === 'string' &&
      Array.isArray(parsed.suggestedSteps) &&
      Array.isArray(parsed.clarifyingQuestions) &&
      Array.isArray(parsed.risksOrBlockers) &&
      typeof parsed.realWorldNotes === 'string'
    ) {
      return {
        description: parsed.description,
        suggestedSteps: parsed.suggestedSteps.map(String),
        clarifyingQuestions: parsed.clarifyingQuestions.map(String),
        risksOrBlockers: parsed.risksOrBlockers.map(String),
        realWorldNotes: parsed.realWorldNotes,
      };
    }
    console.warn('[AI-PARSE] schema mismatch — keys:', Object.keys(parsed));
    return null;
  } catch (e) {
    console.error('[AI-PARSE] JSON.parse failed:', (e as Error).message);
    return null;
  }
}
