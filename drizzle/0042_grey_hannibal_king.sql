CREATE TABLE `invoiceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`sku` varchar(100) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`batch` varchar(50),
	`expiryDate` timestamp,
	`uniqueCode` varchar(200),
	`quantity` int NOT NULL,
	`unitValue` decimal(15,4),
	`totalValue` decimal(15,2),
	`ncm` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoiceItems` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `invoice_items_product_idx` ON `invoiceItems` (`productId`);--> statement-breakpoint
CREATE INDEX `invoice_items_unique_code_idx` ON `invoiceItems` (`uniqueCode`);