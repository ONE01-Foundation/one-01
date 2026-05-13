/**
 * אגרגט אנונימי: איזה סוגי יחידות/רצונות נפתחים בעולם — לגלובל בלבד (בלי זהות משתמש).
 */
import { create } from 'zustand';

export type GlobalIntentSignal = {
  key: string;
  labelHe: string;
  labelEn: string;
  count: number;
};

type GlobalIntentSignalsState = {
  byWorld: Record<string, GlobalIntentSignal[]>;
  recordUnitIntent: (worldId: string, signalKey: string, labelHe: string, labelEn: string) => void;
};

export const useGlobalIntentSignalsStore = create<GlobalIntentSignalsState>((set) => ({
  byWorld: {},
  recordUnitIntent: (worldId, signalKey, labelHe, labelEn) => {
    set((s) => {
      const prev = s.byWorld[worldId] ?? [];
      const idx = prev.findIndex((x) => x.key === signalKey);
      let next: GlobalIntentSignal[];
      if (idx >= 0) {
        const cur = prev[idx];
        next = [...prev];
        next[idx] = { ...cur, count: cur.count + 1 };
      } else {
        next = [...prev, { key: signalKey, labelHe, labelEn, count: 1 }];
      }
      next.sort((a, b) => b.count - a.count);
      return { byWorld: { ...s.byWorld, [worldId]: next } };
    });
  },
}));
