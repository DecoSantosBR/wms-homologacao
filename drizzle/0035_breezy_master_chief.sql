ALTER TABLE `systemUsers` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `systemUsers` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `systemUsers` ADD `approvedAt` timestamp;