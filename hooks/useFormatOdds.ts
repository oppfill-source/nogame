import { useUIStore } from "../stores/ui";
import { formatOddsAs } from "../lib/odds-utils";

// Returns a formatOdds function bound to the user's current odds format preference.
// Drop-in replacement for the raw formatOdds import — same signature, format-aware.
export function useFormatOdds(): (odds: number) => string {
  const oddsFormat = useUIStore((s) => s.oddsFormat);
  return (odds: number) => formatOddsAs(odds, oddsFormat);
}
