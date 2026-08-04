import assert from "node:assert/strict";
import test from "node:test";
import {
  earnedMembershipPoints,
  lifetimeMembershipLoyalty,
  LOWEST_MEMBERSHIP_RANK,
  membershipRankForPoints,
  nextMembershipLoyalty,
  normalizeMembershipRank,
} from "./membershipRank";

test("Bronze is the lowest membership rank", () => {
  assert.equal(LOWEST_MEMBERSHIP_RANK, "Bronze");
  assert.equal(normalizeMembershipRank(null), "Bronze");
  assert.equal(normalizeMembershipRank("  "), "Bronze");
});

test("legacy Regular ranks are presented as Bronze", () => {
  assert.equal(normalizeMembershipRank("Regular"), "Bronze");
  assert.equal(normalizeMembershipRank(" regular "), "Bronze");
  assert.equal(normalizeMembershipRank("Silver"), "Silver");
});

test("paid purchase value earns one whole point for every ten baht", () => {
  assert.equal(earnedMembershipPoints(9.99), 0);
  assert.equal(earnedMembershipPoints(10), 1);
  assert.equal(earnedMembershipPoints(99.99), 9);
  assert.equal(earnedMembershipPoints(100), 10);
  assert.equal(earnedMembershipPoints(Number.NaN), 0);
});

test("membership ranks follow the inclusive point boundaries", () => {
  assert.deepEqual(
    [0, 100, 101, 500, 501, 2_000, 2_001, 10_000, 10_001].map(membershipRankForPoints),
    ["Bronze", "Bronze", "Silver", "Silver", "Gold", "Gold", "Platinum", "Platinum", "Diamond"],
  );
});

test("a paid purchase adds points before recalculating rank", () => {
  assert.deepEqual(nextMembershipLoyalty(99, 20), {
    earnedPoints: 2,
    points: 101,
    membershipRank: "Silver",
  });
});

test("lifetime purchase value replaces points and recalculates rank", () => {
  assert.deepEqual(lifetimeMembershipLoyalty(1_009.99), {
    points: 100,
    membershipRank: "Bronze",
  });
  assert.deepEqual(lifetimeMembershipLoyalty(1_010), {
    points: 101,
    membershipRank: "Silver",
  });
  assert.deepEqual(lifetimeMembershipLoyalty(100_010), {
    points: 10_001,
    membershipRank: "Diamond",
  });
});

test("invalid lifetime purchase values reset loyalty to Bronze with zero points", () => {
  assert.deepEqual(lifetimeMembershipLoyalty(Number.NaN), {
    points: 0,
    membershipRank: "Bronze",
  });
  assert.deepEqual(lifetimeMembershipLoyalty(-10), {
    points: 0,
    membershipRank: "Bronze",
  });
});
