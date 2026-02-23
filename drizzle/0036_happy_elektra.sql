CREATE TABLE `pickingAllocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pickingOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`productSku` varchar(100) NOT NULL,
	`locationId` int NOT NULL,
	`locationCode` varchar(50) NOT NULL,
	`batch` varchar(100),
	`expiryDate` date,
	`quantity` int NOT NULL,
	`isFractional` boolean NOT NULL DEFAULT false,
	`sequence` int NOT NULL,
	`status` enum('pending','in_progress','picked','short_picked') NOT NULL DEFAULT 'pending',
	`pickedQuantity` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pickingAllocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickingProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pickingOrderId` int NOT NULL,
	`currentSequence` int NOT NULL DEFAULT 1,
	`currentLocationId` int,
	`scannedItems` json,
	`pausedAt` timestamp,
	`pausedBy` int,
	`resumedAt` timestamp,
	`resumedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickingProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `pickingProgress_pickingOrderId_unique` UNIQUE(`pickingOrderId`)
);
--> statement-breakpoint
ALTER TABLE `pickingOrders` MODIFY COLUMN `status` enum('pending','validated','in_wave','in_progress','paused','picking','picked','divergent','checking','packed','staged','invoiced','shipped','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
CREATE INDEX `allocation_order_idx` ON `pickingAllocations` (`pickingOrderId`);--> statement-breakpoint
CREATE INDEX `allocation_location_idx` ON `pickingAllocations` (`locationId`);--> statement-breakpoint
CREATE INDEX `allocation_sequence_idx` ON `pickingAllocations` (`pickingOrderId`,`sequence`);