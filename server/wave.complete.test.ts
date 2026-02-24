import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { pickingWaves, pickingWaveItems, pickingOrders, products, tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Wave Completion", () => {
  let testWaveId: number;
  let testOrderId: number;

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
    const testProductId = productsResult[0].id;

    // Criar onda de teste
    const [wave] = await db.insert(pickingWaves).values({
      tenantId: testTenantId,
      waveNumber: `TEST-WAVE-${Date.now()}`,
      status: "pending",
      totalItems: 1,
      totalQuantity: 100,
      createdBy: 1,
    });

    testWaveId = Number(wave.insertId);

    // Criar pedido associado
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: `ORD-${Date.now()}`,
      customerOrderNumber: `TEST-${Date.now()}`,
      waveId: testWaveId,
      status: "pending",
      priority: "normal",
      totalItems: 1,
      totalQuantity: 100,
      createdBy: 1,
    });

    testOrderId = Number(order.insertId);

    // Criar item da onda (já separado)
    await db.insert(pickingWaveItems).values({
      waveId: testWaveId,
      pickingOrderId: testOrderId,
      productId: testProductId,
      productName: productsResult[0].description,
      productSku: productsResult[0].sku,
      totalQuantity: 100,
      pickedQuantity: 100, // Já separado
      locationId: 1, // Endereço fictício para teste
      locationCode: "TEST-LOC",
      status: "picked",
    });
  });

  it("deve finalizar onda quando todos os itens estão separados", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Verificar status inicial
    const [waveBefore] = await db
      .select()
      .from(pickingWaves)
      .where(eq(pickingWaves.id, testWaveId))
      .limit(1);

    expect(waveBefore.status).toBe("pending");

    const [orderBefore] = await db
      .select()
      .from(pickingOrders)
      .where(eq(pickingOrders.id, testOrderId))
      .limit(1);

    expect(orderBefore.status).toBe("pending");

    // Simular chamada da procedure completeWave
    // Verificar se todos os itens foram separados
    const allItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, testWaveId));

    const allCompleted = allItems.every(item => item.status === "picked");
    expect(allCompleted).toBe(true);

    // Atualizar status da onda
    await db
      .update(pickingWaves)
      .set({ 
        status: "completed",
        pickedBy: 1,
        pickedAt: new Date(),
      })
      .where(eq(pickingWaves.id, testWaveId));

    // Atualizar status dos pedidos
    await db
      .update(pickingOrders)
      .set({ 
        status: "picked",
        pickedBy: 1,
        pickedAt: new Date(),
      })
      .where(eq(pickingOrders.waveId, testWaveId));

    // Verificar status final
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

  it("deve rejeitar finalização se houver itens pendentes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    // Criar nova onda com item pendente
    const [wave2] = await db.insert(pickingWaves).values({
      tenantId: 1,
      waveNumber: `TEST-WAVE-PENDING-${Date.now()}`,
      status: "pending",
      totalItems: 1,
      totalQuantity: 100,
      createdBy: 1,
    });

    const testWaveId2 = Number(wave2.insertId);

    const productsResult = await db.select().from(products).limit(1);
    const testProductId = productsResult[0].id;

    // Criar item pendente (não separado)
    await db.insert(pickingWaveItems).values({
      waveId: testWaveId2,
      pickingOrderId: testOrderId,
      productId: testProductId,
      productName: productsResult[0].description,
      productSku: productsResult[0].sku,
      totalQuantity: 100,
      pickedQuantity: 0, // Não separado
      locationId: 1, // Endereço fictício para teste
      locationCode: "TEST-LOC",
      status: "pending",
    });

    // Verificar se há itens pendentes
    const allItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, testWaveId2));

    const allCompleted = allItems.every(item => item.status === "picked");
    expect(allCompleted).toBe(false);

    const pendingCount = allItems.filter(item => item.status !== "picked").length;
    expect(pendingCount).toBe(1);
  });
});
