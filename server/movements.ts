import { eq, and, sum, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  inventory,
  inventoryMovements,
  warehouseLocations,
  products,
  systemUsers,
  receivingPreallocations,
  pickingReservations,
} from "../drizzle/schema";

export interface RegisterMovementInput {
  productId: number;
  fromLocationId: number;
  toLocationId?: number; // Opcional para descarte
  quantity: number;
  batch?: string;
  movementType: "transfer" | "adjustment" | "return" | "disposal" | "quality";
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

  // Buscar tenantId do endereço de origem se não fornecido
  let tenantId = input.tenantId;
  if (tenantId === null || tenantId === undefined) {
    const fromLocation = await dbConn
      .select({ tenantId: warehouseLocations.tenantId })
      .from(warehouseLocations)
      .where(eq(warehouseLocations.id, input.fromLocationId))
      .limit(1);
    
    if (fromLocation[0]?.tenantId) {
      tenantId = fromLocation[0].tenantId;
    } else {
      // Se ainda não tiver tenantId, buscar do inventory
      const inventoryRecord = await dbConn
        .select({ tenantId: inventory.tenantId })
        .from(inventory)
        .where(
          and(
            eq(inventory.locationId, input.fromLocationId),
            eq(inventory.productId, input.productId)
          )
        )
        .limit(1);
      
      if (inventoryRecord[0]?.tenantId) {
        tenantId = inventoryRecord[0].tenantId;
      } else {
        throw new Error('Não foi possível determinar o cliente (tenantId) para esta movimentação. Verifique o cadastro do endereço e do produto.');
      }
    }
  }

  // FASE 1: VALIDAÇÕES (sem modificar dados)

  // Validar saldo disponível na origem (considerando reservas)
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

  const totalQuantity = Number(fromStock[0]?.total ?? 0);

  // Calcular quantidade reservada para picking
  const reservedStock = await dbConn
    .select({ total: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)` })
    .from(pickingReservations)
    .innerJoin(inventory, eq(pickingReservations.inventoryId, inventory.id))
    .where(
      and(
        eq(inventory.locationId, input.fromLocationId),
        eq(inventory.productId, input.productId),
        input.batch ? eq(inventory.batch, input.batch) : sql`1=1`
      )
    );

  const reservedQuantity = Number(reservedStock[0]?.total ?? 0);
  const availableQuantity = totalQuantity - reservedQuantity;

  if (availableQuantity < input.quantity) {
    throw new Error(
      `Saldo insuficiente. Total: ${totalQuantity}, Reservado: ${reservedQuantity}, Disponível: ${availableQuantity}, Solicitado: ${input.quantity}`
    );
  }

  // Validar regra de armazenagem do endereço destino (exceto para descarte)
  if (input.movementType !== "disposal") {
    if (!input.toLocationId) {
      throw new Error("Endereço destino é obrigatório para este tipo de movimentação");
    }

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
        .where(
          and(
            eq(inventory.locationId, input.toLocationId),
            sql`${inventory.quantity} > 0` // Ignorar registros com quantity=0
          )
        )
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

    // ✅ VALIDAÇÃO DE MÚTIPLOS LOTES (MOVIDA PARA FASE 1)
    // Verificar se endereço pode receber este lote (zonas especiais vs storage)
    const { validateLocationForBatch } = await import("./locationValidation");
    const validation = await validateLocationForBatch(
      input.toLocationId,
      input.productId,
      input.batch || null
    );

    if (!validation.allowed) {
      throw new Error(validation.reason || "Endereço não pode receber este lote");
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

  // Adicionar estoque ao destino (exceto para descarte)
  if (input.movementType !== "disposal" && input.toLocationId) {
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
      // Criar novo registro (validação já foi feita na FASE 1)
      await dbConn.insert(inventory).values({
        productId: input.productId,
        locationId: input.toLocationId,
        batch: input.batch || null,
        quantity: input.quantity,
        expiryDate: fromInventory[0]?.expiryDate || null,
        status: "available",
        tenantId: tenantId || null,
      });
    }
  }

  // Registrar movimentação no histórico
  await dbConn.insert(inventoryMovements).values({
    productId: input.productId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId || null,
    quantity: input.quantity,
    batch: input.batch || null,
    movementType: input.movementType,
    notes: input.notes || null,
    performedBy: input.performedBy,
    tenantId: tenantId || null,
    createdAt: new Date(),
  });

  // Atualizar status dos endereços
  await updateLocationStatus(input.fromLocationId);
  if (input.toLocationId) {
    await updateLocationStatus(input.toLocationId);
  }

  // Atualizar status da pré-alocação (se houver e se não for descarte)
  if (input.toLocationId) {
    await dbConn
      .update(receivingPreallocations)
      .set({ status: "allocated" })
      .where(
        and(
          eq(receivingPreallocations.productId, input.productId),
          eq(receivingPreallocations.locationId, input.toLocationId),
          input.batch 
            ? eq(receivingPreallocations.batch, input.batch)
            : sql`${receivingPreallocations.batch} IS NULL`,
          eq(receivingPreallocations.status, "pending")
        )
      )
      .limit(1);
  }

  return { success: true, message: "Movimentação registrada com sucesso" };
}

/**
 * Atualiza status de um endereço baseado no estoque
 * 
 * Lógica de status:
 * - Livre: sem produtos alocados
 * - Disponível: com produtos, mas aceita mais (multi-item)
 * - Ocupado: com produtos e não aceita mais (single-item)
 */
async function updateLocationStatus(locationId: number) {
  const dbConn = await getDb();
  if (!dbConn) return;

  // Buscar informações do endereço
  const [location] = await dbConn
    .select({
      storageRule: warehouseLocations.storageRule,
      currentStatus: warehouseLocations.status,
    })
    .from(warehouseLocations)
    .where(eq(warehouseLocations.id, locationId))
    .limit(1);

  if (!location) return;

  // Calcular quantidade total de produtos no endereço
  const stock = await dbConn
    .select({ total: sql<number>`COALESCE(SUM(${inventory.quantity}), 0)` })
    .from(inventory)
    .where(eq(inventory.locationId, locationId));

  const totalQuantity = Number(stock[0]?.total ?? 0);

  // Determinar novo status
  let newStatus: "livre" | "available" | "occupied" | "blocked" | "counting";

  if (totalQuantity === 0) {
    // Sem produtos = Livre
    newStatus = "livre";
  } else if (location.storageRule === "multi") {
    // Com produtos + multi-item = Disponível (aceita mais produtos)
    newStatus = "available";
  } else {
    // Com produtos + single-item = Ocupado (não aceita mais)
    newStatus = "occupied";
  }

  // Preservar status especiais (blocked, counting)
  if (location.currentStatus === "blocked" || location.currentStatus === "counting") {
    return; // Não alterar status especiais automaticamente
  }

  // Atualizar status apenas se mudou
  if (location.currentStatus !== newStatus) {
    await dbConn
      .update(warehouseLocations)
      .set({ status: newStatus })
      .where(eq(warehouseLocations.id, locationId));
  }
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

  const results = await dbConn
    .select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      productSku: products.sku,
      productDescription: products.description,
      fromLocationId: inventoryMovements.fromLocationId,
      fromLocationCode: sql<string>`fromLoc.code`,
      toLocationId: inventoryMovements.toLocationId,
      toLocationCode: sql<string>`toLoc.code`,
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
    .leftJoin(sql`${warehouseLocations} as fromLoc`, sql`fromLoc.id = ${inventoryMovements.fromLocationId}`)
    .leftJoin(sql`${warehouseLocations} as toLoc`, sql`toLoc.id = ${inventoryMovements.toLocationId}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(filters?.limit || 500);

  return results;
}

/**
 * Obtém produtos disponíveis em um endereço para movimentação
 * Calcula quantidade disponível (total - reservado)
 */
export async function getLocationProducts(locationId: number, tenantId?: number | null) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");
  
  let whereConditions = [eq(inventory.locationId, locationId)];
  
  // Aplicar filtro de tenantId se fornecido
  if (tenantId !== undefined && tenantId !== null) {
    whereConditions.push(eq(products.tenantId, tenantId));
  }
  
  const results = await dbConn
    .select({
      inventoryId: inventory.id,
      productId: inventory.productId,
      productSku: products.sku,
      productDescription: products.description,
      batch: inventory.batch,
      expiryDate: inventory.expiryDate,
      totalQuantity: inventory.quantity,
      reservedQuantity: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)`,
      status: inventory.status,
      tenantId: products.tenantId,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .leftJoin(pickingReservations, eq(pickingReservations.inventoryId, inventory.id))
    .where(and(...whereConditions))
    .groupBy(
      inventory.id,
      inventory.productId,
      products.sku,
      products.description,
      inventory.batch,
      inventory.expiryDate,
      inventory.quantity,
      inventory.status,
      products.tenantId
    )
    .orderBy(products.sku);
  
  // Calcular quantidade disponível para cada item
  return results.map(item => ({
    ...item,
    quantity: item.totalQuantity - item.reservedQuantity, // Disponível = Total - Reservado
  }));
}
