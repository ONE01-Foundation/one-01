/**
 * Connection Store - Manages real-time connection status
 */

import { create } from 'zustand';
import { ConnectionStatus } from '../types';

interface ConnectionStore {
  status: ConnectionStatus;
  socketId: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setSocketId: (socketId: string | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastConnected: (date: Date | null) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  socketId: null,
  reconnectAttempts: 0,
  lastConnected: null,

  setStatus: (status) => set({ status }),

  setSocketId: (socketId) => set({ socketId }),

  incrementReconnectAttempts: () =>
    set((state) => ({
      reconnectAttempts: state.reconnectAttempts + 1,
    })),

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

  setLastConnected: (date) => set({ lastConnected: date }),
}));

