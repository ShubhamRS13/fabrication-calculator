-- Size rates move into costing_prices. Old key "MATERIAL|label" becomes "size|MATERIAL|label".
INSERT INTO "costing_prices" ("costing_id", "key", "group", "material", "label", "rate", "unit")
SELECT "costing_id", 'size|' || "key", 'size', split_part("key", '|', 1), "label", "rate", "unit"::text::"price_unit"
FROM "costing_size_rates"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP TABLE "costing_size_rates" CASCADE;--> statement-breakpoint
DROP TYPE "public"."size_rate_unit";