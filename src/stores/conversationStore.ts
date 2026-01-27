/**
 * Conversation Store - Manages conversation messages and history
 */

import { create } from 'zustand';
import { ConversationMessage, MessageType } from '../types';

interface ConversationStore {
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addMessage: (message: ConversationMessage) => void;
  addMessages: (messages: ConversationMessage[]) => void;
  updateMessage: (messageId: string, updates: Partial<ConversationMessage>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  addMessages: (messages) =>
    set((state) => ({
      messages: [...state.messages, ...messages],
    })),

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      ),
    })),

  clearMessages: () => set({ messages: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

