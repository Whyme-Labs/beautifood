CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`entity` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`required` integer DEFAULT 0 NOT NULL,
	`public` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_fields_key` ON `custom_fields` (`tenant_id`,`entity`,`key`);--> statement-breakpoint
CREATE INDEX `custom_fields_tenant` ON `custom_fields` (`tenant_id`,`entity`,`sort`);--> statement-breakpoint
CREATE TABLE `custom_values` (
	`tenant_id` text NOT NULL,
	`entity` text NOT NULL,
	`record_id` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`tenant_id`, `entity`, `record_id`)
);
