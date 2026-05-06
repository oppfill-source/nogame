import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

type BankrollStore = {
  balance: number;
  kellyFraction: number; // 0.25 = quarter Kelly (recommended for beginners)
  currency: "USD";
  setBalance: (balance: number) => void;
  setKellyFraction: (fraction: number) => void;
  adjustBalance: (delta: number) => void;
};

export const useBankrollStore = create<BankrollStore>((set, get) => ({
  balance: 1000,
  kellyFraction: 0.25,
  currency: "USD",
  setBalance: (balance) => {
    set({ balance });
    AsyncStorage.setItem("bankroll_balance", String(balance));
  },
  setKellyFraction: (kellyFraction) => {
    set({ kellyFraction });
    AsyncStorage.setItem("bankroll_kelly", String(kellyFraction));
  },
  adjustBalance: (delta) => {
    const newBalance = Math.max(0, get().balance + delta);
    set({ balance: newBalance });
    AsyncStorage.setItem("bankroll_balance", String(newBalance));
  },
}));

// Rehydrate from AsyncStorage on import
AsyncStorage.multiGet(["bankroll_balance", "bankroll_kelly"]).then((results) => {
  const [balance, kelly] = results;
  const updates: Partial<BankrollStore> = {};
  if (balance[1]) updates.balance = parseFloat(balance[1]);
  if (kelly[1]) updates.kellyFraction = parseFloat(kelly[1]);
  if (Object.keys(updates).length > 0) useBankrollStore.setState(updates);
});
