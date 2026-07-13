export type MemberRecord = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  registeredAt: string;
  lastOrderAt: string;
  totalPurchase: number;
};

export type MemberSort = {
  key: "name" | "registeredAt" | "lastOrderAt";
  direction: "asc" | "desc";
};

export const dummyMembers: MemberRecord[] = [
  { id: "mem-001", name: "Suchada Wong", mobile: "081-234-5566", address: "Sukhumvit 49, Watthana, Bangkok", registeredAt: "2023-08-14", lastOrderAt: "2026-07-12T16:42:00+07:00", totalPurchase: 28450.75 },
  { id: "mem-002", name: "Kridsada Phan", mobile: "089-771-2201", address: "Thong Lo 13, Watthana, Bangkok", registeredAt: "2024-02-21", lastOrderAt: "2026-07-11T10:18:00+07:00", totalPurchase: 16280 },
  { id: "mem-003", name: "Areeya Somboon", mobile: "086-005-9981", address: "Rama IX Road, Huai Khwang, Bangkok", registeredAt: "2025-01-08", lastOrderAt: "2026-07-09T18:05:00+07:00", totalPurchase: 9340.5 },
  { id: "mem-004", name: "Natthapong Lee", mobile: "090-441-7723", address: "Silom Road, Bang Rak, Bangkok", registeredAt: "2024-11-19", lastOrderAt: "2026-07-08T13:26:00+07:00", totalPurchase: 7125.25 },
  { id: "mem-005", name: "Pimchanok Saelim", mobile: "082-636-1044", address: "On Nut 17, Suan Luang, Bangkok", registeredAt: "2023-05-02", lastOrderAt: "2026-07-06T09:44:00+07:00", totalPurchase: 22190 },
  { id: "mem-006", name: "Chayut Rattanakul", mobile: "095-218-6730", address: "Phetchaburi Road, Ratchathewi, Bangkok", registeredAt: "2025-09-27", lastOrderAt: "2026-07-03T15:12:00+07:00", totalPurchase: 4860.75 },
  { id: "mem-007", name: "Nicha Kittisak", mobile: "084-903-2258", address: "Ari 2, Phaya Thai, Bangkok", registeredAt: "2026-01-16", lastOrderAt: "2026-06-28T11:37:00+07:00", totalPurchase: 3180 },
  { id: "mem-008", name: "Warut Charoen", mobile: "088-514-9072", address: "Ladprao 71, Wang Thonglang, Bangkok", registeredAt: "2024-06-30", lastOrderAt: "2026-06-20T17:51:00+07:00", totalPurchase: 12640.5 },
  { id: "mem-009", name: "Kanokwan Meechai", mobile: "092-775-4306", address: "Charan Sanitwong, Bangkok Noi, Bangkok", registeredAt: "2025-04-11", lastOrderAt: "2026-06-14T08:56:00+07:00", totalPurchase: 5690 },
  { id: "mem-010", name: "Thana Pongsawat", mobile: "063-184-6629", address: "Bang Na-Trat Road, Bang Na, Bangkok", registeredAt: "2023-12-05", lastOrderAt: "2026-05-30T14:09:00+07:00", totalPurchase: 19875.25 },
];

export function filterMembers(members: MemberRecord[], query: string): MemberRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return members;

  return members.filter((member) =>
    [member.name, member.mobile, member.address].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}

export function sortMembers(members: MemberRecord[], sort: MemberSort): MemberRecord[] {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...members].sort((first, second) => {
    const comparison = sort.key === "name"
      ? first.name.localeCompare(second.name, "en", { sensitivity: "base" })
      : new Date(first[sort.key]).getTime() - new Date(second[sort.key]).getTime();
    return comparison * direction;
  });
}

export function nextMemberSort(current: MemberSort, key: MemberSort["key"]): MemberSort {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "name" ? "asc" : "desc" };
}
