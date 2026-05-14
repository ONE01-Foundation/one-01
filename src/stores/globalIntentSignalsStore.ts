/**
 * אגרגט אנונימי: איזה סוגי יחידות/רצונות נפתחים במרחב — לגלובל בלבד (בלי זהות משתמש).
 */
import { create } from 'zustand';

export type GlobalIntentSignal = {
  key: string;
  labelHe: string;
  labelEn: string;
  count: number;
};

type GlobalIntentSignalsState = {
  bySpace: Record<string, GlobalIntentSignal[]>;
  recordUnitIntent: (spaceId: string, signalKey: string, labelHe: string, labelEn: string) => void;
};

export const useGlobalIntentSignalsStore = create<GlobalIntentSignalsState>((set) => ({
  bySpace: {},
  recordUnitIntent: (spaceId, signalKey, labelHe, labelEn) => {
    set((s) => {
      const prev = s.bySpace[spaceId] ?? [];
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
      return { bySpace: { ...s.bySpace, [spaceId]: next } };
    });
  },
}));
