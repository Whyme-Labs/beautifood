CREATE TABLE `price_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`translations` text DEFAULT '{}' NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`windows` text DEFAULT '[]' NOT NULL,
	`branches` text DEFAULT '["*"]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `price_rules_tenant` ON `price_rules` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `timed_menus` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`translations` text DEFAULT '{}' NOT NULL,
	`windows` text DEFAULT '[]' NOT NULL,
	`branches` text DEFAULT '["*"]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timed_menus_tenant` ON `timed_menus` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `menu_items` ADD `menu_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `list_price` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `deal` text;