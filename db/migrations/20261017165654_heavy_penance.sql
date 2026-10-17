ALTER TABLE `emails` ADD `headers` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `from_name` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `message_id` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `last_attempt_at` integer;--> statement-breakpoint
CREATE INDEX `emails_retry` ON `emails` (`status`,`last_attempt_at`);