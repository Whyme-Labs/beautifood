ALTER TABLE `menu_categories` ADD `translations` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `translations` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `menu_language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `translations` text DEFAULT '{}' NOT NULL;