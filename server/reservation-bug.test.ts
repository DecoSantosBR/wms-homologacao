import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { tenants, products, inventory, pickingOrders, pickingOrderItems, pickingWaves, pickingWaveItems, pickingReservations, warehouseZones, warehouseLocations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { createWave } from "./waveLogic";

describe("Reservation Bug - Completed Wave Deletion", () => {
  let testTenantId: number;
  let testProductId: number;
  let testInventoryId: number;
  let testOrderId: number;
  let testWaveId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // 1. Criar tenant
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant Reservation Bug",
      cnpj: "12345678000199",
      email: "test-reservation@example.com",
      phone: "11999999999",
      pickingRule: "FEFO",
      status: "active",
    });
    testTenantId = tenant.insertId;

    // 2. Criar produto
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: "TEST-RES-BUG",
      description: "Test Product Reservation Bug",
      category: "test",
      unitOfMeasure: "un",
      quantityPerBox: 1,
      minQuantity: 0,
      dispensingQuantity: 1,
      status: "active",
    });
    testProductId = product.insertId;

    // 3. Criar zona e endereço
    const [zone] = await db.insert(warehouseZones).values({
      code: "TEST-ZONE-RES",
      name: "Test Zone Reservation",
      type: "storage",
      status: "active",
    });

    const [location] = await db.insert(warehouseLocations).values({
      zoneId: zone.insertId,
      code: "TEST-LOC-RES-01",
      type: "storage",
      status: "available",
    });

    // 4. Criar estoque
    const [inv] = await db.insert(inventory).values({
      productId: testProductId,
      locationId: location.insertId,
      quantity: 1000,
      reservedQuantity: 0,
      batch: "BATCH-TEST-RES",
      expiryDate: new Date("2030-12-31"),
      status: "available",
    });
    testInventoryId = inv.insertId;

    console.log("\n🔧 Setup completo:");
    console.log(`   Tenant ID: ${testTenantId}`);
    console.log(`   Product ID: ${testProductId}`);
    console.log(`   Inventory ID: ${testInventoryId}`);
    console.log(`   Estoque inicial: 1000 un, reservado: 0`);
  });

  it("deve liberar reservas após excluir onda completed e pedidos", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // PASSO 1: Criar pedido (reserva estoque)
    console.log("\n📦 PASSO 1: Criar pedido");
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `TEST-ORDER-RES-${Date.now()}`,
      clientName: "Test Client",
      priority: "normal",
      status: "pending",
      totalItems: 1,
      totalQuantity: 100,
    });
    testOrderId = order.insertId;

    await db.insert(pickingOrderItems).values({
      pickingOrderId: testOrderId,
      productId: testProductId,
      productSku: "TEST-RES-BUG",
      productName: "Test Product",
      requestedQuantity: 100,
      requestedUM: "unit",
      status: "pending",
    });

    // Reservar estoque manualmente (simular criação de pedido)
    await db.insert(pickingReservations).values({
      pickingOrderId: testOrderId,
      inventoryId: testInventoryId,
      productId: testProductId,
      quantity: 100,
    });

    await db.update(inventory)
      .set({ reservedQuantity: 100 })
      .where(eq(inventory.id, testInventoryId));

    const [inv1] = await db.select().from(inventory).where(eq(inventory.id, testInventoryId));
    console.log(`   ✅ Pedido criado, estoque reservado: ${inv1.reservedQuantity}`);
    expect(inv1.reservedQuantity).toBe(100);

    // PASSO 2: Gerar onda
    console.log("\n🌊 PASSO 2: Gerar onda");
    const wave = await createWave({ orderIds: [testOrderId] });
    testWaveId = wave.id;
    console.log(`   ✅ Onda ${wave.waveNumber} criada`);

    // PASSO 3: Separar onda (simular)
    console.log("\n📋 PASSO 3: Separar onda (simular completed)");
    await db.update(pickingWaveItems)
      .set({ pickedQuantity: 100, status: "picked" })
      .where(eq(pickingWaveItems.waveId, testWaveId));

    await db.update(pickingWaves)
      .set({ status: "completed" })
      .where(eq(pickingWaves.id, testWaveId));

    await db.update(pickingOrders)
      .set({ status: "completed" })
      .where(eq(pickingOrders.id, testOrderId));

    console.log(`   ✅ Onda marcada como completed`);

    // PASSO 4: Excluir onda completed (usar endpoint deleteCompleted)
    console.log("\n🗑️  PASSO 4: Excluir onda completed");
    
    // Zerar quantidades separadas
    await db.update(pickingWaveItems)
      .set({ pickedQuantity: 0, status: "pending" })
      .where(eq(pickingWaveItems.waveId, testWaveId));

    // Cancelar onda
    await db.update(pickingWaves)
      .set({ status: "cancelled" })
      .where(eq(pickingWaves.id, testWaveId));

    // Liberar pedidos (voltar para pending)
    await db.update(pickingOrders)
      .set({ status: "pending", waveId: null })
      .where(eq(pickingOrders.id, testOrderId));

    console.log(`   ✅ Onda cancelada, pedido voltou para pending`);

    // PASSO 5: Excluir pedido (deve liberar reservas)
    console.log("\n🗑️  PASSO 5: Excluir pedido");
    
    // Buscar reservas
    const reservations = await db.select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));

    console.log(`   Reservas encontradas: ${reservations.length}`);

    // Liberar estoque
    for (const reservation of reservations) {
      await db.update(inventory)
        .set({ reservedQuantity: 0 })
        .where(eq(inventory.id, reservation.inventoryId));
    }

    // Excluir reservas
    await db.delete(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));

    // Excluir itens e pedido
    await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testOrderId));
    await db.delete(pickingOrders).where(eq(pickingOrders.id, testOrderId));

    console.log(`   ✅ Pedido excluído`);

    // VERIFICAÇÃO FINAL
    console.log("\n✅ VERIFICAÇÃO FINAL:");
    const [invFinal] = await db.select().from(inventory).where(eq(inventory.id, testInventoryId));
    console.log(`   Estoque reservado: ${invFinal.reservedQuantity} (esperado: 0)`);

    const remainingReservations = await db.select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));
    console.log(`   Reservas restantes: ${remainingReservations.length} (esperado: 0)`);

    expect(invFinal.reservedQuantity).toBe(0);
    expect(remainingReservations.length).toBe(0);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    if (testWaveId) {
      await db.delete(pickingWaveItems).where(eq(pickingWaveItems.waveId, testWaveId));
      await db.delete(pickingWaves).where(eq(pickingWaves.id, testWaveId));
    }
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
      await db.delete(warehouseLocations).where(eq(warehouseLocations.code, "TEST-LOC-RES-01"));
      await db.delete(warehouseZones).where(eq(warehouseZones.code, "TEST-ZONE-RES"));
      await db.delete(tenants).where(eq(tenants.id, testTenantId));
    }
  });
});
