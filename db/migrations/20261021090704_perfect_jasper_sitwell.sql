CREATE TABLE `assistant_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`lang` text NOT NULL,
	`question` text NOT NULL,
	`intent` text NOT NULL,
	`confidence` integer NOT NULL,
	`confident` integer NOT NULL,
	`engine` text NOT NULL,
	`shown` text DEFAULT '[]' NOT NULL,
	`added` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_turns_branch` ON `assistant_turns` (`branch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `assistant_turns_created` ON `assistant_turns` (`created_at`);--> statement-breakpoint
CREATE TABLE `concept_orders` (
	`concept` text PRIMARY KEY NOT NULL,
	`orders` integer NOT NULL,
	`tenants` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concept_pairs` (
	`a` text NOT NULL,
	`b` text NOT NULL,
	`orders` integer NOT NULL,
	`tenants` integer NOT NULL,
	PRIMARY KEY(`a`, `b`)
);
