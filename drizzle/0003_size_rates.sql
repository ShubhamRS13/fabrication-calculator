CREATE TYPE "public"."size_rate_unit" AS ENUM('kg', 'm', 'piece');--> statement-breakpoint
CREATE TABLE "costing_size_rates" (
	"costing_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"rate" double precision,
	"unit" "size_rate_unit" DEFAULT 'kg' NOT NULL,
	CONSTRAINT "costing_size_rates_costing_id_key_pk" PRIMARY KEY("costing_id","key")
);
--> statement-breakpoint
ALTER TABLE "costing_size_rates" ADD CONSTRAINT "costing_size_rates_costing_id_costings_id_fk" FOREIGN KEY ("costing_id") REFERENCES "public"."costings"("id") ON DELETE cascade ON UPDATE no action;