-- Migração: Adicionar coluna uniqueCode (SKU+Lote) em todas as tabelas relevantes
-- Data: 2026-02-24
-- Objetivo: Eliminar agrupamentos incorretos usando chave única ao invés de filtros compostos
-- Abordagem: Coluna VARCHAR normal + população via código da aplicação

-- ============================================================================
-- 1. ADICIONAR COLUNA uniqueCode EM TODAS AS TABELAS
-- ============================================================================

-- productBarcodes
ALTER TABLE productBarcodes 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_productBarcodes_uniqueCode (uniqueCode);

-- receivingOrderItems
ALTER TABLE receivingOrderItems 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_receivingOrderItems_uniqueCode (uniqueCode);

-- inventory (TABELA PRINCIPAL DE ESTOQUE)
ALTER TABLE inventory 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_inventory_uniqueCode (uniqueCode);

-- inventoryMovements
ALTER TABLE inventoryMovements 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_inventoryMovements_uniqueCode (uniqueCode);

-- pickingOrderItems (ITENS DE PEDIDOS)
ALTER TABLE pickingOrderItems 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_pickingOrderItems_uniqueCode (uniqueCode);

-- pickingReservations
ALTER TABLE pickingReservations 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_pickingReservations_uniqueCode (uniqueCode);

-- inventoryCountItems
ALTER TABLE inventoryCountItems 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_inventoryCountItems_uniqueCode (uniqueCode);

-- pickingWaveItems (ITENS DE ONDAS)
ALTER TABLE pickingWaveItems 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_pickingWaveItems_uniqueCode (uniqueCode);

-- pickingAllocations (ALOCAÇÕES DE PICKING)
ALTER TABLE pickingAllocations 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_pickingAllocations_uniqueCode (uniqueCode);

-- stageCheckItems (CONFERÊNCIA STAGE)
ALTER TABLE stageCheckItems 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_stageCheckItems_uniqueCode (uniqueCode);

-- productLabels (ETIQUETAS)
ALTER TABLE productLabels 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_productLabels_uniqueCode (uniqueCode);

-- labelAssociations
ALTER TABLE labelAssociations 
ADD COLUMN uniqueCode VARCHAR(200) NULL,
ADD INDEX idx_labelAssociations_uniqueCode (uniqueCode);

-- ============================================================================
-- 2. POPULAR uniqueCode NOS DADOS EXISTENTES
-- ============================================================================

-- productBarcodes
UPDATE productBarcodes pb
JOIN products p ON pb.productId = p.id
SET pb.uniqueCode = CONCAT(p.sku, '-', COALESCE(pb.batch, 'null'));

-- receivingOrderItems
UPDATE receivingOrderItems roi
JOIN products p ON roi.productId = p.id
SET roi.uniqueCode = CONCAT(p.sku, '-', COALESCE(roi.batch, 'null'));

-- inventory
UPDATE inventory i
JOIN products p ON i.productId = p.id
SET i.uniqueCode = CONCAT(p.sku, '-', COALESCE(i.batch, 'null'));

-- inventoryMovements
UPDATE inventoryMovements im
JOIN products p ON im.productId = p.id
SET im.uniqueCode = CONCAT(p.sku, '-', COALESCE(im.batch, 'null'));

-- pickingOrderItems
UPDATE pickingOrderItems poi
JOIN products p ON poi.productId = p.id
SET poi.uniqueCode = CONCAT(p.sku, '-', COALESCE(poi.batch, 'null'));

-- pickingReservations
UPDATE pickingReservations pr
JOIN products p ON pr.productId = p.id
SET pr.uniqueCode = CONCAT(p.sku, '-', COALESCE(pr.batch, 'null'));

-- inventoryCountItems
UPDATE inventoryCountItems ici
JOIN products p ON ici.productId = p.id
SET ici.uniqueCode = CONCAT(p.sku, '-', COALESCE(ici.batch, 'null'));

-- pickingWaveItems (já tem productSku)
UPDATE pickingWaveItems
SET uniqueCode = CONCAT(productSku, '-', COALESCE(batch, 'null'));

-- pickingAllocations (já tem productSku)
UPDATE pickingAllocations
SET uniqueCode = CONCAT(productSku, '-', COALESCE(batch, 'null'));

-- stageCheckItems (já tem productSku)
UPDATE stageCheckItems
SET uniqueCode = CONCAT(productSku, '-', COALESCE(batch, 'null'));

-- productLabels (já tem productSku)
UPDATE productLabels
SET uniqueCode = CONCAT(productSku, '-', batch);

-- labelAssociations
UPDATE labelAssociations la
JOIN products p ON la.productId = p.id
SET la.uniqueCode = CONCAT(p.sku, '-', COALESCE(la.batch, 'null'));

-- ============================================================================
-- OBSERVAÇÕES
-- ============================================================================
-- 1. uniqueCode será mantido pela aplicação (não por trigger)
-- 2. Formato: "SKU-LOTE" (ex: "401460P-22D08LB108")
-- 3. Quando batch é NULL, usa "null" como string (ex: "401460P-null")
-- 4. Índices criados para otimizar buscas
-- 5. Código da aplicação deve sempre atualizar uniqueCode ao inserir/atualizar registros
