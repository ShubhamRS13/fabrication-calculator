CREATE TYPE "public"."price_group" AS ENUM('plate', 'size', 'bought', 'jobwork');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('kg', 'm', 'piece', 'set');--> statement-breakpoint
CREATE TABLE "bought_kinds" (
	"name" text PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"unit" "price_unit" DEFAULT 'piece' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costing_prices" (
	"costing_id" uuid NOT NULL,
	"key" text NOT NULL,
	"group" "price_group" NOT NULL,
	"material" text NOT NULL,
	"label" text NOT NULL,
	"rate" double precision,
	"unit" "price_unit" NOT NULL,
	CONSTRAINT "costing_prices_costing_id_key_pk" PRIMARY KEY("costing_id","key")
);
--> statement-breakpoint
ALTER TABLE "costing_prices" ADD CONSTRAINT "costing_prices_costing_id_costings_id_fk" FOREIGN KEY ("costing_id") REFERENCES "public"."costings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "costing_prices_key_idx" ON "costing_prices" USING btree ("key");