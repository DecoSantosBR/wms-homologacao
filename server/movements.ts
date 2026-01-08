import { eq, and, sum } from "drizzle-orm";
import { getDb } from "./db";
import {
  inventory,
  inventoryMovements,
  warehouseLocations,
} from "../drizzle/schema";

export interface RegisterMovementInput {
  productId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  batch?: string;
  expiryDate?: Date;
  movementType: "transfer" | "adjustment" | "return" | "disposal" | "put_away";
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
    .select({ total: sum(inventory.quantity) })
    .from(inventory)
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : undefined
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
        input.batch ? eq(inventory.batch, input.batch) : undefined
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
        input.batch ? eq(inventory.batch, input.batch) : undefined
      )
    )
    .limit(1);

  if (toInventory[0]) {
    // Incrementar quantidade existente
    await dbConn
      .update(inventory)
      .set({ quantity: toInventory[0].quantity + input.quantity })
      .where(eq(inventory.id, toInventory[0].id));
  } else {
    // Criar novo registro
    await dbConn.insert(inventory).values({
      tenantId: input.tenantId || null,
      productId: input.productId,
      locationId: input.toLocationId,
      batch: input.batch || null,
      expiryDate: input.expiryDate || null,
      quantity: input.quantity,
      status: "available",
    });
  }

  // Registrar movimentação
  await dbConn.insert(inventoryMovements).values({
    tenantId: input.tenantId || null,
    productId: input.productId,
    batch: input.batch || null,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    quantity: input.quantity,
    movementType: input.movementType,
    performedBy: input.performedBy,
  });

  // Atualizar status dos endereços
  await updateLocationStatus(dbConn, input.fromLocationId);
  await updateLocationStatus(dbConn, input.toLocationId);

  return { success: true, message: "Movimentação registrada com sucesso" };
}

/**
 * Atualiza status do endereço baseado no saldo
 */
async function updateLocationStatus(dbConn: any, locationId: number) {
  const stockSum = await dbConn
    .select({ total: sum(inventory.quantity) })
    .from(inventory)
    .where(eq(inventory.locationId, locationId));

  const totalQuantity = Number(stockSum[0]?.total ?? 0);

  await dbConn
    .update(warehouseLocations)
    .set({
      status: totalQuantity > 0 ? "occupied" : "available",
    })
    .where(eq(warehouseLocations.id, locationId));
}
