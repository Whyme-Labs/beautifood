CREATE TABLE `storefronts` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`updated_at` integer NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`published_at` integer
);
