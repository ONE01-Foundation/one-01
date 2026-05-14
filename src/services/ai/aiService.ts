import { supabaseService } from '../supabaseService';
import type { ChatRequest, ChatResponse } from './types';

export async function chatCompletion(request: ChatRequest): Promise<ChatResponse> {
  const client = supabaseService.getClient();
  console.log('[AI-SERVICE] invoking ai-chat, client exists:', !!client);
  if (!client) throw new Error('Supabase not initialized');

  const { data, error } = await client.functions.invoke('ai-chat', {
    body: {
      messages: request.messages,
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    },
  });

  console.log('[AI-SERVICE] invoke result — data:', JSON.stringify(data)?.slice(0, 300), 'error:', error);

  if (error) {
    let detail = error.message ?? 'AI request failed';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        detail = body?.error ?? detail;
      } else if (ctx && typeof ctx.text === 'function') {
        detail = await ctx.text();
      }
    } catch {
      // context extraction failed — use original message
    }
    console.error('[AI-SERVICE] error detail:', detail);
    throw new Error(detail);
  }

  if (!data || typeof data.text !== 'string') {
    console.error('[AI-SERVICE] unexpected data shape:', data);
    throw new Error('AI response missing text field');
  }

  return {
    text: data.text,
    model: data.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}
