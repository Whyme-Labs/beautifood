CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`cost` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ingredients_tenant` ON `ingredients` (`tenant_id`,`active`);--> statement-breakpoint
CREATE TABLE `inventory_stock` (
	`branch_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`low_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`branch_id`, `ingredient_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_lines` (
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`qty` integer NOT NULL,
	PRIMARY KEY(`item_id`, `ingredient_id`)
);
--> statement-breakpoint
CREATE INDEX `recipe_lines_ingredient` ON `recipe_lines` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`kind` text NOT NULL,
	`delta` integer NOT NULL,
	`on_hand` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`ref` text,
	`cost` integer,
	`actor` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_movements_branch` ON `stock_movements` (`branch_id`,`at`);--> statement-breakpoint
CREATE INDEX `stock_movements_ref` ON `stock_movements` (`ref`);--> statement-breakpoint
ALTER TABLE `item_availability` ADD `by_inventory` integer DEFAULT 0 NOT NULL;