/**
 * Testes para sincronização automática de reservas
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { syncInventoryReservations } from "./syncReservations";
import { getDb } from "./db";
import { 
  inventory, 
  products,
  tenants,
  warehouseLocations,
  warehouseZones,
  pickingOrders,
  pickingOrderItems
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Sincronização Automática de Reservas", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testTenantId: number;
  let testProductId: number;
  let testLocationId: number;
  let testInventoryId: number;
  let testOrderId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant - Sync",
        cnpj: "12345678000188",
        active: true,
      })
      .$returningId();
    testTenantId = tenant.id;

    // Criar produto de teste
    const [product] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        sku: "TEST-SYNC-001",
        description: "Produto Teste Sincronização",
        unitsPerBox: 50,
        active: true,
      })
      .$returningId();
    testProductId = product.id;

    // Criar zona EXP
    const [zone] = await db
      .select({ id: warehouseZones.id })
      .from(warehouseZones)
      .where(eq(warehouseZones.zoneCode, "EXP"))
      .limit(1);

    // Criar endereço de teste
    const [location] = await db
      .insert(warehouseLocations)
      .values({
        tenantId: testTenantId,
        zoneId: zone.id,
        code: "TEST-SYNC-01",
        type: "fraction",
        status: "available",
        capacity: 1000,
      })
      .$returningId();
    testLocationId = location.id;

    // Criar estoque com reserva órfã (100 reservadas, mas sem pedido)
    const [inv] = await db
      .insert(inventory)
      .values({
        tenantId: testTenantId,
        productId: testProductId,
        locationId: testLocationId,
        batch: "TEST-SYNC-BATCH",
        quantity: 200,
        reservedQuantity: 100, // Reserva órfã
        status: "available",
      })
      .$returningId();
    testInventoryId = inv.id;
  });

  afterAll(async () => {
    if (!db) return;

    // Limpar dados de teste
    if (testOrderId) {
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, testOrderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, testOrderId));
    }
    await db.delete(inventory).where(eq(inventory.id, testInventoryId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.id, testLocationId));
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve detectar e corrigir reserva órfã", async () => {
    if (!db) throw new Error("Database not available");

    // Verificar estado inicial (reserva órfã)
    const [before] = await db
      .select({ reservedQuantity: inventory.reservedQuantity })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(before.reservedQuantity).toBe(100); // Reserva órfã

    // Executar sincronização
    const result = await syncInventoryReservations();

    expect(result.success).toBe(true);
    expect(result.correctionsApplied).toBeGreaterThanOrEqual(1);

    // Verificar correção
    const [after] = await db
      .select({ reservedQuantity: inventory.reservedQuantity })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(after.reservedQuantity).toBe(0); // Órfã corrigida
  });

  it("deve processar todos os registros de estoque", async () => {
    if (!db) throw new Error("Database not available");

    // Executar sincronização
    const result = await syncInventoryReservations();

    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBeGreaterThan(0);
    expect(typeof result.correctionsApplied).toBe("number");
  });

  it("deve retornar relatório detalhado de correções", async () => {
    if (!db) throw new Error("Database not available");

    // Criar reserva órfã novamente
    await db
      .update(inventory)
      .set({ reservedQuantity: 50 }) // Reserva órfã
      .where(eq(inventory.id, testInventoryId));

    // Executar sincronização
    const result = await syncInventoryReservations();

    expect(result.success).toBe(true);
    expect(result.correctionsApplied).toBeGreaterThanOrEqual(1);
    expect(result.corrections).toBeDefined();
    expect(Array.isArray(result.corrections)).toBe(true);

    // Verificar estrutura do relatório
    const correction = result.corrections.find(c => c.inventoryId === testInventoryId);
    expect(correction).toBeDefined();
    expect(correction?.oldReserved).toBe(50);
    expect(correction?.newReserved).toBe(0); // Sem pedidos ativos
    expect(correction?.difference).toBe(-50);
  });
});
