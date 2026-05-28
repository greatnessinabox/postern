CREATE TABLE `account_spaces` (
	`account_id` text NOT NULL,
	`space_id` text NOT NULL,
	PRIMARY KEY(`account_id`, `space_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`address` text NOT NULL,
	`display_name` text NOT NULL,
	`oauth_access_token_ref` text,
	`oauth_refresh_token_ref` text,
	`oauth_expires_at` integer,
	`imap_host` text,
	`imap_port` integer,
	`imap_password_ref` text,
	`created_at` integer NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `boosts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`scope_sender_domains` text,
	`scope_sender_addresses` text,
	`scope_space_id` text,
	`scope_thread_subject_pattern` text,
	`enabled` integer DEFAULT true NOT NULL,
	`author` text,
	`version` text DEFAULT '0.0.0' NOT NULL,
	`installed_at` integer NOT NULL,
	FOREIGN KEY (`scope_space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handle_addresses` (
	`handle_id` text NOT NULL,
	`local` text NOT NULL,
	`domain` text NOT NULL,
	`display_name` text,
	PRIMARY KEY(`handle_id`, `local`, `domain`),
	FOREIGN KEY (`handle_id`) REFERENCES `handles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handle_addresses_email_idx` ON `handle_addresses` (`local`,`domain`);--> statement-breakpoint
CREATE TABLE `handles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`thread_count` integer DEFAULT 0 NOT NULL,
	`last_contacted_at` integer,
	`avatar_url` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `message_recipients` (
	`message_id` text NOT NULL,
	`handle_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`message_id`, `handle_id`, `role`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handle_id`) REFERENCES `handles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`account_id` text NOT NULL,
	`message_id_header` text NOT NULL,
	`in_reply_to` text,
	`state` text NOT NULL,
	`from_handle_id` text NOT NULL,
	`subject` text NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`classification` text DEFAULT 'unclassified' NOT NULL,
	`has_attachments` integer DEFAULT false NOT NULL,
	`received_at` integer NOT NULL,
	`sent_at` integer,
	`read_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_handle_id`) REFERENCES `handles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_thread_idx` ON `messages` (`thread_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `messages_header_idx` ON `messages` (`message_id_header`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`filename` text,
	`size` integer DEFAULT 0 NOT NULL,
	`inline` integer DEFAULT false NOT NULL,
	`content` text,
	`blob_ref` text,
	`content_id` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parts_message_idx` ON `parts` (`message_id`);--> statement-breakpoint
CREATE TABLE `schema_version` (
	`version` integer PRIMARY KEY NOT NULL,
	`applied_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme_accent` text NOT NULL,
	`theme_background_tint` text NOT NULL,
	`theme_glyph` text NOT NULL,
	`signature` text DEFAULT '' NOT NULL,
	`ai_persona` text,
	`position` integer NOT NULL,
	`read_style` text DEFAULT 'letter' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_cursors` (
	`account_id` text NOT NULL,
	`folder` text NOT NULL,
	`last_uid` integer,
	`last_modseq` integer,
	`last_synced_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `folder`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thread_participants` (
	`thread_id` text NOT NULL,
	`handle_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`thread_id`, `handle_id`, `role`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handle_id`) REFERENCES `handles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`space_id` text NOT NULL,
	`subject` text NOT NULL,
	`subject_normalized` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`your_turn` integer DEFAULT false NOT NULL,
	`snooze_until` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`first_message_at` integer NOT NULL,
	`last_message_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `threads_space_last_message_idx` ON `threads` (`space_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `threads_state_idx` ON `threads` (`state`);