import { supabaseService } from '../supabaseService';
import type { ChatRequest, ChatResponse } from './types';

export async function chatCompletion(request: ChatRequest): Promise<ChatResponse> {
  const client = supabaseService.getClient();
  if (!client) throw new Error('Supabase not initialized');

  const { data, error } = await client.functions.invoke('ai-chat', {
    body: {
      messages: request.messages,
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    },
  });

  if (error) throw new Error(error.message ?? 'AI request failed');

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
