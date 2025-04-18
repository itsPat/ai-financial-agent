PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`merchant` text NOT NULL,
	`account` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "date", "amount", "category", "merchant", "account") SELECT "id", "date", "amount", "category", "merchant", "account" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;