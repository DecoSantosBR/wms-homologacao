# Plano de Refatoração - Simplificação de Estrutura de Tabelas

## Objetivo

Eliminar redundância e complexidade desnecessária consolidando múltiplas tabelas em estruturas mais simples e eficientes.

---

## 📦 Módulo de Recebimento

### Estrutura Atual (5 tabelas)

```
receivingOrders (cabeçalho)
  ├── receivingOrderItems (itens esperados)
  └── receivingChecks (conferências)
        └── receivingCheckItems (itens conferidos)
              └── labelAssociations (etiquetas geradas)
```

### Estrutura Nova (2 tabelas)

```
receivingOrders (cabeçalho)
  └── receivingItems (TUDO: esperado + conferido + etiqueta + endereço)
```

### Schema da Nova Tabela `receivingItems`

```typescript
export const receivingItems = mysqlTable("receivingItems", {
  id: int("id").autoincrement().primaryKey(),
  receivingOrderId: int("receivingOrderId").notNull(),
  tenantId: int("tenantId").notNull(),
  
  // Produto
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  
  // Quantidades
  expectedQuantity: int("expectedQuantity").notNull(), // Esperado
  checkedQuantity: int("checkedQuantity").default(0).notNull(), // Conferido
  storedQuantity: int("storedQuantity").default(0).notNull(), // Armazenado
  
  // Lote e validade
  batch: varchar("batch", { length: 100 }),
  expiryDate: date("expiryDate"),
  
  // Etiqueta gerada
  labelCode: varchar("labelCode", { length: 100 }).unique(), // SKU+Lote (ex: 401460P22D08LB108)
  
  // Endereço destino
  locationId: int("locationId"),
  locationCode: varchar("locationCode", { length: 50 }),
  
  // Status e controle
  status: mysqlEnum("status", ["pending", "checking", "checked", "stored"]).default("pending").notNull(),
  divergence: boolean("divergence").default(false).notNull(),
  
  // Auditoria
  checkedBy: int("checkedBy"), // Operador que conferiu
  checkedAt: timestamp("checkedAt"),
  storedBy: int("storedBy"), // Operador que armazenou
  storedAt: timestamp("storedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### Migração de Dados - Recebimento

```sql
-- Criar receivingItems a partir de receivingOrderItems + receivingCheckItems + labelAssociations
INSERT INTO receivingItems (
  receivingOrderId, tenantId, productId, productSku, productName,
  expectedQuantity, checkedQuantity, storedQuantity,
  batch, expiryDate, labelCode, locationId, locationCode,
  status, divergence, checkedBy, checkedAt, storedBy, storedAt, createdAt
)
SELECT 
  roi.receivingOrderId,
  roi.tenantId,
  roi.productId,
  p.sku,
  p.description,
  roi.expectedQuantity,
  COALESCE(rci.checkedQuantity, 0),
  COALESCE(roi.expectedQuantity, 0), -- Assumir que foi armazenado se conferido
  roi.batch,
  roi.expiryDate,
  la.labelCode,
  roi.locationId,
  wl.code,
  CASE 
    WHEN rci.id IS NOT NULL THEN 'stored'
    ELSE 'pending'
  END,
  CASE WHEN rci.divergence = 1 THEN true ELSE false END,
  rc.operatorId,
  rci.scannedAt,
  rc.operatorId, -- Mesmo operador
  rc.completedAt,
  roi.createdAt
FROM receivingOrderItems roi
LEFT JOIN products p ON roi.productId = p.id
LEFT JOIN receivingChecks rc ON roi.receivingOrderId = rc.receivingOrderId
LEFT JOIN receivingCheckItems rci ON rc.id = rci.receivingCheckId AND rci.productId = roi.productId
LEFT JOIN labelAssociations la ON la.productId = roi.productId AND la.batch = roi.batch
LEFT JOIN warehouseLocations wl ON roi.locationId = wl.id;
```

---

## 📤 Módulo de Picking

### Estrutura Atual (6 tabelas)

```
pickingOrders (cabeçalho do pedido)
  ├── pickingOrderItems (itens do pedido)
  ├── pickingReservations (reservas de estoque)
  └── pickingWaves (cabeçalho da onda)
        ├── pickingWaveItems (itens consolidados da onda)
        └── pickingAllocations (alocações para separação)
```

### Estrutura Nova (2 tabelas)

```
pickingOrders (cabeçalho: pedido OU onda)
  └── pickingItems (TUDO: item + reserva + alocação + status)
```

### Schema da Nova Tabela `pickingItems`

```typescript
export const pickingItems = mysqlTable("pickingItems", {
  id: int("id").autoincrement().primaryKey(),
  pickingOrderId: int("pickingOrderId").notNull(), // Pedido ou Onda
  tenantId: int("tenantId").notNull(),
  
  // Produto
  productId: int("productId").notNull(),
  productSku: varchar("productSku", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  
  // Quantidades
  requestedQuantity: int("requestedQuantity").notNull(), // Solicitado
  reservedQuantity: int("reservedQuantity").default(0).notNull(), // Reservado no estoque
  pickedQuantity: int("pickedQuantity").default(0).notNull(), // Separado
  stagedQuantity: int("stagedQuantity").default(0).notNull(), // Conferido
  shippedQuantity: int("shippedQuantity").default(0).notNull(), // Expedido
  
  // Unidade
  unit: mysqlEnum("unit", ["unit", "box"]).default("unit").notNull(),
  unitsPerBox: int("unitsPerBox"),
  
  // Lote e estoque
  batch: varchar("batch", { length: 100 }),
  expiryDate: date("expiryDate"),
  inventoryId: int("inventoryId"), // Registro de estoque vinculado
  
  // Endereço de separação
  locationId: int("locationId"),
  locationCode: varchar("locationCode", { length: 50 }),
  sequence: int("sequence").default(0), // Ordem de separação
  
  // Status e controle
  status: mysqlEnum("status", ["pending", "reserved", "picking", "picked", "staged", "shipped", "cancelled"]).default("pending").notNull(),
  hasFractional: boolean("hasFractional").default(false).notNull(),
  
  // Auditoria
  pickedBy: int("pickedBy"),
  pickedAt: timestamp("pickedAt"),
  stagedBy: int("stagedBy"),
  stagedAt: timestamp("stagedAt"),
  shippedBy: int("shippedBy"),
  shippedAt: timestamp("shippedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orderIdx: index("picking_items_order_idx").on(table.pickingOrderId),
  productIdx: index("picking_items_product_idx").on(table.productId),
  statusIdx: index("picking_items_status_idx").on(table.status),
  inventoryIdx: index("picking_items_inventory_idx").on(table.inventoryId),
}));
```

### Migração de Dados - Picking

```sql
-- Criar pickingItems a partir de pickingOrderItems + pickingReservations
INSERT INTO pickingItems (
  pickingOrderId, tenantId, productId, productSku, productName,
  requestedQuantity, reservedQuantity, pickedQuantity, stagedQuantity,
  unit, unitsPerBox, batch, expiryDate, inventoryId,
  locationId, locationCode, sequence, status, hasFractional,
  pickedBy, pickedAt, stagedBy, stagedAt, createdAt
)
SELECT 
  poi.pickingOrderId,
  poi.tenantId,
  poi.productId,
  p.sku,
  p.description,
  poi.requestedQuantity,
  COALESCE(pr.quantity, 0),
  COALESCE(pa.pickedQuantity, 0),
  COALESCE(sc.checkedQuantity, 0),
  poi.unit,
  poi.unitsPerBox,
  poi.batch,
  poi.expiryDate,
  poi.inventoryId,
  COALESCE(pa.locationId, pr.locationId),
  COALESCE(pa.locationCode, wl.code),
  COALESCE(pa.sequence, 0),
  CASE 
    WHEN sc.id IS NOT NULL THEN 'staged'
    WHEN pa.status = 'picked' THEN 'picked'
    WHEN pa.status = 'picking' THEN 'picking'
    WHEN pr.id IS NOT NULL THEN 'reserved'
    ELSE 'pending'
  END,
  COALESCE(pa.hasFractional, false),
  po.pickedBy,
  po.pickedAt,
  sc.operatorId,
  sc.completedAt,
  poi.createdAt
FROM pickingOrderItems poi
LEFT JOIN products p ON poi.productId = p.id
LEFT JOIN pickingReservations pr ON pr.pickingOrderId = poi.pickingOrderId AND pr.productId = poi.productId AND pr.inventoryId = poi.inventoryId
LEFT JOIN pickingAllocations pa ON pa.pickingOrderId = poi.pickingOrderId AND pa.productId = poi.productId AND pa.batch = poi.batch
LEFT JOIN pickingOrders po ON poi.pickingOrderId = po.id
LEFT JOIN stageChecks sc ON sc.pickingOrderId = poi.pickingOrderId
LEFT JOIN warehouseLocations wl ON pr.locationId = wl.id;
```

---

## Ordem de Execução

1. ✅ Criar novas tabelas no schema.ts
2. ✅ Executar `pnpm db:push` para aplicar mudanças
3. ✅ Executar scripts de migração de dados
4. ✅ Atualizar lógica de Recebimento
5. ✅ Atualizar lógica de Picking
6. ✅ Testar fluxos críticos
7. ✅ Remover tabelas antigas (DROP TABLE)
8. ✅ Salvar checkpoint

---

## Arquivos a Modificar

### Recebimento
- `drizzle/schema.ts` - Adicionar receivingItems
- `server/receiving.ts` - Atualizar lógica
- `server/receivingRouter.ts` - Atualizar endpoints
- `server/blindCheck.ts` - Atualizar conferência

### Picking
- `drizzle/schema.ts` - Adicionar pickingItems
- `server/pickingLogic.ts` - Atualizar lógica
- `server/routers.ts` - Atualizar endpoints picking.*
- `server/waveLogic.ts` - Atualizar lógica de ondas
- `server/waveRouter.ts` - Atualizar endpoints wave.*
- `server/collectorPickingRouter.ts` - Atualizar coletor
- `server/stageRouter.ts` - Atualizar stage
- `server/pickingAllocation.ts` - Remover (não mais necessário)

---

## Testes Críticos

### Recebimento
1. Criar ordem de recebimento
2. Realizar conferência cega
3. Armazenar produtos
4. Verificar estoque atualizado

### Picking
1. Criar pedido de separação
2. Gerar onda
3. Separar no coletor
4. Conferir no stage
5. Verificar estoque baixado

---

## Rollback

Se algo der errado, podemos:
1. Restaurar checkpoint anterior
2. Manter tabelas antigas até validação completa
3. Criar views de compatibilidade temporárias
