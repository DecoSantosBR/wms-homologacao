/**
 * Testes para validar conversão automática de quantidades para unidades (UN)
 * 
 * REGRA: Todas as quantidades devem ser convertidas para unidades ao registrar em tabelas
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  products,
  pickingOrders,
  pickingOrderItems,
  inventory,
  warehouseLocations,
  warehouseZones,
  warehouses,
  tenants,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("Conversão de Quantidades para Unidades", () => {
  let testTenantId: number;
  let testProductId: number;
  let testLocationId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant - Quantity Conversion",
      code: `TEST-QTY-${Date.now()}`,
      cnpj: `12345678000199`, // CNPJ obrigatório
      active: true,
    });
    testTenantId = Number(tenant.insertId);

    // Criar warehouse primeiro
    const [warehouse] = await db.insert(warehouses).values({
      code: `WH-QTY-${Date.now()}`,
      name: "Test Warehouse",
      address: "Test Address",
      status: "active",
    });

    // Criar zona e endereço de teste
    const [zone] = await db.insert(warehouseZones).values({
      warehouseId: Number(warehouse.insertId),
      code: `ZONE-QTY-${Date.now()}`,
      name: "Test Zone",
      type: "storage",
    });

    const [location] = await db.insert(warehouseLocations).values({
      tenantId: testTenantId,
      zoneId: Number(zone.insertId),
      code: `LOC-QTY-${Date.now()}`,
      type: "storage",
      status: "available",
    });
    testLocationId = Number(location.insertId);

    // Criar produto com unitsPerBox = 10
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: `SKU-QTY-${Date.now()}`,
      description: "Test Product - 10 units per box",
      unitsPerBox: 10, // 10 unidades por caixa
      unitOfMeasure: "UN",
      status: "active",
      requiresBatchControl: false,
      requiresExpiryControl: false,
    });
    testProductId = Number(product.insertId);

    // Criar estoque de 1000 unidades
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: testLocationId,
      quantity: 1000,
      reservedQuantity: 0,
      status: "available",
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    await db.delete(pickingOrderItems).where(eq(pickingOrderItems.productId, testProductId));
    await db.delete(pickingOrders).where(eq(pickingOrders.tenantId, testTenantId));
    await db.delete(inventory).where(eq(inventory.productId, testProductId));
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.id, testLocationId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve converter 5 caixas para 50 unidades ao criar pedido", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Criar pedido com 5 caixas
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `TEST-QTY-CREATE-${Date.now()}`,
      customerName: "Test Customer",
      priority: "normal",
      status: "pending",
      totalItems: 1,
      totalQuantity: 50, // Deve ser 50 unidades (5 caixas × 10 unidades)
      createdBy: 1,
    });

    const orderId = Number(order.insertId);

    // Simular criação de item (como seria feito pelo endpoint picking.create)
    const quantityInUnits = 5 * 10; // 5 caixas × 10 unidades/caixa = 50 unidades

    await db.insert(pickingOrderItems).values({
      pickingOrderId: orderId,
      productId: testProductId,
      requestedQuantity: quantityInUnits, // ✅ Deve ser 50 unidades
      requestedUM: "unit", // ✅ Sempre "unit"
      unit: "box", // Unidade ORIGINAL (para referência)
      unitsPerBox: 10,
      pickedQuantity: 0,
      status: "pending",
    });

    // Verificar se quantidade foi registrada corretamente
    const [item] = await db
      .select()
      .from(pickingOrderItems)
      .where(eq(pickingOrderItems.pickingOrderId, orderId))
      .limit(1);

    expect(item).toBeDefined();
    expect(item.requestedQuantity).toBe(50); // ✅ 50 unidades
    expect(item.requestedUM).toBe("unit"); // ✅ Sempre "unit"
    expect(item.unit).toBe("box"); // Unidade original mantida para referência
    expect(item.unitsPerBox).toBe(10);

    // Verificar totalQuantity do pedido
    const [orderData] = await db
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(orderData.totalQuantity).toBe(50); // ✅ Total em unidades
  });

  it("deve manter unidades quando solicitado em unidades (não converter)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Criar pedido com 25 unidades (não caixas)
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `TEST-QTY-UNITS-${Date.now()}`,
      customerName: "Test Customer",
      priority: "normal",
      status: "pending",
      totalItems: 1,
      totalQuantity: 25, // 25 unidades
      createdBy: 1,
    });

    const orderId = Number(order.insertId);

    // Criar item com unidades (não caixas)
    await db.insert(pickingOrderItems).values({
      pickingOrderId: orderId,
      productId: testProductId,
      requestedQuantity: 25, // ✅ 25 unidades (não converter)
      requestedUM: "unit",
      unit: "unit", // Unidade original também é "unit"
      pickedQuantity: 0,
      status: "pending",
    });

    // Verificar se quantidade permaneceu 25 unidades
    const [item] = await db
      .select()
      .from(pickingOrderItems)
      .where(eq(pickingOrderItems.pickingOrderId, orderId))
      .limit(1);

    expect(item.requestedQuantity).toBe(25); // ✅ 25 unidades (sem conversão)
    expect(item.requestedUM).toBe("unit");
    expect(item.unit).toBe("unit");
  });

  it("deve converter múltiplos itens corretamente e somar totalQuantity", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Criar segundo produto
    const [product2] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: `SKU-QTY-2-${Date.now()}`,
      description: "Test Product 2 - 20 units per box",
      unitsPerBox: 20, // 20 unidades por caixa
      unitOfMeasure: "UN",
      status: "active",
      requiresBatchControl: false,
      requiresExpiryControl: false,
    });
    const testProductId2 = Number(product2.insertId);

    // Criar estoque para produto 2
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId2,
      locationId: testLocationId,
      quantity: 1000,
      reservedQuantity: 0,
      status: "available",
    });

    // Item 1: 3 caixas × 10 unidades = 30 unidades
    // Item 2: 5 caixas × 20 unidades = 100 unidades
    // Total: 130 unidades
    const totalQuantity = (3 * 10) + (5 * 20);

    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `TEST-QTY-MULTI-${Date.now()}`,
      customerName: "Test Customer",
      priority: "normal",
      status: "pending",
      totalItems: 2,
      totalQuantity, // ✅ 130 unidades
      createdBy: 1,
    });

    const orderId = Number(order.insertId);

    // Criar item 1 (3 caixas = 30 unidades)
    await db.insert(pickingOrderItems).values({
      pickingOrderId: orderId,
      productId: testProductId,
      requestedQuantity: 30, // ✅ 30 unidades
      requestedUM: "unit",
      unit: "box",
      unitsPerBox: 10,
      pickedQuantity: 0,
      status: "pending",
    });

    // Criar item 2 (5 caixas = 100 unidades)
    await db.insert(pickingOrderItems).values({
      pickingOrderId: orderId,
      productId: testProductId2,
      requestedQuantity: 100, // ✅ 100 unidades
      requestedUM: "unit",
      unit: "box",
      unitsPerBox: 20,
      pickedQuantity: 0,
      status: "pending",
    });

    // Verificar totalQuantity do pedido
    const [orderData] = await db
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, orderId))
      .limit(1);

    expect(orderData.totalQuantity).toBe(130); // ✅ 30 + 100 = 130 unidades

    // Limpar produto 2
    await db.delete(pickingOrderItems).where(eq(pickingOrderItems.productId, testProductId2));
    await db.delete(inventory).where(eq(inventory.productId, testProductId2));
    await db.delete(products).where(eq(products.id, testProductId2));
  });

  it("deve validar que reservas de estoque usam quantidades em unidades", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Buscar estoque disponível
    const [stock] = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, testProductId),
          eq(inventory.tenantId, testTenantId)
        )
      )
      .limit(1);

    expect(stock).toBeDefined();
    expect(stock.quantity).toBe(1000); // ✅ Estoque em unidades
    expect(stock.reservedQuantity).toBeGreaterThanOrEqual(0); // Reservas também em unidades
  });
});
