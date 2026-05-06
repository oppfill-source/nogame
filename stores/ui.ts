import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SPORT } from "../constants/sports";
import type { OddsFormat } from "../lib/odds-utils";

export const ODDS_FORMAT_KEY = "odds_format_v1";
export const ONBOARDING_COMPLETE_KEY = "onboarding_v1_complete";

export type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

type UIStore = {
  selectedSport: string;
  viewedAiPickIds: Set<string>;
  toasts: Toast[];
  oddsFormat: OddsFormat;
  setSelectedSport: (sport: string) => void;
  markAiPickViewed: (id: string) => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  setOddsFormat: (format: OddsFormat) => void;
  loadOddsFormat: () => Promise<void>;
};

export const useUIStore = create<UIStore>((set, get) => ({
  selectedSport: DEFAULT_SPORT,
  viewedAiPickIds: new Set(),
  toasts: [],
  oddsFormat: "american",
  setSelectedSport: (selectedSport) => set({ selectedSport }),
  markAiPickViewed: (id) => {
    const newSet = new Set(get().viewedAiPickIds);
    newSet.add(id);
    set({ viewedAiPickIds: newSet });
  },
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setOddsFormat: (oddsFormat) => {
    set({ oddsFormat });
    AsyncStorage.setItem(ODDS_FORMAT_KEY, oddsFormat);
  },
  loadOddsFormat: async () => {
    const stored = await AsyncStorage.getItem(ODDS_FORMAT_KEY);
    if (stored === "american" || stored === "decimal") {
      set({ oddsFormat: stored });
    }
  },
}));
