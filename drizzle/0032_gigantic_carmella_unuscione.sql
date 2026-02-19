ALTER TABLE `labelAssociations` MODIFY COLUMN `sessionId` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `labelReadings` MODIFY COLUMN `sessionId` varchar(20) NOT NULL;