CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`event_id` integer,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer NOT NULL,
	`response_status` integer,
	`response_body` text,
	`error` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	`delivered_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_deliveries_event` ON `webhook_deliveries` (`endpoint_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_due` ON `webhook_deliveries` (`status`,`next_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_endpoint` ON `webhook_deliveries` (`endpoint_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`url` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`events` text DEFAULT '["*"]' NOT NULL,
	`branches` text DEFAULT '["*"]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`secret_version` integer DEFAULT 1 NOT NULL,
	`from_event_id` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_endpoints_tenant` ON `webhook_endpoints` (`tenant_id`);