INSERT INTO "Customer" (
  "id", "name", "mobile", "isMember", "points", "membershipRank", "createdAt", "updatedAt"
) VALUES
  ('c1', 'Suchada Wong', '081-234-5566', true, 4280, 'Platinum', '2023-08-13T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c2', 'Kridsada Phan', '089-771-2201', true, 2150, 'Gold', '2024-02-20T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c3', 'Areeya Somboon', '086-005-9981', true, 980, 'Silver', '2025-01-07T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c4', 'Natthapong Lee', '090-441-7723', true, 310, 'Regular', '2024-11-18T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c5', 'Pimchanok Saelim', '082-636-1044', true, 0, 'Regular', '2023-05-01T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c6', 'Chayut Rattanakul', '095-218-6730', true, 0, 'Regular', '2025-09-26T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c7', 'Nicha Kittisak', '084-903-2258', true, 0, 'Regular', '2026-01-15T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c8', 'Warut Charoen', '088-514-9072', true, 0, 'Regular', '2024-06-29T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c9', 'Kanokwan Meechai', '092-775-4306', true, 0, 'Regular', '2025-04-10T17:00:00.000Z', CURRENT_TIMESTAMP),
  ('c10', 'Thana Pongsawat', '063-184-6629', true, 0, 'Regular', '2023-12-04T17:00:00.000Z', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "mobile" = EXCLUDED."mobile",
  "isMember" = true,
  "points" = EXCLUDED."points",
  "membershipRank" = EXCLUDED."membershipRank",
  "updatedAt" = CURRENT_TIMESTAMP;
