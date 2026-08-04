UPDATE "Customer"
SET
  "membershipRank" = 'Bronze',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "isMember" = true
  AND (
    "membershipRank" IS NULL
    OR BTRIM("membershipRank") = ''
    OR LOWER(BTRIM("membershipRank")) = 'regular'
  );
