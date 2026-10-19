CREATE TABLE `receipt_settings` (
	`tenant_id` text NOT NULL,
	`branch_id` text DEFAULT '' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tenant_id`, `branch_id`)
);
