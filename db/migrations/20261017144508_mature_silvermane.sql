CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `_assert` (
	`ok` integer NOT NULL,
	CONSTRAINT "assert_ok" CHECK("_assert"."ok" = 1)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`party_size` integer NOT NULL,
	`slot_start` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`status` text NOT NULL,
	`table_ids` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`member_id` text,
	`session_id` text,
	`seating_id` text,
	`created_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bookings_branch_slot` ON `bookings` (`branch_id`,`slot_start`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`turn_model` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_tenant_slug` ON `branches` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`segment` text DEFAULT '{}' NOT NULL,
	`promo_code` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`recipients` integer DEFAULT 0 NOT NULL,
	`sent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE TABLE `cart_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`participant_name` text NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`qty` integer NOT NULL,
	`modifiers` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cart_lines_session` ON `cart_lines` (`session_id`);--> statement-breakpoint
CREATE TABLE `consumer_cursors` (
	`name` text PRIMARY KEY NOT NULL,
	`last_id` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`html` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_once` ON `emails` (`kind`,`ref`,`to_email`);--> statement-breakpoint
CREATE INDEX `emails_to` ON `emails` (`to_email`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text,
	`stream` text NOT NULL,
	`version` integer,
	`type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`actor` text,
	`msg_id` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_stream_version` ON `events` (`stream`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_msg_id` ON `events` (`msg_id`);--> statement-breakpoint
CREATE INDEX `events_branch_id` ON `events` (`branch_id`,`id`);--> statement-breakpoint
CREATE INDEX `events_stream_id` ON `events` (`stream`,`id`);--> statement-breakpoint
CREATE TABLE `floor_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`label` text NOT NULL,
	`zone` text DEFAULT 'Main' NOT NULL,
	`seats_min` integer NOT NULL,
	`seats_max` integer NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`y` real DEFAULT 0 NOT NULL,
	`merge_group` text,
	`split_config` text,
	`parent_id` text,
	`status` text DEFAULT 'free' NOT NULL,
	`seating_id` text,
	`static_token` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `floor_tables_static_token_unique` ON `floor_tables` (`static_token`);--> statement-breakpoint
CREATE INDEX `floor_tables_branch` ON `floor_tables` (`branch_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `floor_tables_branch_label` ON `floor_tables` (`branch_id`,`label`);--> statement-breakpoint
CREATE TABLE `item_availability` (
	`branch_id` text NOT NULL,
	`item_id` text NOT NULL,
	`sold_out` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`branch_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text,
	`points` integer DEFAULT 0 NOT NULL,
	`lifetime_points` integer DEFAULT 0 NOT NULL,
	`tier` text DEFAULT 'Bronze' NOT NULL,
	`opt_in` integer DEFAULT 1 NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`total_spend` integer DEFAULT 0 NOT NULL,
	`last_visit_at` integer,
	`created_at` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "members_points_non_negative" CHECK("members"."points" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_tenant_email` ON `members` (`tenant_id`,`email`);--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`image_url` text,
	`allergens` text DEFAULT '[]' NOT NULL,
	`dietary` text DEFAULT '[]' NOT NULL,
	`spice_level` integer DEFAULT 0 NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`is_signature` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`station` text DEFAULT 'kitchen' NOT NULL,
	`modifiers` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `menu_items_tenant` ON `menu_items` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`round` integer NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`unit_price` integer NOT NULL,
	`qty` integer NOT NULL,
	`modifiers` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`added_by` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`station` text DEFAULT 'kitchen' NOT NULL,
	`created_at` integer NOT NULL,
	`fired_at` integer,
	`ready_at` integer,
	`void_reason` text
);
--> statement-breakpoint
CREATE INDEX `order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_kds` ON `order_items` (`branch_id`,`status`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`seating_id` text,
	`ticket_id` text,
	`booking_id` text,
	`session_id` text,
	`parent_order_id` text,
	`email` text,
	`member_id` text,
	`discount` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`service_charge` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`rounding` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`covers` integer DEFAULT 0 NOT NULL,
	`receipt_token` text,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	`day` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_branch_status` ON `orders` (`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_branch_day` ON `orders` (`branch_id`,`day`);--> statement-breakpoint
CREATE INDEX `orders_tenant_day` ON `orders` (`tenant_id`,`day`);--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`tendered` integer,
	`change` integer DEFAULT 0 NOT NULL,
	`ref` text,
	`split_label` text,
	`status` text DEFAULT 'captured' NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`shift_id` text,
	`created_at` integer NOT NULL,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_branch_day` ON `payments` (`branch_id`,`day`);--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_ledger_once` ON `points_ledger` (`member_id`,`kind`,`ref`);--> statement-breakpoint
CREATE TABLE `promo_codes` (
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL,
	`min_spend` integer DEFAULT 0 NOT NULL,
	`max_uses` integer,
	`used` integer DEFAULT 0 NOT NULL,
	`valid_from` integer,
	`valid_to` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`tenant_id`, `code`)
);
--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`order_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`topic` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_endpoint_topic` ON `push_subscriptions` (`endpoint`,`topic`);--> statement-breakpoint
CREATE INDEX `push_topic` ON `push_subscriptions` (`topic`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`token` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_order_id_unique` ON `receipts` (`order_id`);--> statement-breakpoint
CREATE TABLE `seatings` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`table_ids` text NOT NULL,
	`party_size` integer NOT NULL,
	`ticket_id` text,
	`booking_id` text,
	`session_id` text NOT NULL,
	`order_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `seatings_branch_status` ON `seatings` (`branch_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`submit_seq` integer DEFAULT 0 NOT NULL,
	`order_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`opening_float` integer NOT NULL,
	`closing_count` integer,
	`expected_cash` integer
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`branch_ids` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `staff_tenant` ON `staff` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `staff_invites` (
	`code` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`branch_ids` text DEFAULT '[]' NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cuisine` text DEFAULT '' NOT NULL,
	`story` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'MYR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	`loyalty` text DEFAULT '{}' NOT NULL,
	`onboarding` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`day` text NOT NULL,
	`category` text NOT NULL,
	`seq` integer NOT NULL,
	`number` text NOT NULL,
	`party_size` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`member_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`called_at` integer,
	`seated_at` integer,
	`ended_at` integer,
	`skips` integer DEFAULT 0 NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`preferences` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`device_id` text,
	`seating_id` text,
	`held_table_ids` text,
	`session_id` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_number` ON `tickets` (`branch_id`,`day`,`category`,`seq`);--> statement-breakpoint
CREATE INDEX `tickets_branch_status` ON `tickets` (`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `tickets_device` ON `tickets` (`branch_id`,`device_id`,`status`);--> statement-breakpoint
CREATE TABLE `turn_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` text NOT NULL,
	`party_size` integer NOT NULL,
	`started_at` integer NOT NULL,
	`minutes` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);