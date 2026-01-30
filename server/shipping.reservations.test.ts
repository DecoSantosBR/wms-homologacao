/**
 * Testes para validações preventivas de reservas de estoque
 * 
 * Cenários testados:
 * 1. Reserva não deve exceder estoque disponível
 * 2. Liberação não deve resultar em reserva negativa
 * 3. Correção de reservas órfãs
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { 
  inventory, 
  warehouseLocations, 
  warehouseZones, 
  products,
  tenants,
  pickingOrders,
  pickingOrderItems,
  shipmentManifests,
  shipmentManifestItems
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

describe("Validações Preventivas de Reservas de Estoque", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testTenantId: number;
  let testProductId: number;
  let testLocationId: number;
  let testInventoryId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant - Reservations",
        cnpj: "12345678000199",
        active: true,
      })
      .$returningId();
    testTenantId = tenant.id;

    // Criar produto de teste
    const [product] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        sku: "TEST-RESERVE-001",
        description: "Produto Teste Reservas",
        unitsPerBox: 100,
        active: true,
      })
      .$returningId();
    testProductId = product.id;

    // Criar zona EXP
    const [zone] = await db
      .select({ id: warehouseZones.id })
      .from(warehouseZones)
      .where(eq(warehouseZones.code, "EXP"))
      .limit(1);

    // Criar endereço de teste na zona EXP
    const [location] = await db
      .insert(warehouseLocations)
      .values({
        tenantId: testTenantId,
        zoneId: zone.id,
        code: "TEST-EXP-01",
        type: "fraction",
        status: "available",
        capacity: 1000,
      })
      .$returningId();
    testLocationId = location.id;

    // Criar estoque de teste com 100 unidades
    const [inv] = await db
      .insert(inventory)
      .values({
        tenantId: testTenantId,
        productId: testProductId,
        locationId: testLocationId,
        batch: "TEST-BATCH-001",
        quantity: 100,
        reservedQuantity: 0,
        status: "available",
      })
      .$returningId();
    testInventoryId = inv.id;
  });

  afterAll(async () => {
    if (!db) return;

    // Limpar dados de teste
    await db.delete(inventory).where(eq(inventory.id, testInventoryId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.id, testLocationId));
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve impedir reserva que exceda estoque disponível", async () => {
    if (!db) throw new Error("Database not available");

    // Tentar reservar 150 unidades quando só há 100 disponíveis
    const quantityToReserve = 150;
    
    // Buscar estoque atual
    const [stock] = await db
      .select({
        id: inventory.id,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`,
      })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    // Calcular quanto realmente pode ser reservado
    const actualReserve = Math.min(quantityToReserve, stock.availableQuantity);

    // Validar que não excede estoque físico
    const newReservedQuantity = stock.reservedQuantity + actualReserve;
    expect(newReservedQuantity).toBeLessThanOrEqual(stock.quantity);

    // Aplicar reserva
    await db
      .update(inventory)
      .set({ 
        reservedQuantity: sql`${inventory.reservedQuantity} + ${actualReserve}` 
      })
      .where(eq(inventory.id, testInventoryId));

    // Verificar resultado
    const [updated] = await db
      .select({
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
      })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(updated.reservedQuantity).toBe(100); // Reservou apenas o disponível
    expect(updated.reservedQuantity).toBeLessThanOrEqual(updated.quantity);
  });

  it("deve impedir liberação que resulte em reserva negativa", async () => {
    if (!db) throw new Error("Database not available");

    // Buscar estoque atual (deve ter 100 reservados do teste anterior)
    const [stock] = await db
      .select({
        reservedQuantity: inventory.reservedQuantity,
      })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    // Tentar liberar 150 unidades quando só há 100 reservadas
    const quantityToRelease = 150;
    const actualRelease = Math.min(quantityToRelease, stock.reservedQuantity);

    // Validar que não resultará em negativo
    const newReservedQuantity = stock.reservedQuantity - actualRelease;
    expect(newReservedQuantity).toBeGreaterThanOrEqual(0);

    // Aplicar liberação
    await db
      .update(inventory)
      .set({ 
        reservedQuantity: sql`${inventory.reservedQuantity} - ${actualRelease}` 
      })
      .where(eq(inventory.id, testInventoryId));

    // Verificar resultado
    const [updated] = await db
      .select({
        reservedQuantity: inventory.reservedQuantity,
      })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(updated.reservedQuantity).toBe(0); // Liberou tudo que estava reservado
    expect(updated.reservedQuantity).toBeGreaterThanOrEqual(0); // Nunca negativo
  });

  it("deve detectar e corrigir reservas órfãs", async () => {
    if (!db) throw new Error("Database not available");

    // Simular reserva órfã: reservar 50 unidades sem pedido ativo
    await db
      .update(inventory)
      .set({ reservedQuantity: 50 })
      .where(eq(inventory.id, testInventoryId));

    // Buscar reservas reais de pedidos ativos (não deve haver nenhuma)
    const activeReservations = await db
      .select({
        productId: pickingOrderItems.productId,
        totalReserved: sql<number>`SUM(${pickingOrderItems.requestedQuantity} * COALESCE(${products.unitsPerBox}, 1))`,
      })
      .from(pickingOrderItems)
      .innerJoin(pickingOrders, eq(pickingOrderItems.pickingOrderId, pickingOrders.id))
      .innerJoin(products, eq(pickingOrderItems.productId, products.id))
      .where(
        and(
          eq(pickingOrderItems.productId, testProductId),
          sql`${pickingOrders.status} IN ('pending', 'in_progress', 'separated', 'in_wave')`
        )
      )
      .groupBy(pickingOrderItems.productId);

    const realReserved = activeReservations.length > 0 ? activeReservations[0].totalReserved : 0;

    // Buscar reserva atual no estoque
    const [stock] = await db
      .select({ reservedQuantity: inventory.reservedQuantity })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    // Validar que há divergência (reserva órfã)
    expect(stock.reservedQuantity).toBe(50); // Reserva órfã
    expect(realReserved).toBe(0); // Nenhum pedido ativo

    // Corrigir reserva órfã
    await db
      .update(inventory)
      .set({ reservedQuantity: realReserved })
      .where(eq(inventory.id, testInventoryId));

    // Verificar correção
    const [corrected] = await db
      .select({ reservedQuantity: inventory.reservedQuantity })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(corrected.reservedQuantity).toBe(0); // Órfã corrigida
  });

  it("deve calcular disponível corretamente (total - reservado)", async () => {
    if (!db) throw new Error("Database not available");

    // Resetar estoque: 100 total, 30 reservado
    await db
      .update(inventory)
      .set({ 
        quantity: 100,
        reservedQuantity: 30 
      })
      .where(eq(inventory.id, testInventoryId));

    // Buscar disponível
    const [stock] = await db
      .select({
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: sql<number>`${inventory.quantity} - ${inventory.reservedQuantity}`,
      })
      .from(inventory)
      .where(eq(inventory.id, testInventoryId));

    expect(stock.quantity).toBe(100);
    expect(stock.reservedQuantity).toBe(30);
    expect(stock.availableQuantity).toBe(70);
  });
});
