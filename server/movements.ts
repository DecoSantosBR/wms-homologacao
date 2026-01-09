import { eq, and, sum, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  inventory,
  inventoryMovements,
  warehouseLocations,
  products,
  systemUsers,
} from "../drizzle/schema";

export interface RegisterMovementInput {
  productId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  batch?: string;
  movementType: "transfer" | "adjustment" | "return" | "disposal";
  notes?: string;
  tenantId?: number | null;
  performedBy: number;
}

/**
 * Registra movimentação de estoque com validações
 */
export async function registerMovement(input: RegisterMovementInput) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // FASE 1: VALIDAÇÕES (sem modificar dados)

  // Validar saldo disponível na origem
  const fromStock = await dbConn
    .select({ total: sql<number>`COALESCE(SUM(${inventory.quantity}), 0)` })
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : sql`1=1`
      )
    );

  const availableQuantity = Number(fromStock[0]?.total ?? 0);
  if (availableQuantity < input.quantity) {
    throw new Error(
      `Saldo insuficiente. Disponível: ${availableQuantity}, Solicitado: ${input.quantity}`
    );
  }

  // Validar regra de armazenagem do endereço destino
  const toLocation = await dbConn
    .select()
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, input.toLocationId))
    .limit(1);

  if (!toLocation[0]) {
    throw new Error("Endereço destino não encontrado");
  }

  // Se endereço é "single" (único item/lote), validar se já contém outro produto/lote
  if (toLocation[0].storageRule === "single") {
    const existingStock = await dbConn
      .select()
      .from(inventory)
      .where(eq(inventory.locationId, input.toLocationId))
      .limit(1);

    if (existingStock.length > 0) {
      const existing = existingStock[0];
      if (
        existing.productId !== input.productId ||
        existing.batch !== input.batch
      ) {
        throw new Error(
          `Endereço ${toLocation[0].code} é de único item/lote e já contém outro produto/lote`
        );
      }
    }
  }

  // FASE 2: MODIFICAR DADOS (somente se validações passarem)

  // Deduzir estoque da origem
  const fromInventory = await dbConn
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : sql`1=1`
      )
    )
    .limit(1);

  if (fromInventory[0]) {
    const newQuantity = fromInventory[0].quantity - input.quantity;
    if (newQuantity <= 0) {
      // Remover registro se quantidade chegar a zero
      await dbConn
        .delete(inventory)
        .where(eq(inventory.id, fromInventory[0].id));
    } else {
      // Atualizar quantidade
      await dbConn
        .update(inventory)
        .set({ quantity: newQuantity })
        .where(eq(inventory.id, fromInventory[0].id));
    }
  }

  // Adicionar estoque ao destino
  const toInventory = await dbConn
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.toLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : sql`1=1`
      )
    )
    .limit(1);

  if (toInventory[0]) {
    // Atualizar quantidade existente
    await dbConn
      .update(inventory)
      .set({
        quantity: toInventory[0].quantity + input.quantity,
        expiryDate: fromInventory[0]?.expiryDate || toInventory[0].expiryDate,
      })
      .where(eq(inventory.id, toInventory[0].id));
  } else {
    // Criar novo registro
    await dbConn.insert(inventory).values({
      productId: input.productId,
      locationId: input.toLocationId,
      batch: input.batch || null,
      quantity: input.quantity,
      expiryDate: fromInventory[0]?.expiryDate || null,
      status: "available",
      tenantId: input.tenantId || null,
    });
  }

  // Registrar movimentação no histórico
  await dbConn.insert(inventoryMovements).values({
    productId: input.productId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    quantity: input.quantity,
    batch: input.batch || null,
    movementType: input.movementType,
    notes: input.notes || null,
    performedBy: input.performedBy,
    tenantId: input.tenantId || null,
    createdAt: new Date(),
  });

  // Atualizar status dos endereços
  await updateLocationStatus(input.fromLocationId);
  await updateLocationStatus(input.toLocationId);

  return { success: true, message: "Movimentação registrada com sucesso" };
}

/**
 * Atualiza status de um endereço baseado no estoque
 */
async function updateLocationStatus(locationId: number) {
  const dbConn = await getDb();
  if (!dbConn) return;

  const stock = await dbConn
    .select({ total: sql<number>`COALESCE(SUM(${inventory.quantity}), 0)` })
    .from(inventory)
    .where(eq(inventory.locationId, locationId));

  const totalQuantity = Number(stock[0]?.total ?? 0);
  const newStatus = totalQuantity > 0 ? "occupied" : "available";

  await dbConn
    .update(warehouseLocations)
    .set({ status: newStatus })
    .where(eq(warehouseLocations.id, locationId));
}

/**
 * Obtém histórico de movimentações
 */
export async function getMovementHistory(filters?: {
  productId?: number;
  locationId?: number;
  movementType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<any[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];
  if (filters?.productId) {
    conditions.push(eq(inventoryMovements.productId, filters.productId));
  }
  if (filters?.movementType) {
    conditions.push(eq(inventoryMovements.movementType, filters.movementType as any));
  }
  if (filters?.locationId) {
    conditions.push(
      sql`(${inventoryMovements.fromLocationId} = ${filters.locationId} OR ${inventoryMovements.toLocationId} = ${filters.locationId})`
    );
  }

  const fromLocation = warehouseLocations;
  const toLocation = warehouseLocations;

  const results = await dbConn
    .select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      productSku: products.sku,
      productDescription: products.description,
      fromLocationId: inventoryMovements.fromLocationId,
      toLocationId: inventoryMovements.toLocationId,
      quantity: inventoryMovements.quantity,
      batch: inventoryMovements.batch,
      movementType: inventoryMovements.movementType,
      notes: inventoryMovements.notes,
      createdAt: inventoryMovements.createdAt,
      performedByName: systemUsers.fullName,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .leftJoin(systemUsers, eq(inventoryMovements.performedBy, systemUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(filters?.limit || 500);

  return results;
}

/**
 * Obtém produtos disponíveis em um endereço para movimentação
 */
export async function getLocationProducts(locationId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const results = await dbConn
    .select({
      inventoryId: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      quantity: inventory.quantity,
      status: inventory.status,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(eq(inventory.locationId, locationId))
    .orderBy(products.sku);

  return results;
}
