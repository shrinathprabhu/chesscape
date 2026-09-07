CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`day` text NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'playing' NOT NULL,
	`elapsed_ms` integer,
	`move` text,
	`result_fen` text,
	`reply` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attempts_client_day` ON `attempts` (`client`,`day`);--> statement-breakpoint
CREATE INDEX `idx_attempts_day` ON `attempts` (`day`);--> statement-breakpoint
CREATE TABLE `daily` (
	`day` text PRIMARY KEY NOT NULL,
	`fen` text NOT NULL,
	`answers` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`escape_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
