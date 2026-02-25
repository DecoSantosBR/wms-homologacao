import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { createWave } from "./waveLogic";
import { pickingOrders, pickingWaveItems, pickingWaves, inventory } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Teste de criação de onda com múltiplas posições (FEFO multi-lote)
 * Verifica se pickingWaveItems são criados corretamente baseados nas reservas
 */
describe("Wave Creation - Multiple Positions", () => {
  let testOrderId: number;
  let testWaveId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar dados de teste anteriores
    await db.delete(pickingWaveItems).where(eq(pickingWaveItems.waveId, 1));
    await db.delete(pickingWaves).where(eq(pickingWaves.id, 1));
    await db.delete(pickingReservations).where(eq(pickingReservations.pickingOrderId, 1));
    await db.delete(pickingOrders).where(eq(pickingOrders.id, 1));
  });

  it("should create multiple pickingWaveItems when FEFO reserves from multiple positions", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Verificar estoque disponível do produto 401460P (ID: 270002)
    const stockPositions = await db
      .select({
        id: inventory.id,
        locationId: inventory.locationId,
        batch: inventory.batch,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
      })
      .from(inventory)
      .where(eq(inventory.productId, 270002))
      .orderBy(inventory.expiryDate);

    console.log("📦 Posições de estoque disponíveis:");
    stockPositions.forEach((pos, i) => {
      console.log(`  ${i+1}. ID: ${pos.id}, Lote: ${pos.batch}, Qtd: ${pos.quantity}, Reservado: ${pos.reservedQuantity}, Disponível: ${pos.quantity - pos.reservedQuantity}`);
    });

    // Verificar se há pelo menos 2 posições com estoque
    expect(stockPositions.length).toBeGreaterThanOrEqual(2);

    // 2. Criar pedido de 700 unidades (deve reservar de múltiplas posições)
    const [order] = await db.insert(pickingOrders).values({
      tenantId: 1,
      orderNumber: `TEST-MULTI-POS-${Date.now()}`,
      orderType: "normal",
      priority: "normal",
      status: "pending",
      totalItems: 1,
      totalQuantity: 700,
      createdBy: 1,
    });

    testOrderId = order.insertId;

    // 3. Simular reserva de estoque (FEFO)
    let remainingToReserve = 700;
    for (const stock of stockPositions) {
      if (remainingToReserve <= 0) break;

      const available = stock.quantity - stock.reservedQuantity;
      if (available <= 0) continue;

      const toReserve = Math.min(available, remainingToReserve);

      // Incrementar reservedQuantity
      await db
        .update(inventory)
        .set({
          reservedQuantity: stock.reservedQuantity + toReserve,
        })
        .where(eq(inventory.id, stock.id));

      // Registrar reserva
      await db.insert(pickingReservations).values({
        pickingOrderId: testOrderId,
        productId: 270002,
        inventoryId: stock.id,
        quantity: toReserve,
      });

      console.log(`✅ Reservado ${toReserve} unidades da posição ${stock.id} (lote ${stock.batch})`);

      remainingToReserve -= toReserve;
    }

    expect(remainingToReserve).toBe(0); // Todas as 700 unidades devem ter sido reservadas

    // 4. Verificar quantas reservas foram criadas
    const reservations = await db
      .select()
      .from(pickingReservations)
      .where(eq(pickingReservations.pickingOrderId, testOrderId));

    console.log(`\n📋 Total de reservas criadas: ${reservations.length}`);
    reservations.forEach((r, i) => {
      console.log(`  ${i+1}. InventoryId: ${r.inventoryId}, Quantidade: ${r.quantity}`);
    });

    expect(reservations.length).toBeGreaterThanOrEqual(2); // Deve ter reservado de pelo menos 2 posições

    // 5. Criar onda
    const waveResult = await createWave({
      orderIds: [testOrderId],
      userId: 1,
    });

    testWaveId = waveResult.waveId;

    console.log(`\n🌊 Onda criada: ${waveResult.waveNumber} (ID: ${testWaveId})`);

    // 6. Verificar pickingWaveItems criados
    const waveItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, testWaveId));

    console.log(`\n📦 Total de pickingWaveItems criados: ${waveItems.length}`);
    waveItems.forEach((item, i) => {
      console.log(`  ${i+1}. SKU: ${item.productSku}, Endereço: ${item.locationCode}, Lote: ${item.batch}, Qtd: ${item.totalQuantity}`);
    });

    // VALIDAÇÃO PRINCIPAL: Deve ter criado múltiplos waveItems (um por posição reservada)
    expect(waveItems.length).toBe(reservations.length);
    expect(waveItems.length).toBeGreaterThanOrEqual(2);

    // Verificar se a soma das quantidades dos waveItems = 700
    const totalWaveQuantity = waveItems.reduce((sum, item) => sum + item.totalQuantity, 0);
    expect(totalWaveQuantity).toBe(700);

    console.log(`\n✅ Teste passou! ${waveItems.length} pickingWaveItems criados para ${reservations.length} reservas.`);
  });
});
