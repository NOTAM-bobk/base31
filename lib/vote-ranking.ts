export type VoteTotals = { up: number; down: number; fires?: number };

/**
 * What one fire is worth in the ranking.
 *
 * A fire is not a third kind of vote — it is a short-lived boost. Every fire
 * still counting on an entry adds ten votes here, so a single fire lifts a site
 * past nine ordinary thumbs without inventing a second scoreboard: the one
 * comparison the whole site shares (`compareVotes`) is still the only thing
 * that decides an order, and `/explore`, the Top 10, the strips and the `top`
 * array `/stats` prints all read this same number.
 *
 * The Worker owns the clock. It stores the timestamp of every fire and drops
 * the ones older than a day as it reads them, so `fires` is always the count
 * still in force and nothing outside the Worker has to expire anything.
 */
export const FIRE_VOTE_WEIGHT = 10;

export const totalVotes = (totals?: VoteTotals) =>
  (totals?.up ?? 0) + (totals?.down ?? 0) + FIRE_VOTE_WEIGHT * (totals?.fires ?? 0);

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
