export const LOWEST_MEMBERSHIP_RANK = "Bronze" as const;
export type MembershipRank = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export const BAHT_PER_MEMBERSHIP_POINT = 10;

export const MEMBERSHIP_RANK_POINT_LIMITS = {
  bronze: 100,
  silver: 500,
  gold: 2_000,
  platinum: 10_000,
} as const;

export function normalizeMembershipRank(rank: string | null | undefined): string {
  const normalizedRank = rank?.trim();
  if (!normalizedRank || normalizedRank.toLocaleLowerCase("en-US") === "regular") {
    return LOWEST_MEMBERSHIP_RANK;
  }
  return normalizedRank;
}

export function earnedMembershipPoints(netTotal: number): number {
  if (!Number.isFinite(netTotal) || netTotal <= 0) return 0;
  const netTotalSatang = Math.round(netTotal * 100);
  return Math.floor(netTotalSatang / (BAHT_PER_MEMBERSHIP_POINT * 100));
}

export function membershipRankForPoints(points: number): MembershipRank {
  const wholePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  if (wholePoints <= MEMBERSHIP_RANK_POINT_LIMITS.bronze) return "Bronze";
  if (wholePoints <= MEMBERSHIP_RANK_POINT_LIMITS.silver) return "Silver";
  if (wholePoints <= MEMBERSHIP_RANK_POINT_LIMITS.gold) return "Gold";
  if (wholePoints <= MEMBERSHIP_RANK_POINT_LIMITS.platinum) return "Platinum";
  return "Diamond";
}

export function lifetimeMembershipLoyalty(totalPurchase: number) {
  const points = earnedMembershipPoints(totalPurchase);
  return {
    points,
    membershipRank: membershipRankForPoints(points),
  };
}

export function nextMembershipLoyalty(currentPoints: number, netTotal: number) {
  const safeCurrentPoints = Number.isFinite(currentPoints) ? Math.max(0, Math.floor(currentPoints)) : 0;
  const earnedPoints = earnedMembershipPoints(netTotal);
  const points = safeCurrentPoints + earnedPoints;
  return {
    earnedPoints,
    points,
    membershipRank: membershipRankForPoints(points),
  };
}
