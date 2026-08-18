CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monitor_id` text NOT NULL,
	`success` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`status_code` integer,
	`error_code` text,
	`error_message` text,
	`checked_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checks_monitor_time_idx` ON `checks` (`monitor_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `daily_stats` (
	`monitor_id` text NOT NULL,
	`date` text NOT NULL,
	`check_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`latency_total_ms` integer DEFAULT 0 NOT NULL,
	`latency_min_ms` integer,
	`latency_max_ms` integer,
	`worst_status` text NOT NULL,
	PRIMARY KEY(`monitor_id`, `date`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monitor_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`resolved_at` integer,
	`resolution` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_one_ongoing_idx` ON `incidents` (`monitor_id`) WHERE "incidents"."status" = 'ongoing';--> statement-breakpoint
CREATE INDEX `incidents_status_id_idx` ON `incidents` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `incidents_monitor_time_idx` ON `incidents` (`monitor_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `monitor_notification_channels` (
	`monitor_id` text NOT NULL,
	`channel_id` text NOT NULL,
	PRIMARY KEY(`monitor_id`, `channel_id`),
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`config_json` text NOT NULL,
	`interval_seconds` integer NOT NULL,
	`timeout_ms` integer NOT NULL,
	`failure_threshold` integer NOT NULL,
	`latency_threshold_ms` integer,
	`heartbeat_token_hash` text,
	`enabled` integer NOT NULL,
	`status` text NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`next_check_at` integer,
	`last_check_at` integer,
	`last_success_at` integer,
	`last_heartbeat_at` integer,
	`certificate_expires_at` integer,
	`certificate_checked_at` integer,
	`certificate_notified_for_expiry` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitors_heartbeat_token_hash_unique` ON `monitors` (`heartbeat_token_hash`);--> statement-breakpoint
CREATE INDEX `monitors_due_idx` ON `monitors` (`enabled`,`next_check_at`);--> statement-breakpoint
CREATE INDEX `monitors_certificate_idx` ON `monitors` (`certificate_expires_at`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`headers_json` text NOT NULL,
	`body_template` text NOT NULL,
	`enabled` integer NOT NULL,
	`all_monitors` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`monitor_id` text NOT NULL,
	`incident_id` integer,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`last_error` text,
	`response_status` integer,
	`payload_json` text NOT NULL,
	`sent_at` integer,
	`dedupe_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_dedupe_idx` ON `notification_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_due_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_created_idx` ON `notification_deliveries` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_name` text NOT NULL,
	`site_description` text NOT NULL,
	`timezone` text NOT NULL,
	`raw_retention_days` integer NOT NULL,
	`daily_retention_days` integer NOT NULL,
	`notification_retention_days` integer NOT NULL,
	`default_interval_seconds` integer NOT NULL,
	`default_timeout_ms` integer NOT NULL,
	`default_failure_threshold` integer NOT NULL,
	`certificate_warning_days` integer NOT NULL,
	`public_enabled` integer NOT NULL,
	`public_show_response_time` integer NOT NULL,
	`logo_path` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `status_page_monitors` (
	`monitor_id` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
