/**
 * Módulo para sincronização e recálculo de saldos de inventário
 * 
 * Este módulo é responsável por recalcular os saldos da tabela `inventory`
 * a partir do histórico de movimentações na tabela `inventoryMovements`.
 */

import { getDb } from "../db";
import { inventory, inventoryMovements, products, warehouseLocations } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateLocationStatus } from "../movements";

interface MovementSummary {
  productId: number;
  locationId: number;
  batch: string | null;
  tenantId: number | null;
  totalQuantity: number;
  expiryDate: Date | null;
  serialNumber: string | null;
}

/**
 * Recalcula os saldos de inventário a partir das movimentações
 * 
 * Lógica:
 * - Movimentos de entrada (receiving, put_away, return, adjustment positivo): somam no destino
 * - Movimentos de saída (picking, transfer, disposal, adjustment negativo): subtraem da origem
 * - Transfer: subtrai da origem e soma no destino
 */
export async function recalculateInventoryBalances(): Promise<{
  created: number;
  updated: number;
  deleted: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log("[Inventory Sync] Iniciando recálculo de saldos...");

  // 1. Limpar tabela inventory atual
  await db.delete(inventory);
  console.log("[Inventory Sync] Tabela inventory limpa");

  // 2. Buscar todas as movimentações agrupadas por produto, lote e localização
  const movements = await db
    .select({
      productId: inventoryMovements.productId,
      batch: inventoryMovements.batch,
      serialNumber: inventoryMovements.serialNumber,
      fromLocationId: inventoryMovements.fromLocationId,
      toLocationId: inventoryMovements.toLocationId,
      quantity: inventoryMovements.quantity,
      movementType: inventoryMovements.movementType,
      tenantId: inventoryMovements.tenantId,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .orderBy(inventoryMovements.createdAt);

  console.log(`[Inventory Sync] Processando ${movements.length} movimentações...`);

  // 3. Calcular saldos por posição (produto + lote + localização)
  const balances = new Map<string, MovementSummary>();

  for (const mov of movements) {
    // Processar saída (origem)
    if (mov.fromLocationId) {
      const fromKey = `${mov.productId}-${mov.fromLocationId}-${mov.batch || "null"}`;
      const fromBalance = balances.get(fromKey) || {
        productId: mov.productId,
        locationId: mov.fromLocationId,
        batch: mov.batch,
        tenantId: mov.tenantId,
        totalQuantity: 0,
        expiryDate: null,
        serialNumber: mov.serialNumber,
      };
      fromBalance.totalQuantity -= mov.quantity;
      balances.set(fromKey, fromBalance);
    }

    // Processar entrada (destino)
    if (mov.toLocationId) {
      const toKey = `${mov.productId}-${mov.toLocationId}-${mov.batch || "null"}`;
      const toBalance = balances.get(toKey) || {
        productId: mov.productId,
        locationId: mov.toLocationId,
        batch: mov.batch,
        tenantId: mov.tenantId,
        totalQuantity: 0,
        expiryDate: null,
        serialNumber: mov.serialNumber,
      };
      toBalance.totalQuantity += mov.quantity;
      balances.set(toKey, toBalance);
    }
  }

  console.log(`[Inventory Sync] Calculados ${balances.size} saldos únicos`);

  // 4. Inserir saldos na tabela inventory (apenas saldos > 0)
  let created = 0;
  const recordsToInsert = [];

  for (const [key, balance] of Array.from(balances.entries())) {
    if (balance.totalQuantity > 0) {
      recordsToInsert.push({
        productId: balance.productId,
        locationId: balance.locationId,
        batch: balance.batch,
        expiryDate: balance.expiryDate,
        serialNumber: balance.serialNumber,
        quantity: balance.totalQuantity,
        tenantId: balance.tenantId,
        status: "available" as const,
      });
    }
  }

  // Inserir em lotes de 100
  const batchSize = 100;
  for (let i = 0; i < recordsToInsert.length; i += batchSize) {
    const batch = recordsToInsert.slice(i, i + batchSize);
    await db.insert(inventory).values(batch);
    created += batch.length;
  }

  console.log(`[Inventory Sync] Criados ${created} registros de saldo`);

  return {
    created,
    updated: 0,
    deleted: 0,
  };
}

/**
 * Atualiza o saldo de uma posição específica após uma movimentação
 * (Uso incremental para manter sincronizado em tempo real)
 */
export async function updateInventoryBalance(
  productId: number,
  locationId: number,
  batch: string | null,
  quantityChange: number,
  tenantId: number | null,
  expiryDate: Date | null = null,
  serialNumber: string | null = null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar registro existente
  const conditions = [
    eq(inventory.productId, productId),
    eq(inventory.locationId, locationId),
  ];

  if (batch) {
    conditions.push(eq(inventory.batch, batch));
  } else {
    conditions.push(sql`${inventory.batch} IS NULL`);
  }

  const existing = await db
    .select()
    .from(inventory)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar quantidade existente
    const newQuantity = existing[0].quantity + quantityChange;

    if (newQuantity <= 0) {
      // Remover registro se quantidade zerou
      await db
        .delete(inventory)
        .where(eq(inventory.id, existing[0].id));
      
      // Atualizar status do endereço para "available" quando estoque zerar
      await updateLocationStatus(locationId);
    } else {
      // Atualizar quantidade e validade (se fornecida)
      const updateData: any = { 
        quantity: newQuantity, 
        updatedAt: new Date() 
      };
      
      // Atualizar expiryDate se fornecido (sobrescrever com valor mais recente)
      if (expiryDate) {
        updateData.expiryDate = expiryDate;
      }
      
      await db
        .update(inventory)
        .set(updateData)
        .where(eq(inventory.id, existing[0].id));
    }
  } else if (quantityChange > 0) {
    // Criar novo registro
    await db.insert(inventory).values({
      productId,
      locationId,
      batch,
      expiryDate,
      serialNumber,
      quantity: quantityChange,
      tenantId,
      status: "available",
    });
  }
}
