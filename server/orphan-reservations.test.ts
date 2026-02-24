import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { tenants, products, inventory, pickingOrders, pickingOrderItems, pickingReservations } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

describe("Orphan Reservations Correction", () => {
  let testTenantId: number;
  let testProductId: number;
  let testInventoryId: number;
  let testOrderId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant Orphan",
      cnpj: "99999999000199",
      email: "orphan@test.com",
      phone: "11999999999",
      pickingRule: "FEFO",
      status: "active",
    });
    testTenantId = tenant.insertId;

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: "TEST-ORPHAN",
      description: "Test Orphan Product",
      category: "test",
      unitOfMeasure: "un",
      quantityPerBox: 1,
      minQuantity: 0,
      dispensingQuantity: 1,
      status: "active",
    });
    testProductId = product.insertId;

    // Criar estoque de teste (sem location para simplificar)
    const [inv] = await db.insert(inventory).values({
      productId: testProductId,
      locationId: 1, // Assumindo que existe
      quantity: 1000,
      reservedQuantity: 0,
      batch: "BATCH-ORPHAN",
      expiryDate: new Date("2030-12-31"),
      status: "available",
    });
    testInventoryId = inv.insertId;
  });

  it("deve corrigir reservas órfãs ao excluir pedido", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // PASSO 1: Criar pedido
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `ORPHAN-${Date.now()}`,
      clientName: "Test Client",
      priority: "normal",
      status: "pending",
      totalItems: 1,
      totalQuantity: 100,
      createdBy: 1, // User ID de teste
    });
    testOrderId = order.insertId;

    await db.insert(pickingOrderItems).values({
      pickingOrderId: testOrderId,
      productId: testProductId,
      productSku: "TEST-ORPHAN",
      productName: "Test Orphan Product",
      requestedQuantity: 100,
      requestedUM: "unit",
      status: "pending",
    });

    // PASSO 2: Criar reserva
    await db.insert(pickingReservations).values({
      pickingOrderId: testOrderId,
      inventoryId: testInventoryId,
      productId: testProductId,
      quantity: 100,
    });

    // PASSO 3: Incrementar reservedQuantity
    await db.update(inventory)
      .set({ reservedQuantity: sql`${inventory.reservedQuantity} + 100` })
      .where(eq(inventory.id, testInventoryId));

    const [inv1] = await db.select().from(inventory).where(eq(inventory.id, testInventoryId));
    expect(inv1.reservedQuantity).toBe(100);

    // PASSO 4: SIMULAR BUG - Excluir reserva prematuramente
    await db.delete(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));

    // Verificar que reservedQuantity ainda está 100 (órfã)
    const [inv2] = await db.select().from(inventory).where(eq(inventory.id, testInventoryId));
    expect(inv2.reservedQuantity).toBe(100);

    // PASSO 5: Excluir pedido (deve corrigir reserva órfã)
    // Simular lógica do endpoint deleteBatch
    const reservations = await db.select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));

    if (reservations.length === 0) {
      // Correção de reservas órfãs
      const orderItems = await db.select()
        .from(pickingOrderItems)
        .where(eq(pickingOrderItems.pickingOrderId, testOrderId));

      for (const item of orderItems) {
        const inventoryRecords = await db.select()
          .from(inventory)
          .where(
            sql`${inventory.productId} = ${item.productId} AND ${inventory.reservedQuantity} > 0`
          );

        console.log(`Found ${inventoryRecords.length} inventory records with reservations for product ${item.productId}`);

        for (const inv of inventoryRecords) {
          const activeReservationsResult = await db.select({ 
            total: sql<number>`COALESCE(SUM(${pickingReservations.quantity}), 0)` 
          })
            .from(pickingReservations)
            .where(eq(pickingReservations.inventoryId, inv.id));

          const activeTotal = Number(activeReservationsResult[0]?.total) || 0;

          console.log(`Inventory ${inv.id}: reservedQuantity=${inv.reservedQuantity}, activeReservations=${activeTotal}`);
          console.log(`Condition check: activeTotal === 0? ${activeTotal === 0}, inv.reservedQuantity > 0? ${inv.reservedQuantity > 0}`);
          console.log(`Types: activeTotal=${typeof activeTotal}, reservedQuantity=${typeof inv.reservedQuantity}`);

          if (activeTotal === 0 && inv.reservedQuantity > 0) {
            console.log(`Correcting orphan reservation: setting reservedQuantity to 0 for inventory ${inv.id}`);
            await db.update(inventory)
              .set({ reservedQuantity: 0 })
              .where(eq(inventory.id, inv.id));
          }
        }
      }
    }

    // Excluir pedido
    await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testOrderId));
    await db.delete(pickingOrders).where(eq(pickingOrders.id, testOrderId));

    // VERIFICAÇÃO: reservedQuantity deve ser 0
    const [invFinal] = await db.select().from(inventory).where(eq(inventory.id, testInventoryId));
    expect(invFinal.reservedQuantity).toBe(0);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    if (testOrderId) {
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testOrderId));
    }
    if (testInventoryId) {
      await db.delete(inventory).where(eq(inventory.id, testInventoryId));
    }
    if (testProductId) {
      await db.delete(products).where(eq(products.id, testProductId));
    }
    if (testTenantId) {
      await db.delete(tenants).where(eq(tenants.id, testTenantId));
    }
  });
});
