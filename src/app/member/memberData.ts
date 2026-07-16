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
