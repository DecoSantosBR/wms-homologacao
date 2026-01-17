ALTER TABLE `products` MODIFY COLUMN `status` enum('active','inactive','discontinued','pending_completion') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `products` ADD `supplierCode` varchar(100);--> statement-breakpoint
ALTER TABLE `products` ADD `customerCode` varchar(100);