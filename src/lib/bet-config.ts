// Single source of truth for the betting economy. Tweak here.

export const STARTING_BALANCE = 100;
export const MAX_STAKE_PCT = 0.25; // of current balance
export const WEEKLY_STIPEND = 25;
export const STIPEND_THRESHOLD = 25; // top up only if balance is below this

export type Selection = "home" | "draw" | "away";

export function maxStakeFor(balance: number): number {
  return Math.max(0, Math.floor(balance * MAX_STAKE_PCT));
}

export function potentialPayout(stake: number, decimalOdds: number): number {
  return Math.round(stake * decimalOdds);
}

export function potentialProfit(stake: number, decimalOdds: number): number {
  return potentialPayout(stake, decimalOdds) - stake;
}
