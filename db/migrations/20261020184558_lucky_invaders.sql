CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `tenant_id`, `branch_id`, `kind`)
);
--> statement-breakpoint
CREATE INDEX `ai_usage_day` ON `ai_usage` (`day`);