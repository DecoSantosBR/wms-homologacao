CREATE TABLE `pickingExecutionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`waveId` int NOT NULL,
	`waveItemId` int NOT NULL,
	`locationId` int NOT NULL,
	`locationCode` varchar(50) NOT NULL,
	`labelCode` varchar(100) NOT NULL,
	`productId` int NOT NULL,
	`productSku` varchar(100) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`batch` varchar(100) NOT NULL,
	`expiryDate` date,
	`quantity` int NOT NULL,
	`pickedBy` int NOT NULL,
	`pickedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pickingExecutionItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `picking_exec_wave_idx` ON `pickingExecutionItems` (`waveId`);--> statement-breakpoint
CREATE INDEX `picking_exec_wave_item_idx` ON `pickingExecutionItems` (`waveItemId`);--> statement-breakpoint
CREATE INDEX `picking_exec_location_idx` ON `pickingExecutionItems` (`locationId`);--> statement-breakpoint
CREATE INDEX `picking_exec_label_idx` ON `pickingExecutionItems` (`labelCode`);