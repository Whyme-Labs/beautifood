CREATE TABLE `custom_domains` (
	`hostname` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`records` text DEFAULT '[]' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`checked_at` integer
);
--> statement-breakpoint
CREATE INDEX `custom_domains_tenant` ON `custom_domains` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `custom_domains_status` ON `custom_domains` (`status`,`checked_at`);