CREATE TABLE `stageCheckItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageCheckId` int NOT NULL,
	`productId` int NOT NULL,
	`productSku` varchar(100) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`expectedQuantity` int NOT NULL,
	`checkedQuantity` int NOT NULL DEFAULT 0,
	`divergence` int NOT NULL DEFAULT 0,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stageCheckItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stageChecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`pickingOrderId` int NOT NULL,
	`customerOrderNumber` varchar(100) NOT NULL,
	`operatorId` int NOT NULL,
	`status` enum('in_progress','completed','divergent') NOT NULL DEFAULT 'in_progress',
	`hasDivergence` boolean NOT NULL DEFAULT false,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stageChecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `stage_item_check_idx` ON `stageCheckItems` (`stageCheckId`);--> statement-breakpoint
CREATE INDEX `stage_item_product_idx` ON `stageCheckItems` (`productId`);--> statement-breakpoint
CREATE INDEX `stage_check_tenant_idx` ON `stageChecks` (`tenantId`);--> statement-breakpoint
CREATE INDEX `stage_check_order_idx` ON `stageChecks` (`pickingOrderId`);--> statement-breakpoint
CREATE INDEX `stage_check_status_idx` ON `stageChecks` (`status`);