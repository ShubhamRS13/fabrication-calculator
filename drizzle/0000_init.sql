CREATE TYPE "public"."charge_basis" AS ENUM('process', 'finish');--> statement-breakpoint
CREATE TYPE "public"."material_family" AS ENUM('SS', 'MS', 'OTHER');--> statement-breakpoint
CREATE TABLE "assemblies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drawing_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" double precision DEFAULT 1 NOT NULL,
	"material" text,
	"burning_pct" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"costing_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rate" double precision,
	"basis" charge_basis NOT NULL,
	"applies_to" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costing_material_rates" (
	"costing_id" uuid NOT NULL,
	"material" text NOT NULL,
	"rate" double precision,
	"scrap_rate" double precision,
	CONSTRAINT "costing_material_rates_costing_id_material_pk" PRIMARY KEY("costing_id","material")
);
--> statement-breakpoint
CREATE TABLE "costings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"project_name" text NOT NULL,
	"po_no" text DEFAULT '' NOT NULL,
	"drawing_ref" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"costing_date" date DEFAULT CURRENT_DATE NOT NULL,
	"default_material" text NOT NULL,
	"burning_pct" double precision DEFAULT 3 NOT NULL,
	"profit_pct" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_shapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"finish_formula" text NOT NULL,
	"process_formula" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"costing_id" uuid NOT NULL,
	"drawing_no" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"material" text,
	"burning_pct" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drawing_id" uuid NOT NULL,
	"assembly_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"dwg_sheet" text DEFAULT '' NOT NULL,
	"qty" double precision DEFAULT 1 NOT NULL,
	"material" text,
	"burning_pct" double precision,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"code" text PRIMARY KEY NOT NULL,
	"density" double precision NOT NULL,
	"family" "material_family" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series" text NOT NULL,
	"size" text NOT NULL,
	"data" jsonb NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"logo_path" text DEFAULT '/brand/logo-with-name.png' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_drawing_id_drawings_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_lines" ADD CONSTRAINT "charge_lines_costing_id_costings_id_fk" FOREIGN KEY ("costing_id") REFERENCES "public"."costings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_material_rates" ADD CONSTRAINT "costing_material_rates_costing_id_costings_id_fk" FOREIGN KEY ("costing_id") REFERENCES "public"."costings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_costing_id_costings_id_fk" FOREIGN KEY ("costing_id") REFERENCES "public"."costings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_drawing_id_drawings_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assemblies_drawing_idx" ON "assemblies" USING btree ("drawing_id");--> statement-breakpoint
CREATE INDEX "charge_lines_costing_idx" ON "charge_lines" USING btree ("costing_id");--> statement-breakpoint
CREATE INDEX "costings_updated_idx" ON "costings" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "drawings_costing_idx" ON "drawings" USING btree ("costing_id");--> statement-breakpoint
CREATE INDEX "items_drawing_idx" ON "items" USING btree ("drawing_id");--> statement-breakpoint
CREATE INDEX "items_assembly_idx" ON "items" USING btree ("assembly_id");--> statement-breakpoint
CREATE INDEX "section_sizes_series_idx" ON "section_sizes" USING btree ("series","size");