ALTER TABLE `messages` ADD `trust_spf` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `trust_dkim` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `trust_dmarc` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `trust_verdict` text DEFAULT 'unknown' NOT NULL;