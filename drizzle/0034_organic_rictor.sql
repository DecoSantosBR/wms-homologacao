CREATE TABLE `clientPortalSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`systemUserId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientPortalSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientPortalSessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `cps_tenant_idx` ON `clientPortalSessions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `cps_user_idx` ON `clientPortalSessions` (`systemUserId`);--> statement-breakpoint
CREATE INDEX `cps_expires_idx` ON `clientPortalSessions` (`expiresAt`);