UPDATE "Customer"
SET
  points = 0,
  "membershipRank" = 'Bronze',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "isMember" = true;
