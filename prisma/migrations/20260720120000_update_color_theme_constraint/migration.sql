ALTER TABLE "PharmAccountPreference"
DROP CONSTRAINT IF EXISTS "PharmAccountPreference_colorTheme_check";

UPDATE "PharmAccountPreference"
SET "colorTheme" = 'pharmacy-green'
WHERE "colorTheme" NOT IN ('pharmacy-green', 'pink', 'orange', 'purple');

ALTER TABLE "PharmAccountPreference"
ADD CONSTRAINT "PharmAccountPreference_colorTheme_check"
CHECK ("colorTheme" IN ('pharmacy-green', 'pink', 'orange', 'purple'));
