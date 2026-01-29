CREATE TABLE `reportFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reportType` varchar(100) NOT NULL,
	`favoriteName` varchar(255) NOT NULL,
	`filters` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportFavorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`userId` int NOT NULL,
	`reportType` varchar(100) NOT NULL,
	`reportCategory` enum('stock','operational','shipping','audit') NOT NULL,
	`filters` json,
	`exportFormat` enum('screen','excel','pdf','csv'),
	`recordCount` int,
	`executionTime` int,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `reportFavorites_userId_idx` ON `reportFavorites` (`userId`);--> statement-breakpoint
CREATE INDEX `reportFavorites_reportType_idx` ON `reportFavorites` (`reportType`);--> statement-breakpoint
CREATE INDEX `reportLogs_tenantId_idx` ON `reportLogs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `reportLogs_userId_idx` ON `reportLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `reportLogs_reportType_idx` ON `reportLogs` (`reportType`);--> statement-breakpoint
CREATE INDEX `reportLogs_generatedAt_idx` ON `reportLogs` (`generatedAt`);