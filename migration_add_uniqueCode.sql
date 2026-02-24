-- Migração: Adicionar coluna uniqueCode (SKU+Lote) em todas as tabelas relevantes
-- Data: 2026-02-24
-- Objetivo: Eliminar agrupamentos incorretos usando chave única ao invés de filtros compostos

-- ============================================================================
-- 1. ADICIONAR COLUNA uniqueCode EM TODAS AS TABELAS
-- ============================================================================

-- productBarcodes
ALTER TABLE productBarcodes 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- receivingOrderItems
ALTER TABLE receivingOrderItems 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- inventory (TABELA PRINCIPAL DE ESTOQUE)
ALTER TABLE inventory 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- inventoryMovements
ALTER TABLE inventoryMovements 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- pickingOrderItems (ITENS DE PEDIDOS)
ALTER TABLE pickingOrderItems 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- pickingReservations
ALTER TABLE pickingReservations 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- inventoryCountItems
ALTER TABLE inventoryCountItems 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- pickingWaveItems (ITENS DE ONDAS)
ALTER TABLE pickingWaveItems 
ADD COLUMN uniqueCode VARCHAR(200) AS (
  CONCAT(productSku, '-', COALESCE(batch, 'null'))
) STORED;

-- pickingAllocations (ALOCAÇÕES DE PICKING)
ALTER TABLE pickingAllocations 
ADD COLUMN uniqueCode VARCHAR(200) AS (
  CONCAT(productSku, '-', COALESCE(batch, 'null'))
) STORED;

-- stageCheckItems (CONFERÊNCIA STAGE)
ALTER TABLE stageCheckItems 
ADD COLUMN uniqueCode VARCHAR(200) AS (
  CONCAT(productSku, '-', COALESCE(batch, 'null'))
) STORED;

-- productLabels (ETIQUETAS)
ALTER TABLE productLabels 
ADD COLUMN uniqueCode VARCHAR(200) AS (
  CONCAT(productSku, '-', batch)
) STORED;

-- labelAssociations
ALTER TABLE labelAssociations 
ADD COLUMN uniqueCode VARCHAR(200) GENERATED ALWAYS AS (
  CONCAT(
    (SELECT sku FROM products WHERE id = productId),
    '-',
    COALESCE(batch, 'null')
  )
) STORED;

-- ============================================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX idx_productBarcodes_uniqueCode ON productBarcodes(uniqueCode);
CREATE INDEX idx_receivingOrderItems_uniqueCode ON receivingOrderItems(uniqueCode);
CREATE INDEX idx_inventory_uniqueCode ON inventory(uniqueCode);
CREATE INDEX idx_inventoryMovements_uniqueCode ON inventoryMovements(uniqueCode);
CREATE INDEX idx_pickingOrderItems_uniqueCode ON pickingOrderItems(uniqueCode);
CREATE INDEX idx_pickingReservations_uniqueCode ON pickingReservations(uniqueCode);
CREATE INDEX idx_inventoryCountItems_uniqueCode ON inventoryCountItems(uniqueCode);
CREATE INDEX idx_pickingWaveItems_uniqueCode ON pickingWaveItems(uniqueCode);
CREATE INDEX idx_pickingAllocations_uniqueCode ON pickingAllocations(uniqueCode);
CREATE INDEX idx_stageCheckItems_uniqueCode ON stageCheckItems(uniqueCode);
CREATE INDEX idx_productLabels_uniqueCode ON productLabels(uniqueCode);
CREATE INDEX idx_labelAssociations_uniqueCode ON labelAssociations(uniqueCode);

-- ============================================================================
-- OBSERVAÇÕES
-- ============================================================================
-- 1. As colunas são GENERATED ALWAYS AS (computed columns) - calculadas automaticamente
-- 2. STORED significa que o valor é armazenado fisicamente (melhor performance em consultas)
-- 3. Formato: "SKU-LOTE" (ex: "401460P-22D08LB108")
-- 4. Quando batch é NULL, usa "null" como string (ex: "401460P-null")
-- 5. Índices criados para otimizar buscas por uniqueCode
