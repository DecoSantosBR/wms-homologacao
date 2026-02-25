import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { pickingOrders, pickingOrderItems, products, stageChecks, stageCheckItems, inventory, tenants, labelAssociations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getOrderForStage, startStageCheck, recordStageItem, completeStageCheck } from "./stage";

describe("Stage (Conferência de Expedição)", () => {
  let testTenantId: number;
  let testProductId: number;
  let testPickingOrderId: number;
  let testCustomerOrderNumber: string;
  let testLabelCode: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Buscar tenant de teste
    const tenantsResult = await db.select().from(tenants).limit(1);
    testTenantId = tenantsResult[0]?.id || 1;

    // Buscar produto de teste
    const productsResult = await db.select().from(products).where(eq(products.tenantId, testTenantId)).limit(1);
    if (productsResult.length === 0) {
      throw new Error("Nenhum produto encontrado para teste");
    }
    testProductId = productsResult[0].id;

    // Criar pedido de teste com status 'picked' (pronto para stage)
    testCustomerOrderNumber = `TEST-STAGE-${Date.now()}`;
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `ORD-${Date.now()}`,
      customerOrderNumber: testCustomerOrderNumber,
      status: "picked",
      priority: "normal",
      totalItems: 1,
      totalQuantity: 100,
      createdBy: 1,
    });

    testPickingOrderId = Number(order.insertId);

    // Criar item do pedido
    await db.insert(pickingOrderItems).values({
      pickingOrderId: testPickingOrderId,
      productId: testProductId,
      requestedQuantity: 100,
      requestedUM: "unit",
      status: "picked",
    });

    // Criar etiqueta de teste (labelAssociation)
    testLabelCode = `TEST-LABEL-${Date.now()}`;
    await db.insert(labelAssociations).values({
      sessionId: 1, // Session ID fictício para teste
      labelCode: testLabelCode,
      productId: testProductId,
      batch: "LOTE-TEST-001",
      unitsPerPackage: 1, // 1 unidade por embalagem para teste
      packagesRead: 100, // 100 embalagens lidas
      totalUnits: 100, // Total de 100 unidades
      associatedBy: 1,
    });
  });

  it("deve buscar pedido por customerOrderNumber com status 'picked'", async () => {
    const result = await getOrderForStage(testCustomerOrderNumber, testTenantId);

    expect(result).toBeDefined();
    expect(result.order).toBeDefined();
    expect(result.order.customerOrderNumber).toBe(testCustomerOrderNumber);
    expect(result.order.status).toBe("picked");
    expect(result.items).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("deve iniciar conferência de Stage", async () => {
    const result = await startStageCheck({
      pickingOrderId: testPickingOrderId,
      customerOrderNumber: testCustomerOrderNumber,
      operatorId: 1,
      tenantId: testTenantId,
    });

    expect(result).toBeDefined();
    expect(result.stageCheckId).toBeDefined();
    expect(result.customerOrderNumber).toBe(testCustomerOrderNumber);
    expect(result.message).toContain("Conferência iniciada");

    // Verificar se registros foram criados
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const checks = await db
      .select()
      .from(stageChecks)
      .where(eq(stageChecks.id, result.stageCheckId))
      .limit(1);

    expect(checks.length).toBe(1);
    expect(checks[0].status).toBe("in_progress");

    const items = await db
      .select()
      .from(stageCheckItems)
      .where(eq(stageCheckItems.stageCheckId, result.stageCheckId));

    expect(items.length).toBeGreaterThan(0);
  });

  it("deve registrar item conferido", async () => {
    // Buscar conferência ativa
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const activeChecks = await db
      .select()
      .from(stageChecks)
      .where(
        and(
          eq(stageChecks.pickingOrderId, testPickingOrderId),
          eq(stageChecks.status, "in_progress")
        )
      )
      .limit(1);

    if (activeChecks.length === 0) {
      throw new Error("Nenhuma conferência ativa encontrada para teste");
    }

    const stageCheckId = activeChecks[0].id;

    // Registrar item usando etiqueta de teste
    const result = await recordStageItem({
      stageCheckId,
      labelCode: testLabelCode,
      quantity: 50,
      tenantId: testTenantId,
    });

    expect(result).toBeDefined();
    expect(result.labelCode).toBe(testLabelCode);
    expect(result.checkedQuantity).toBe(50);
    expect(result.message).toContain("registrada");

    // Verificar se quantidade foi atualizada
    const items = await db
      .select()
      .from(stageCheckItems)
      .where(
        and(
          eq(stageCheckItems.stageCheckId, stageCheckId),
          eq(stageCheckItems.productId, testProductId)
        )
      )
      .limit(1);

    expect(items[0].checkedQuantity).toBe(50);
  });

  it("deve detectar divergências ao finalizar conferência", async () => {
    // Buscar conferência ativa
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const activeChecks = await db
      .select()
      .from(stageChecks)
      .where(
        and(
          eq(stageChecks.pickingOrderId, testPickingOrderId),
          eq(stageChecks.status, "in_progress")
        )
      )
      .limit(1);

    if (activeChecks.length === 0) {
      throw new Error("Nenhuma conferência ativa encontrada para teste");
    }

    const stageCheckId = activeChecks[0].id;

    // Tentar finalizar com divergência (esperado: 100, conferido: 50)
    try {
      await completeStageCheck({
        stageCheckId,
        tenantId: testTenantId,
      });
      throw new Error("Deveria ter lançado erro de divergência");
    } catch (error: any) {
      expect(error.message).toContain("Divergências encontradas");
      // A estrutura do erro pode variar, verificar se tem divergências de alguma forma
      const hasDivergentItems = error.data?.cause?.divergentItems || error.cause?.divergentItems;
      expect(hasDivergentItems).toBeDefined();
      expect(hasDivergentItems.length).toBeGreaterThan(0);
    }

    // Verificar se status foi atualizado para divergent
    const checks = await db
      .select()
      .from(stageChecks)
      .where(eq(stageChecks.id, stageCheckId))
      .limit(1);

    expect(checks[0].status).toBe("divergent");
    expect(checks[0].hasDivergence).toBe(true);
  });

  it("deve finalizar conferência sem divergências e baixar estoque", async () => {
    // Criar novo pedido para teste de finalização sem divergências
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const newOrderNumber = `TEST-STAGE-OK-${Date.now()}`;
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `ORD-${Date.now()}`,
      customerOrderNumber: newOrderNumber,
      status: "picked",
      priority: "normal",
      totalItems: 1,
      totalQuantity: 50,
      createdBy: 1,
    });

    const newOrderId = Number(order.insertId);

    // Criar item
    await db.insert(pickingOrderItems).values({
      pickingOrderId: newOrderId,
      productId: testProductId,
      requestedQuantity: 50,
      requestedUM: "unit",
      status: "picked",
    });

    // Criar estoque e reserva para teste
    const [inv] = await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: 1,
      quantity: 50,
      status: "available",
    });

    await db.insert(pickingReservations).values({
      pickingOrderId: newOrderId,
      productId: testProductId,
      inventoryId: Number(inv.insertId),
      quantity: 50,
    });

    // Iniciar conferência
    const checkResult = await startStageCheck({
      pickingOrderId: newOrderId,
      customerOrderNumber: newOrderNumber,
      operatorId: 1,
      tenantId: testTenantId,
    });

    // Registrar quantidade correta usando etiqueta de teste
    await recordStageItem({
      stageCheckId: checkResult.stageCheckId,
      labelCode: testLabelCode,
      quantity: 50,
      tenantId: testTenantId,
    });

    // Finalizar conferência
    const result = await completeStageCheck({
      stageCheckId: checkResult.stageCheckId,
      tenantId: testTenantId,
    });

    expect(result).toBeDefined();
    expect(result.message).toContain("sucesso");

    // Verificar se status foi atualizado
    const checks = await db
      .select()
      .from(stageChecks)
      .where(eq(stageChecks.id, checkResult.stageCheckId))
      .limit(1);

    expect(checks[0].status).toBe("completed");
    expect(checks[0].hasDivergence).toBe(false);

    // Verificar se pedido foi atualizado para 'staged'
    const orders = await db
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, newOrderId))
      .limit(1);

    expect(orders[0].status).toBe("staged");

    // Verificar se estoque foi baixado
    const inventoryResult = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, Number(inv.insertId)))
      .limit(1);

    expect(inventoryResult[0].quantity).toBe(0);

    // Verificar se reserva foi removida
    const reservations = await db
      .select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, newOrderId));

    expect(reservations.length).toBe(0);
  });
});
