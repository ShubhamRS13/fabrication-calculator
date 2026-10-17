ALTER TABLE "items" ADD COLUMN "item_no" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Number existing items 1, 2, 3… in the order they were added, separately for
-- loose drawing items and for each assembly (PARTITION BY treats NULL as one group).
UPDATE "items" SET "item_no" = n."rn"::text
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "drawing_id", "assembly_id" ORDER BY "sort_order", "created_at") AS "rn"
  FROM "items"
) AS n
WHERE "items"."id" = n."id";
