CREATE TABLE `pickingWaveItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`waveId` int NOT NULL,
	`productId` int NOT NULL,
	`productSku` varchar(100) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`totalQuantity` int NOT NULL,
	`pickedQuantity` int NOT NULL DEFAULT 0,
	`locationId` int NOT NULL,
	`locationCode` varchar(50) NOT NULL,
	`batch` varchar(100),
	`expiryDate` date,
	`status` enum('pending','picking','picked') NOT NULL DEFAULT 'pending',
	`pickedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pickingWaveItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickingWaves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`waveNumber` varchar(50) NOT NULL,
	`status` enum('pending','picking','picked','staged','completed','cancelled') NOT NULL DEFAULT 'pending',
	`totalOrders` int NOT NULL DEFAULT 0,
	`totalItems` int NOT NULL DEFAULT 0,
	`totalQuantity` int NOT NULL DEFAULT 0,
	`pickingRule` enum('FIFO','FEFO','Direcionado') NOT NULL,
	`assignedTo` int,
	`pickedBy` int,
	`pickedAt` timestamp,
	`stagedBy` int,
	`stagedAt` timestamp,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickingWaves_id` PRIMARY KEY(`id`),
	CONSTRAINT `pickingWaves_waveNumber_unique` UNIQUE(`waveNumber`)
);
--> statement-breakpoint
CREATE INDEX `wave_item_wave_idx` ON `pickingWaveItems` (`waveId`);--> statement-breakpoint
CREATE INDEX `wave_item_product_idx` ON `pickingWaveItems` (`productId`);--> statement-breakpoint
CREATE INDEX `wave_item_location_idx` ON `pickingWaveItems` (`locationId`);--> statement-breakpoint
CREATE INDEX `wave_tenant_idx` ON `pickingWaves` (`tenantId`);--> statement-breakpoint
CREATE INDEX `wave_status_idx` ON `pickingWaves` (`status`);