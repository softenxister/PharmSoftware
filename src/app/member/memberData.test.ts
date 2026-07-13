import assert from "node:assert/strict";
import test from "node:test";
import { filterMembers, nextMemberSort, sortMembers, type MemberRecord } from "./memberData";

const members: MemberRecord[] = [
  {
    id: "m-1",
    name: "Anong Srisuk",
    mobile: "081-111-1111",
    address: "Sukhumvit Bangkok",
    registeredAt: "2025-02-01",
    lastOrderAt: "2026-06-10T09:00:00+07:00",
    totalPurchase: 2400,
  },
  {
    id: "m-2",
    name: "Benja Arun",
    mobile: "089-222-2222",
    address: "Silom Bangkok",
    registeredAt: "2026-01-12",
    lastOrderAt: "2026-07-09T11:30:00+07:00",
    totalPurchase: 980,
  },
];

test("members default to newest last order first", () => {
  assert.deepEqual(
    sortMembers(members, { key: "lastOrderAt", direction: "desc" }).map((member) => member.id),
    ["m-2", "m-1"],
  );
});

test("member search includes hidden address data", () => {
  assert.deepEqual(filterMembers(members, "Silom").map((member) => member.id), ["m-2"]);
  assert.deepEqual(filterMembers(members, "Anong").map((member) => member.id), ["m-1"]);
  assert.deepEqual(filterMembers(members, "089-222").map((member) => member.id), ["m-2"]);
});

test("customer names sort in both directions", () => {
  assert.deepEqual(
    sortMembers(members, { key: "name", direction: "asc" }).map((member) => member.name),
    ["Anong Srisuk", "Benja Arun"],
  );
  assert.deepEqual(
    sortMembers(members, { key: "name", direction: "desc" }).map((member) => member.name),
    ["Benja Arun", "Anong Srisuk"],
  );
});

test("sortable headings toggle direction and dates start newest first", () => {
  assert.deepEqual(
    nextMemberSort({ key: "lastOrderAt", direction: "desc" }, "lastOrderAt"),
    { key: "lastOrderAt", direction: "asc" },
  );
  assert.deepEqual(
    nextMemberSort({ key: "name", direction: "asc" }, "registeredAt"),
    { key: "registeredAt", direction: "desc" },
  );
});
