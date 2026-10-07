CREATE TABLE `push_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease` text,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	`last_status` integer
);
--> statement-breakpoint
CREATE INDEX `idx_push_outbox_due` ON `push_outbox` (`status`,`next_attempt`);--> statement-breakpoint
CREATE INDEX `idx_push_outbox_user_device` ON `push_outbox` (`user_id`,`subscription_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen` text NOT NULL,
	`last_test` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
ALTER TABLE `workspaces` ADD `push_commit` text;