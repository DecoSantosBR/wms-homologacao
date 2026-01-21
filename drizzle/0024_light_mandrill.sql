CREATE TABLE `printSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultFormat` enum('zpl','pdf') NOT NULL DEFAULT 'zpl',
	`defaultCopies` int NOT NULL DEFAULT 1,
	`labelSize` varchar(50) NOT NULL DEFAULT '4x2',
	`printerDpi` int NOT NULL DEFAULT 203,
	`autoPrint` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `printSettings_userId_unique` UNIQUE(`userId`)
);
