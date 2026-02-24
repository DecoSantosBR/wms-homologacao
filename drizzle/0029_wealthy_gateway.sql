ALTER TABLE `pickingWaveItems` ADD `unit` enum('unit','box') DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE `pickingWaveItems` ADD `unitsPerBox` int;