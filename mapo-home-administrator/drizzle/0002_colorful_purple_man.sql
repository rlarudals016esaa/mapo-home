CREATE TABLE `catalog_exports` (
	`sequence` integer PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_exports_version_unique` ON `catalog_exports` (`version`);--> statement-breakpoint
CREATE TABLE `integration_nonces` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_status` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
