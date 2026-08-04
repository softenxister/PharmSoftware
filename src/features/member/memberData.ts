import { normalizeMembershipRank } from "@/lib/membershipRank";

export type MemberRecord = {
  id: string;
  name: string;
  mobile: string;
  avatarUrl?: string | null;
  isMember: true;
  registeredAt: string;
  lastOrderAt: string | null;
  totalPurchase: number;
  points: number;
  membershipRank: string;
  topItemIds: string[];
  allergies: Array<{
    id: string;
    canonicalName: string;
    thaiName?: string;
  }>;
};

export type MemberSort = {
  key: "name" | "registeredAt" | "lastOrderAt";
  direction: "asc" | "desc";
};

export type MemberRankTone = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type MemberRankIcon = "bronze" | "medal" | "crown" | "platinum" | "diamond";

const memberRankIcons: Record<MemberRankTone, MemberRankIcon> = {
  bronze: "bronze",
  silver: "medal",
  gold: "crown",
  platinum: "platinum",
  diamond: "diamond",
};

export function memberRankTone(rank: string): MemberRankTone {
  const normalizedRank = normalizeMembershipRank(rank).toLocaleLowerCase("en-US");
  if (normalizedRank === "silver") return "silver";
  if (normalizedRank === "gold") return "gold";
  if (normalizedRank === "platinum") return "platinum";
  if (normalizedRank === "diamond") return "diamond";
  return "bronze";
}

export function memberRankVisual(rank: string): { tone: MemberRankTone; icon: MemberRankIcon } {
  const tone = memberRankTone(rank);
  return { tone, icon: memberRankIcons[tone] };
}

export function filterMembers(members: MemberRecord[], query: string): MemberRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return members;

  return members.filter((member) =>
    [member.name, member.mobile, member.membershipRank].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}

export function sortMembers(members: MemberRecord[], sort: MemberSort): MemberRecord[] {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...members].sort((first, second) => {
    if (sort.key !== "name") {
      const firstValue = first[sort.key];
      const secondValue = second[sort.key];
      if (!firstValue && !secondValue) return 0;
      if (!firstValue) return 1;
      if (!secondValue) return -1;
    }
    const comparison = sort.key === "name"
      ? first.name.localeCompare(second.name, "en", { sensitivity: "base" })
      : new Date(first[sort.key] as string).getTime() - new Date(second[sort.key] as string).getTime();
    return comparison * direction;
  });
}

export function nextMemberSort(current: MemberSort, key: MemberSort["key"]): MemberSort {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "name" ? "asc" : "desc" };
}
