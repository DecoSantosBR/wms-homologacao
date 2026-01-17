CREATE TABLE `pickingReservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pickingOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`inventoryId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pickingReservations_id` PRIMARY KEY(`id`)
);
