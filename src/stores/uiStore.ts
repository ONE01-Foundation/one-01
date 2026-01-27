/**
 * UI Store - Manages dynamic UI components and state
 */

import { create } from 'zustand';
import { UIComponent, UIState } from '../types';

interface UIStore {
  components: UIComponent[];
  activeProtocol: string | undefined;
  isLoading: boolean;
  error: string | undefined;

  // Actions
  addComponent: (component: UIComponent) => void;
  updateComponent: (componentId: string, updates: Partial<UIComponent>) => void;
  removeComponent: (componentId: string) => void;
  clearComponents: () => void;
  setActiveProtocol: (protocolId: string | undefined) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  batchUpdateComponents: (components: UIComponent[]) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  components: [],
  activeProtocol: undefined,
  isLoading: false,
  error: undefined,

  addComponent: (component) =>
    set((state) => ({
      components: [...state.components, component],
    })),

  updateComponent: (componentId, updates) =>
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === componentId ? { ...comp, ...updates } : comp
      ),
    })),

  removeComponent: (componentId) =>
    set((state) => ({
      components: state.components.filter((comp) => comp.id !== componentId),
    })),

  clearComponents: () => set({ components: [] }),

  setActiveProtocol: (protocolId) => set({ activeProtocol: protocolId }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  batchUpdateComponents: (components) => set({ components }),
}));

