ALTER TABLE `pickingOrderItems` ADD `unit` enum('unit','box') DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingOrderItems` ADD `unitsPerBox` int;