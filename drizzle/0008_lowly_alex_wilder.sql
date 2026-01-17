ALTER TABLE `pickingOrderItems` MODIFY COLUMN `status` enum('pending','picking','picked','short_picked','exception','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `pickingOrders` MODIFY COLUMN `status` enum('pending','validated','in_wave','picking','picked','checking','packed','invoiced','shipped','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `requestedUM` enum('unit','box','pallet') DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `pickedUM` enum('unit','box','pallet') DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `inventoryId` int;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `pickedBy` int;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `pickedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `exceptionReason` text;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `totalItems` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `totalQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `scheduledDate` timestamp;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `checkedBy` int;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `checkedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `packedBy` int;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `packedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `shippedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `waveId` int;--> statement-breakpoint
ALTER TABLE `pickingOrders` ADD `notes` text;