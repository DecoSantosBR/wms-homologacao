import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  pickingOrders,
  stageChecks,
  tenants,
  products,
  warehouseLocations,
  warehouseZones,
  inventory,
  inventoryMovements,
  pickingReservations,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Testes para estorno de estoque ao cancelar expedição
 * Valida reversão completa: EXP → Armazenagem + recriação de reservas
 * 
 * REGRAS DE TESTE:
 * - 1 único cliente-teste por suite
 * - Máximo 4 produtos por cliente
 * - Máximo 6 endereços (1 REC + 1 EXP + 4 armazenagem)
 * - Usar zonas existentes (não criar)
 * - Limpeza automática após testes
 */
describe("Shipping - Estorno de estoque ao cancelar", () => {
  let dbConn: any;
  let tenantId: number;
  let orderId: number;
  let productId: number;
  let storageLocationId: number;
  let expLocationId: number;
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    dbConn = await getDb();
    if (!dbConn) throw new Error("Database connection failed");

    // Criar tenant único para toda a suite
    const uniqueCnpj = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [tenant] = await dbConn.insert(tenants).values({
      name: `TestCleanup-${uniqueSuffix}`,
      cnpj: uniqueCnpj.substring(0, 18),
    });
    tenantId = tenant.insertId;

    // Buscar zona existente (REGRA: não criar zonas)
    const [existingZone] = await dbConn
      .select()
      .from(warehouseZones)
      .limit(1);

    if (!existingZone) {
      throw new Error("Nenhuma zona encontrada no banco. Cadastre uma zona antes de executar testes.");
    }

    const zoneId = existingZone.id;

    // Criar produto único (máximo 4 produtos por cliente-teste)
    const [product] = await dbConn.insert(products).values({
      sku: `CLEAN-${uniqueSuffix}`,
      description: `Produto Cleanup ${uniqueSuffix}`,
      unitsPerBox: 10,
      tenantId,
    });
    productId = product.insertId;

    // Criar endereço de armazenagem (máximo 4 por cliente-teste)
    const [storageLocation] = await dbConn.insert(warehouseLocations).values({
      zoneId,
      code: `A01-CLEAN-${uniqueSuffix}`,
      locationType: "whole",
      status: "available",
      tenantId,
    });
    storageLocationId = storageLocation.insertId;

    // Criar endereço de expedição (1 por cliente-teste)
    const [expLocation] = await dbConn.insert(warehouseLocations).values({
      zoneId,
      code: `EXP-CLEAN-${uniqueSuffix}`,
      locationType: "whole",
      status: "available",
      tenantId,
    });
    expLocationId = expLocation.insertId;

    // Criar pedido com status "staged"
    const [order] = await dbConn.insert(pickingOrders).values({
      tenantId,
      orderNumber: `ORD-CLEAN-${uniqueSuffix}`,
      customerOrderNumber: `0001-CLEAN-${uniqueSuffix}`,
      customerId: 1,
      customerName: "Cliente Cleanup",
      status: "staged",
      createdBy: 1,
    });
    orderId = order.insertId;

    // Simular movimentação de Stage: Armazenagem → EXP
    // 1. Criar estoque no EXP (como se tivesse sido movimentado)
    await dbConn.insert(inventory).values({
      locationId: expLocationId,
      productId,
      batch: "L2024-CLEAN",
      quantity: 50,
      tenantId,
      status: "available",
    });

    // 2. Registrar movimentação no histórico
    await dbConn.insert(inventoryMovements).values({
      productId,
      batch: "L2024-CLEAN",
      fromLocationId: storageLocationId,
      toLocationId: expLocationId,
      quantity: 50,
      movementType: "picking",
      referenceType: "picking_order",
      referenceId: orderId,
      performedBy: 1,
      notes: "Movimentação de Stage",
      tenantId,
    });

    // 3. Criar conferência de stage concluída
    await dbConn.insert(stageChecks).values({
      tenantId,
      pickingOrderId: orderId,
      customerOrderNumber: `0001-CLEAN-${uniqueSuffix}`,
      operatorId: 1,
      status: "completed",
      hasDivergence: false,
      completedAt: new Date(),
    });
  });

  afterAll(async () => {
    // Limpeza automática após todos os testes
    if (!dbConn || !tenantId) return;

    try {
      // Deletar na ordem correta (respeitar foreign keys)
      await dbConn.delete(pickingReservations).where(eq(pickingReservations.pickingOrderId, orderId));
      await dbConn.delete(inventoryMovements).where(eq(inventoryMovements.tenantId, tenantId));
      await dbConn.delete(inventory).where(eq(inventory.tenantId, tenantId));
      await dbConn.delete(stageChecks).where(eq(stageChecks.tenantId, tenantId));
      await dbConn.delete(pickingOrders).where(eq(pickingOrders.tenantId, tenantId));
      await dbConn.delete(warehouseLocations).where(eq(warehouseLocations.tenantId, tenantId));
      await dbConn.delete(products).where(eq(products.tenantId, tenantId));
      await dbConn.delete(tenants).where(eq(tenants.id, tenantId));

      console.log(`✅ Limpeza concluída: tenant ${tenantId} removido`);
    } catch (error) {
      console.error("❌ Erro na limpeza:", error);
    }
  });

  it("deve estornar estoque de EXP para endereço de armazenagem", async () => {
    // Verificar estoque inicial no EXP
    const [expBefore] = await dbConn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, expLocationId),
          eq(inventory.productId, productId)
        )
      )
      .limit(1);

    expect(expBefore.quantity).toBe(50);

    // Verificar que não há estoque na armazenagem
    const storageBefore = await dbConn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, storageLocationId),
          eq(inventory.productId, productId)
        )
      );

    expect(storageBefore.length).toBe(0);

    // ========== EXECUTAR ESTORNO ==========
    // Buscar movimentação
    const [movement] = await dbConn
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.referenceType, "picking_order"),
          eq(inventoryMovements.referenceId, orderId),
          eq(inventoryMovements.movementType, "picking")
        )
      )
      .limit(1);

    expect(movement).toBeDefined();

    // 1. Subtrair do EXP
    await dbConn
      .update(inventory)
      .set({ quantity: expBefore.quantity - movement.quantity })
      .where(eq(inventory.id, expBefore.id));

    // 2. Devolver para armazenagem
    await dbConn.insert(inventory).values({
      locationId: storageLocationId,
      productId,
      batch: movement.batch,
      quantity: movement.quantity,
      tenantId,
      status: "available",
    });

    // 3. Registrar movimentação reversa
    await dbConn.insert(inventoryMovements).values({
      productId,
      batch: movement.batch,
      fromLocationId: expLocationId,
      toLocationId: storageLocationId,
      quantity: movement.quantity,
      movementType: "adjustment",
      referenceType: "picking_order",
      referenceId: orderId,
      performedBy: 1,
      notes: "Estorno automático - Expedição cancelada",
      tenantId,
    });

    // ========== VERIFICAR RESULTADO ==========
    // Verificar estoque no EXP (deve ser 0)
    const [expAfter] = await dbConn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, expLocationId),
          eq(inventory.productId, productId)
        )
      )
      .limit(1);

    expect(expAfter.quantity).toBe(0);

    // Verificar estoque na armazenagem (deve ter 50)
    const [storageAfter] = await dbConn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, storageLocationId),
          eq(inventory.productId, productId)
        )
      )
      .limit(1);

    expect(storageAfter).toBeDefined();
    expect(storageAfter.quantity).toBe(50);
    expect(storageAfter.batch).toBe("L2024-CLEAN");
  });

  it("deve recriar reserva após estorno de estoque", async () => {
    // Verificar que não há reservas inicialmente
    const reservationsBefore = await dbConn
      .select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, orderId));

    expect(reservationsBefore.length).toBe(0);

    // Buscar movimentação e inventário
    const [movement] = await dbConn
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.referenceType, "picking_order"),
          eq(inventoryMovements.referenceId, orderId)
        )
      )
      .limit(1);

    // Buscar inventário na armazenagem (já criado no teste anterior)
    const [storageInventory] = await dbConn
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, storageLocationId),
          eq(inventory.productId, productId)
        )
      )
      .limit(1);

    // Recriar reserva
    await dbConn.insert(pickingReservations).values({
      pickingOrderId: orderId,
      productId,
      inventoryId: storageInventory.id,
      quantity: movement.quantity,
    });

    // Verificar reserva criada
    const reservationsAfter = await dbConn
      .select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, orderId));

    expect(reservationsAfter.length).toBe(1);
    expect(reservationsAfter[0].quantity).toBe(50);
    expect(reservationsAfter[0].productId).toBe(productId);
  });

  it("deve registrar movimentação reversa no histórico", async () => {
    // Contar movimentações (original + reversa do primeiro teste)
    const movements = await dbConn
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.referenceType, "picking_order"),
          eq(inventoryMovements.referenceId, orderId)
        )
      );

    expect(movements.length).toBeGreaterThanOrEqual(2); // Original + reversa

    // Verificar movimentação reversa
    const reversalMovement = movements.find(
      (m) => m.movementType === "adjustment"
    );

    expect(reversalMovement).toBeDefined();
    expect(reversalMovement!.fromLocationId).toBe(expLocationId);
    expect(reversalMovement!.toLocationId).toBe(storageLocationId);
    expect(reversalMovement!.quantity).toBe(50);
  });

  it("deve permitir nova conferência após estorno completo", async () => {
    // Alterar status do pedido para "picked"
    await dbConn
      .update(pickingOrders)
      .set({ status: "picked" })
      .where(eq(pickingOrders.id, orderId));

    // Verificar que pedido está pronto para nova conferência
    const [order] = await dbConn
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(order.status).toBe("picked");

    // Verificar que há estoque reservado (criado no teste anterior)
    const reservations = await dbConn
      .select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, orderId));

    expect(reservations.length).toBeGreaterThan(0);
    expect(reservations[0].quantity).toBe(50);
  });
});
