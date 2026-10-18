DROP INDEX "section_sizes_series_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "section_sizes_series_size_uq" ON "section_sizes" USING btree ("series","size");