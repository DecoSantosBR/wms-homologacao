/**
 * Testes para agrupamento de itens no stage por SKU+lote
 * Garante que itens com mesmo SKU mas lotes diferentes sejam tratados separadamente
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  tenants,
  products,
  pickingOrders,
  pickingOrderItems,
  stageCheckItems,
} from "../drizzle/schema";
import { startStageCheck } from "./stage";
import { eq } from "drizzle-orm";

describe("Agrupamento de Itens no Stage por SKU+Lote", () => {
  let testTenantId: number;
  let testProductId: number;
  let testPickingOrderId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant - Stage Grouping",
      code: `TEST-STAGE-${Date.now()}`,
      cnpj: "12345678000199",
      active: true,
    });
    testTenantId = Number(tenant.insertId);

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: `SKU-STAGE-${Date.now()}`,
      description: "Test Product - Stage Grouping",
      unitsPerBox: 10,
      unitOfMeasure: "UN",
      status: "active",
      requiresBatchControl: true,
      requiresExpiryControl: true,
    });
    testProductId = Number(product.insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    if (testPickingOrderId) {
      await db.delete(stageCheckItems).where(eq(stageCheckItems.stageCheckId, testPickingOrderId));
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testPickingOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testPickingOrderId));
    }
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve criar itens SEPARADOS para mesmo SKU com lotes diferentes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar pedido de teste
    const orderNum = `ORD-STAGE-${Date.now()}`;
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: orderNum, // ✅ Campo obrigatório
      customerOrderNumber: orderNum,
      customerName: "Test Customer",
      deliveryAddress: "Test Address",
      totalQuantity: 80,
      status: "picked",
      createdBy: 1,
    });
    testPickingOrderId = Number(order.insertId);

    // Criar 2 itens com MESMO SKU mas LOTES DIFERENTES
    await db.insert(pickingOrderItems).values([
      {
        pickingOrderId: testPickingOrderId,
        productId: testProductId,
        requestedQuantity: 50, // 50 unidades
        requestedUM: "unit",
        batch: "LOTE-A123", // ✅ Lote A
        expiryDate: new Date("2025-12-31"),
        status: "picked",
      },
      {
        pickingOrderId: testPickingOrderId,
        productId: testProductId,
        requestedQuantity: 30, // 30 unidades
        requestedUM: "unit",
        batch: "LOTE-B456", // ✅ Lote B (diferente)
        expiryDate: new Date("2025-11-30"),
        status: "picked",
      },
    ]);

    // Iniciar conferência de stage
    const result = await startStageCheck({
      pickingOrderId: testPickingOrderId,
      customerOrderNumber: `ORD-STAGE-${Date.now()}`,
      operatorId: 1,
      tenantId: testTenantId,
    });

    // Buscar itens criados no stageCheckItems
    const stageItems = await db
      .select()
      .from(stageCheckItems)
      .where(eq(stageCheckItems.stageCheckId, result.stageCheckId));

    // ✅ DEVE TER 2 ITENS SEPARADOS (não agrupados)
    expect(stageItems.length).toBe(2);

    // Verificar quantidades individuais
    const item1 = stageItems.find((i) => i.expectedQuantity === 50);
    const item2 = stageItems.find((i) => i.expectedQuantity === 30);

    expect(item1).toBeDefined();
    expect(item2).toBeDefined();
    expect(item1?.productId).toBe(testProductId);
    expect(item2?.productId).toBe(testProductId);
  });

  it("deve agrupar itens com MESMO SKU e MESMO LOTE", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar pedido anterior
    if (testPickingOrderId) {
      await db.delete(stageCheckItems).where(eq(stageCheckItems.stageCheckId, testPickingOrderId));
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testPickingOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testPickingOrderId));
    }

    // Criar novo pedido
    const orderNum2 = `ORD-STAGE-2-${Date.now()}`;
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: orderNum2, // ✅ Campo obrigatório
      customerOrderNumber: orderNum2,
      customerName: "Test Customer",
      deliveryAddress: "Test Address",
      totalQuantity: 80,
      status: "picked",
      createdBy: 1,
    });
    testPickingOrderId = Number(order.insertId);

    // Criar 2 itens com MESMO SKU e MESMO LOTE (devem ser agrupados)
    await db.insert(pickingOrderItems).values([
      {
        pickingOrderId: testPickingOrderId,
        productId: testProductId,
        requestedQuantity: 50,
        requestedUM: "unit",
        batch: "LOTE-A123", // ✅ Mesmo lote
        expiryDate: new Date("2025-12-31"),
        status: "picked",
      },
      {
        pickingOrderId: testPickingOrderId,
        productId: testProductId,
        requestedQuantity: 30,
        requestedUM: "unit",
        batch: "LOTE-A123", // ✅ Mesmo lote (deve agrupar)
        expiryDate: new Date("2025-12-31"),
        status: "picked",
      },
    ]);

    // Iniciar conferência de stage
    const result = await startStageCheck({
      pickingOrderId: testPickingOrderId,
      customerOrderNumber: `ORD-STAGE-2-${Date.now()}`,
      operatorId: 1,
      tenantId: testTenantId,
    });

    // Buscar itens criados no stageCheckItems
    const stageItems = await db
      .select()
      .from(stageCheckItems)
      .where(eq(stageCheckItems.stageCheckId, result.stageCheckId));

    // ✅ DEVE TER 1 ITEM AGRUPADO (50 + 30 = 80)
    expect(stageItems.length).toBe(1);
    expect(stageItems[0].expectedQuantity).toBe(80);
    expect(stageItems[0].productId).toBe(testProductId);
  });

  it("deve funcionar com produtos sem lote (batch null)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar pedido anterior
    if (testPickingOrderId) {
      await db.delete(stageCheckItems).where(eq(stageCheckItems.stageCheckId, testPickingOrderId));
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testPickingOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testPickingOrderId));
    }

    // Criar novo pedido
    const orderNum3 = `ORD-STAGE-3-${Date.now()}`;
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: orderNum3, // ✅ Campo obrigatório
      customerOrderNumber: orderNum3,
      customerName: "Test Customer",
      deliveryAddress: "Test Address",
      totalQuantity: 50,
      status: "picked",
      createdBy: 1,
    });
    testPickingOrderId = Number(order.insertId);

    // Criar item sem lote
    await db.insert(pickingOrderItems).values({
      pickingOrderId: testPickingOrderId,
      productId: testProductId,
      requestedQuantity: 50,
      requestedUM: "unit",
      batch: null, // ✅ Sem lote
      status: "picked",
    });

    // Iniciar conferência de stage
    const result = await startStageCheck({
      pickingOrderId: testPickingOrderId,
      customerOrderNumber: `ORD-STAGE-3-${Date.now()}`,
      operatorId: 1,
      tenantId: testTenantId,
    });

    // Buscar itens criados no stageCheckItems
    const stageItems = await db
      .select()
      .from(stageCheckItems)
      .where(eq(stageCheckItems.stageCheckId, result.stageCheckId));

    // ✅ DEVE FUNCIONAR NORMALMENTE
    expect(stageItems.length).toBe(1);
    expect(stageItems[0].expectedQuantity).toBe(50);
  });
});
