PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`monitor_id` text,
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
INSERT INTO `__new_notification_deliveries`("id", "channel_id", "monitor_id", "incident_id", "event_type", "status", "attempts", "next_attempt_at", "last_error", "response_status", "payload_json", "sent_at", "dedupe_key", "created_at") SELECT "id", "channel_id", "monitor_id", "incident_id", "event_type", "status", "attempts", "next_attempt_at", "last_error", "response_status", "payload_json", "sent_at", "dedupe_key", "created_at" FROM `notification_deliveries`;--> statement-breakpoint
DROP TABLE `notification_deliveries`;--> statement-breakpoint
ALTER TABLE `__new_notification_deliveries` RENAME TO `notification_deliveries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_dedupe_idx` ON `notification_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_due_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_created_idx` ON `notification_deliveries` (`created_at`);