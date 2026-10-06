export type VoteTotals = { up: number; down: number };

export const totalVotes = (totals?: VoteTotals) => (totals?.up ?? 0) + (totals?.down ?? 0);

export function compareVotes(a: VoteTotals | undefined, b: VoteTotals | undefined): number {
  return totalVotes(b) - totalVotes(a) || (b?.up ?? 0) - (a?.up ?? 0);
}

/**
 * The most-voted entries, highest first, cut to `limit`.
 *
 * One ranking rule for the whole site: `compareVotes` decides it, so a list
 * built from this can never disagree with the strips or with the `top` array
 * `/stats` prints. Entries still level on votes fall back to their name, which
 * is what keeps the order stable and repeatable instead of flapping between
 * renders — and what makes an all-zero board read as the directory's own order
 * rather than a random one. Nothing here invents a score: an entry with no
 * totals sorts on zeros like any other.
 */
export function rankByVotes<T extends { name: string; voteKey: string }>(
  items: readonly T[],
  totals: Record<string, VoteTotals>,
  limit: number,
): T[] {
  return [...items]
    .sort((a, b) => compareVotes(totals[a.voteKey], totals[b.voteKey]) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
