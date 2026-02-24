CREATE TABLE `pickingAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pickingOrderId` int NOT NULL,
	`tenantId` int NOT NULL,
	`pickingRule` enum('FIFO','FEFO','Direcionado') NOT NULL,
	`productId` int NOT NULL,
	`requestedQuantity` int NOT NULL,
	`allocatedLocations` json NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pickingAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `picking_audit_order_idx` ON `pickingAuditLogs` (`pickingOrderId`);--> statement-breakpoint
CREATE INDEX `picking_audit_tenant_idx` ON `pickingAuditLogs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `picking_audit_rule_idx` ON `pickingAuditLogs` (`pickingRule`);