ALTER TABLE `pickingWaveItems` ADD `pickingOrderId` int NOT NULL;--> statement-breakpoint
CREATE INDEX `wave_item_order_idx` ON `pickingWaveItems` (`pickingOrderId`);