export type VoteTotals = { up: number; down: number };

export const totalVotes = (totals?: VoteTotals) => (totals?.up ?? 0) + (totals?.down ?? 0);

export function compareVotes(a: VoteTotals | undefined, b: VoteTotals | undefined): number {
  return totalVotes(b) - totalVotes(a) || (b?.up ?? 0) - (a?.up ?? 0);
}
