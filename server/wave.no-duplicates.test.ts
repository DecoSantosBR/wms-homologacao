import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { createWave } from "./waveLogic";
import { 
  pickingOrders, 
  pickingOrderItems, 
  pickingAllocations, 
  pickingWaves, 
  pickingWaveItems,
  products,
  tenants,
  inventory,
  warehouseLocations,
  warehouseZones
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { getUniqueCode } from "./utils/uniqueCode";

/**
 * Teste de regressão para bug de duplicação em pickingWaveItems
 * 
 * BUG ORIGINAL:
 * - Quando um pedido tinha múltiplos lotes do mesmo produto (ex: 2 lotes de INTRAFIX)
 * - O JOIN em waveLogic.ts só comparava productId, não batch
 * - Resultado: produto cartesiano (2 alocações × 2 linhas de pickingOrderItems = 4 registros)
 * - Interface mostrava itens duplicados
 * 
 * CORREÇÃO:
 * - Adicionado eq(pickingAllocations.batch, pickingOrderItems.batch) no JOIN
 * - Garante match exato por SKU+Lote
 */
describe("Wave Logic - No Duplicates", () => {
  let testTenantId = 1; // Usar tenant existente
  let testProductId: number;
  let testLocationId1: number;
  let testLocationId2: number;
  let testOrderId: number;
  let testWaveId: number;
  let testUserId = 1;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar locais existentes em zonas de armazenagem (não EXP, REC, NCG, DEV)
    const locations = await db
      .select({ 
        id: warehouseLocations.id,
        locationCode: warehouseLocations.locationCode,
        zoneCode: warehouseZones.zoneCode
      })
      .from(warehouseLocations)
      .leftJoin(warehouseZones, eq(warehouseLocations.zoneId, warehouseZones.id))
      .where(sql`${warehouseZones.zoneCode} NOT IN ('EXP', 'REC', 'NCG', 'DEV')`)
      .limit(2);
    
    if (locations.length < 2) {
      throw new Error("Banco precisa ter pelo menos 2 endereços em zonas de armazenagem");
    }

    testLocationId1 = locations[0].id;
    testLocationId2 = locations[1].id;

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: "TEST-WAVE-NODUP-001",
      name: "Produto Teste Sem Duplicação",
      description: "Produto para testar que não há duplicação em ondas",
      category: "Medicamentos",
      status: "active",
    });
    testProductId = Number(product.insertId);

    // Criar estoque com 2 lotes diferentes do mesmo produto
    await db.insert(inventory).values([
      {
        tenantId: testTenantId,
        productId: testProductId,
        locationId: testLocationId1,
        batch: "LOTE-A",
        expiryDate: new Date("2026-12-31"),
        quantity: 1000,
        reservedQuantity: 0,
        status: "available",
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-A"),
      },
      {
        tenantId: testTenantId,
        productId: testProductId,
        locationId: testLocationId2,
        batch: "LOTE-B",
        expiryDate: new Date("2027-06-30"),
        quantity: 1000,
        reservedQuantity: 0,
        status: "available",
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-B"),
      },
    ]);
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
      await db.delete(pickingAllocations).where(eq(pickingAllocations.pickingOrderId, testOrderId));
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testOrderId));
    }
    if (testProductId) {
      await db.delete(inventory).where(eq(inventory.productId, testProductId));
      await db.delete(products).where(eq(products.id, testProductId));
    }
  });

  it("deve criar onda sem duplicar itens quando pedido tem múltiplos lotes do mesmo produto", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Criar pedido com 2 itens (mesmo produto, lotes diferentes)
    const [order] = await db.insert(pickingOrders).values({
      tenantId: testTenantId,
      orderNumber: "TEST-ORDER-NODUP-001",
      clientName: "Cliente Teste",
      status: "pending",
      createdBy: testUserId,
    });
    testOrderId = Number(order.insertId);

    // 2. Criar 2 linhas de pickingOrderItems (mesmo produto, lotes diferentes)
    await db.insert(pickingOrderItems).values([
      {
        pickingOrderId: testOrderId,
        productId: testProductId,
        requestedQuantity: 100,
        unit: "unit",
        unitsPerBox: 10,
        batch: "LOTE-A",
        expiryDate: new Date("2026-12-31"),
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-A"),
      },
      {
        pickingOrderId: testOrderId,
        productId: testProductId,
        requestedQuantity: 200,
        unit: "unit",
        unitsPerBox: 10,
        batch: "LOTE-B",
        expiryDate: new Date("2027-06-30"),
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-B"),
      },
    ]);

    // 3. Criar 2 alocações (mesmo produto, lotes diferentes)
    await db.insert(pickingAllocations).values([
      {
        pickingOrderId: testOrderId,
        productId: testProductId,
        productSku: "TEST-WAVE-NODUP-001",
        locationId: testLocationId1,
        locationCode: "TEST-LOC-1",
        batch: "LOTE-A",
        expiryDate: new Date("2026-12-31"),
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-A"),
        quantity: 100,
        isFractional: false,
        sequence: 1,
        status: "pending",
        pickedQuantity: 0,
      },
      {
        pickingOrderId: testOrderId,
        productId: testProductId,
        productSku: "TEST-WAVE-NODUP-001",
        locationId: testLocationId2,
        locationCode: "TEST-LOC-2",
        batch: "LOTE-B",
        expiryDate: new Date("2027-06-30"),
        uniqueCode: getUniqueCode("TEST-WAVE-NODUP-001", "LOTE-B"),
        quantity: 200,
        isFractional: false,
        sequence: 2,
        status: "pending",
        pickedQuantity: 0,
      },
    ]);

    // 4. Gerar onda
    const wave = await createWave({
      orderIds: [testOrderId],
      userId: testUserId,
    });
    testWaveId = wave.waveId;

    // 5. Verificar que pickingWaveItems tem EXATAMENTE 2 registros (não 4)
    const waveItems = await db
      .select()
      .from(pickingWaveItems)
      .where(eq(pickingWaveItems.waveId, wave.waveId));

    expect(waveItems).toHaveLength(2);

    // 6. Verificar que cada item tem uniqueCode correto
    const item1 = waveItems.find(i => i.batch === "LOTE-A");
    const item2 = waveItems.find(i => i.batch === "LOTE-B");

    expect(item1).toBeDefined();
    expect(item2).toBeDefined();

    expect(item1!.uniqueCode).toBe("TEST-WAVE-NODUP-001-LOTE-A");
    expect(item2!.uniqueCode).toBe("TEST-WAVE-NODUP-001-LOTE-B");

    expect(item1!.totalQuantity).toBe(100);
    expect(item2!.totalQuantity).toBe(200);

    // 7. Verificar que não há registros duplicados
    const uniqueCodes = waveItems.map(i => i.uniqueCode);
    const uniqueSet = new Set(uniqueCodes);
    expect(uniqueSet.size).toBe(uniqueCodes.length); // Sem duplicatas
  });
});
