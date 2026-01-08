ALTER TABLE `products` ADD `category` varchar(100);--> statement-breakpoint
ALTER TABLE `products` ADD `costPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `salePrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `minQuantity` int DEFAULT 0;