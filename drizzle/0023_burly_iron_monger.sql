CREATE TABLE `productLabels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`labelCode` varchar(200) NOT NULL,
	`productId` int NOT NULL,
	`productSku` varchar(100) NOT NULL,
	`batch` varchar(100) NOT NULL,
	`expiryDate` date,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productLabels_id` PRIMARY KEY(`id`),
	CONSTRAINT `productLabels_labelCode_unique` UNIQUE(`labelCode`)
);
--> statement-breakpoint
CREATE INDEX `product_label_code_idx` ON `productLabels` (`labelCode`);--> statement-breakpoint
CREATE INDEX `product_label_product_idx` ON `productLabels` (`productId`);--> statement-breakpoint
CREATE INDEX `product_label_sku_batch_idx` ON `productLabels` (`productSku`,`batch`);