CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`invoiceNumber` varchar(20) NOT NULL,
	`series` varchar(5) NOT NULL,
	`invoiceKey` varchar(44) NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(255),
	`pickingOrderId` int,
	`xmlData` json,
	`volumes` int,
	`totalValue` decimal(15,2),
	`issueDate` timestamp,
	`status` enum('imported','linked','in_manifest','shipped') NOT NULL DEFAULT 'imported',
	`importedBy` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`linkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceKey_unique` UNIQUE(`invoiceKey`)
);
--> statement-breakpoint
CREATE TABLE `shipmentManifestItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`manifestId` int NOT NULL,
	`pickingOrderId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`volumes` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipmentManifestItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipmentManifestItems_manifestId_pickingOrderId_unique` UNIQUE(`manifestId`,`pickingOrderId`)
);
--> statement-breakpoint
CREATE TABLE `shipmentManifests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`manifestNumber` varchar(50) NOT NULL,
	`carrierId` int,
	`carrierName` varchar(255),
	`totalOrders` int NOT NULL DEFAULT 0,
	`totalInvoices` int NOT NULL DEFAULT 0,
	`totalVolumes` int NOT NULL DEFAULT 0,
	`status` enum('draft','ready','collected','shipped') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`collectedAt` timestamp,
	`shippedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipmentManifests_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipmentManifests_manifestNumber_unique` UNIQUE(`manifestNumber`)
);
--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `shippingStatus` enum('awaiting_invoice','invoice_linked','in_manifest','shipped');