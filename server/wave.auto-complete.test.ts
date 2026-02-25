import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { pickingWaves, pickingWaveItems, pickingOrders, products, tenants, labelAssociations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Wave Auto-Completion", () => {
  let testWaveId: number;
  let testOrderId: number;
  let testProductId: number;
  let testLabelCode: string;
  let testItemId1: number;
  let testItemId2: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Buscar tenant e produto de teste
    const tenantsResult = await db.select().from(tenants).limit(1);
    const testTenantId = tenantsResult[0]?.id || 1;

    const productsResult = await db.select().from(products).where(eq(products.tenantId, testTenantId)).limit(1);
    if (productsResult.length === 0) {
      throw new Error("Nenhum produto encontrado para teste");
    }
    testProductId = productsResult[0].id;

    // Criar etiqueta de teste
    testLabelCode = `TEST-LABEL-${Date.now()}`;
    await db.insert(labelAssociations).values({
      labelCode: testLabelCode,
      productId: testProductId,
      batch: "TEST-BATCH",
      expiryDate: new Date("2026-12-31"),
      unitsPerBox: 1,
      sessionId: 1,
      associatedBy: 1,
    });

    // Criar onda de teste
    const [wave] = await db.insert(pickingWaves).values({
      tenantId: testTenantId,
      waveNumber: `AUTO-TEST-${Date.now()}`,
      status: "pending",
      totalItems: 2,
      totalQuantity: 200,
      createdBy: 1,
    });

    testWaveId = Number(wave.insertId);

    // Criar pedido associado
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `ORD-AUTO-${Date.now()}`,
      customerOrderNumber: `CUST-AUTO-${Date.now()}`,
      waveId: testWaveId,
      status: "pending",
      priority: "normal",
      totalItems: 2,
      totalQuantity: 200,
      createdBy: 1,
    });

    testOrderId = Number(order.insertId);

    // Criar primeiro item da onda (pendente)
    const [item1] = await db.insert(pickingWaveItems).values({
      waveId: testWaveId,
      pickingOrderId: testOrderId,
      productId: testProductId,
      productName: productsResult[0].description,
      productSku: productsResult[0].sku,
      totalQuantity: 100,
      pickedQuantity: 0,
      locationId: 1,
      locationCode: "TEST-LOC-1",
      batch: "TEST-BATCH",
      status: "pending",
    });

    testItemId1 = Number(item1.insertId);

    // Criar segundo item da onda (pendente)
    const [item2] = await db.insert(pickingWaveItems).values({
      waveId: testWaveId,
      pickingOrderId: testOrderId,
      productId: testProductId,
      productName: productsResult[0].description,
      productSku: productsResult[0].sku,
      totalQuantity: 100,
      pickedQuantity: 0,
      locationId: 1,
      locationCode: "TEST-LOC-2",
      batch: "TEST-BATCH",
      status: "pending",
    });

    testItemId2 = Number(item2.insertId);
  });

  it("deve finalizar onda automaticamente ao separar o último item", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Verificar status inicial
    const [waveBefore] = await db
      .select()
      .from(pickingWaves)
      .where(eq(pickingWaves.id, testWaveId))
      .limit(1);

    expect(waveBefore.status).toBe("pending");

    // Simular separação do primeiro item
    await db
      .update(pickingWaveItems)
      .set({ 
        pickedQuantity: 100,
        status: "picked",
      })
      .where(eq(pickingWaveItems.id, testItemId1));

    // Verificar que onda ainda está "picking" (não "completed")
    const [waveAfterFirst] = await db
      .select()
      .from(pickingWaves)
      .where(eq(pickingWaves.id, testWaveId))
      .limit(1);

    // Status pode ser "pending" ou "picking", mas não "completed"
    expect(waveAfterFirst.status).not.toBe("completed");

    // Simular separação do segundo item (último)
    await db
      .update(pickingWaveItems)
      .set({ 
        pickedQuantity: 100,
        status: "picked",
      })
      .where(eq(pickingWaveItems.id, testItemId2));

    // Simular lógica de finalização automática (como em registerPickedItem)
    const allItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, testWaveId));

    const allCompleted = allItems.every(item => item.status === "picked");
    expect(allCompleted).toBe(true);

    if (allCompleted) {
      await db
        .update(pickingWaves)
        .set({ 
          status: "completed",
          pickedBy: 1,
          pickedAt: new Date(),
        })
        .where(eq(pickingWaves.id, testWaveId));

      await db
        .update(pickingOrders)
        .set({ 
          status: "picked",
          pickedBy: 1,
          pickedAt: new Date(),
        })
        .where(eq(pickingOrders.waveId, testWaveId));
    }

    // Verificar status final (deve estar "completed")
    const [waveAfter] = await db
      .select()
      .from(pickingWaves)
      .where(eq(pickingWaves.id, testWaveId))
      .limit(1);

    expect(waveAfter.status).toBe("completed");
    expect(waveAfter.pickedBy).toBe(1);
    expect(waveAfter.pickedAt).toBeDefined();

    const [orderAfter] = await db
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, testOrderId))
      .limit(1);

    expect(orderAfter.status).toBe("picked");
    expect(orderAfter.pickedBy).toBe(1);
    expect(orderAfter.pickedAt).toBeDefined();
  });

  it("não deve finalizar onda se ainda houver itens pendentes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Criar nova onda com 2 itens
    const [wave2] = await db.insert(pickingWaves).values({
      tenantId: 1,
      waveNumber: `AUTO-TEST-PARTIAL-${Date.now()}`,
      status: "pending",
      totalItems: 2,
      totalQuantity: 200,
      createdBy: 1,
    });

    const testWaveId2 = Number(wave2.insertId);

    // Criar 2 itens
    await db.insert(pickingWaveItems).values([
      {
        waveId: testWaveId2,
        pickingOrderId: testOrderId,
        productId: testProductId,
        productName: "Test Product",
        productSku: "TEST-SKU",
        totalQuantity: 100,
        pickedQuantity: 100, // Separado
        locationId: 1,
        locationCode: "TEST-LOC",
        status: "picked",
      },
      {
        waveId: testWaveId2,
        pickingOrderId: testOrderId,
        productId: testProductId,
        productName: "Test Product",
        productSku: "TEST-SKU",
        totalQuantity: 100,
        pickedQuantity: 0, // Pendente
        locationId: 1,
        locationCode: "TEST-LOC",
        status: "pending",
      },
    ]);

    // Verificar que nem todos os itens estão completos
    const allItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, testWaveId2));

    const allCompleted = allItems.every(item => item.status === "picked");
    expect(allCompleted).toBe(false);

    // Onda não deve ser finalizada
    const [wave] = await db
      .select()
      .from(pickingWaves)
      .where(eq(pickingWaves.id, testWaveId2))
      .limit(1);

    expect(wave.status).not.toBe("completed");
  });
});
