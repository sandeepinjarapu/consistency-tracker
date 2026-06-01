export type SummaryInvite = {
  inviter_id: string;
  accepted_by: string | null;
};

export type SummaryPair = {
  viewerId: string; // recipient of the summary
  ownerId: string; // whose progress the summary is about
};

/**
 * Build the (viewer, owner) pairs for the weekly partner summary from accepted
 * partner invites. Each accepted partnership produces both directions so each
 * partner receives a summary of the other.
 *
 * Pairs are de-duplicated by (viewer, owner): a partnership that was invited
 * and accepted more than once (duplicate `partner_invites` rows) must still
 * yield a single email per direction, not one per row.
 */
export function partnerSummaryPairs(invites: SummaryInvite[]): SummaryPair[] {
  const seen = new Set<string>();
  const pairs: SummaryPair[] = [];

  const add = (viewerId: string, ownerId: string) => {
    const key = `${viewerId}|${ownerId}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ viewerId, ownerId });
  };

  for (const inv of invites) {
    if (!inv.accepted_by) continue;
    add(inv.accepted_by, inv.inviter_id);
    add(inv.inviter_id, inv.accepted_by);
  }

  return pairs;
}
