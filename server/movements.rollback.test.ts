/**
 * Teste para validar que estoque NÃO é perdido quando validação de múltiplos lotes falha
 * Bug crítico: estoque era removido da origem antes de validar destino
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  tenants,
  warehouses,
  warehouseZones,
  warehouseLocations,
  products,
  inventory,
} from "../drizzle/schema";
import { registerMovement } from "./movements";
import { eq, and } from "drizzle-orm";

describe("Rollback de Estoque em Validação Falhada", () => {
  let testTenantId: number;
  let testWarehouseId: number;
  let testProductId: number;
  let storageZoneId: number;
  let originLocationId: number;
  let destinationLocationId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant - Rollback",
      code: `TEST-ROLLBACK-${Date.now()}`,
      cnpj: "12345678000199",
      active: true,
    });
    testTenantId = Number(tenant.insertId);

    // Criar warehouse
    const [warehouse] = await db.insert(warehouses).values({
      code: `WH-ROLLBACK-${Date.now()}`,
      name: "Test Warehouse",
      address: "Test Address",
      status: "active",
    });
    testWarehouseId = Number(warehouse.insertId);

    // Criar zona de armazenamento (storage)
    const [storageZone] = await db.insert(warehouseZones).values({
      warehouseId: testWarehouseId,
      code: "STORAGE-ROLLBACK",
      name: "Zona de Armazenamento Teste",
      storageCondition: "ambient",
      status: "active",
    });
    storageZoneId = Number(storageZone.insertId);

    // Criar endereço de origem
    const [originLocation] = await db.insert(warehouseLocations).values({
      tenantId: testTenantId,
      zoneId: storageZoneId,
      code: `ORIGIN-${Date.now()}`,
      locationType: "whole",
      storageRule: "single",
      status: "livre",
    });
    originLocationId = Number(originLocation.insertId);

    // Criar endereço de destino
    const [destinationLocation] = await db.insert(warehouseLocations).values({
      tenantId: testTenantId,
      zoneId: storageZoneId,
      code: `DEST-${Date.now()}`,
      locationType: "whole",
      storageRule: "single",
      status: "livre",
    });
    destinationLocationId = Number(destinationLocation.insertId);

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: `SKU-ROLLBACK-${Date.now()}`,
      description: "Test Product - Rollback",
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
    await db.delete(inventory).where(eq(inventory.productId, testProductId));
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.tenantId, testTenantId));
    await db.delete(warehouseZones).where(eq(warehouseZones.warehouseId, testWarehouseId));
    await db.delete(warehouses).where(eq(warehouses.id, testWarehouseId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve PRESERVAR estoque na origem quando validação de múltiplos lotes FALHA", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // 1. Criar estoque na origem com LOTE-A
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: originLocationId,
      batch: "LOTE-A",
      quantity: 100,
      status: "available",
    });

    // 2. Criar estoque no destino com LOTE-B (diferente)
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: destinationLocationId,
      batch: "LOTE-B",
      quantity: 50,
      status: "available",
    });

    // 3. Tentar mover LOTE-A para destino que já tem LOTE-B (deve falhar)
    let errorThrown = false;
    try {
      await registerMovement({
        productId: testProductId,
        fromLocationId: originLocationId,
        toLocationId: destinationLocationId,
        quantity: 30,
        batch: "LOTE-A",
        movementType: "transfer",
        tenantId: testTenantId,
        performedBy: 1,
      });
    } catch (error: any) {
      errorThrown = true;
      // Pode ser validado por storageRule OU por validateLocationForBatch
      expect(
        error.message.includes("á possui outro lote") ||
        error.message.includes("á contém outro produto/lote")
      ).toBe(true);
    }

    // ✅ Validação deve ter falhado
    expect(errorThrown).toBe(true);

    // ✅ CRÍTICO: Estoque na origem deve PERMANECER INTACTO (100 unidades)
    const originStock = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, originLocationId),
          eq(inventory.productId, testProductId),
          eq(inventory.batch, "LOTE-A")
        )
      )
      .limit(1);

    expect(originStock.length).toBe(1);
    expect(originStock[0].quantity).toBe(100); // ✅ NÃO deve ter sido deduzido

    // ✅ Estoque no destino deve PERMANECER INALTERADO (50 unidades de LOTE-B)
    const destStock = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, destinationLocationId),
          eq(inventory.productId, testProductId)
        )
      );

    expect(destStock.length).toBe(1);
    expect(destStock[0].batch).toBe("LOTE-B");
    expect(destStock[0].quantity).toBe(50);

    // Limpar
    await db.delete(inventory).where(eq(inventory.productId, testProductId));
  });

  it("deve COMPLETAR movimentação quando validação PASSA", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Limpar estoque de testes anteriores
    await db.delete(inventory).where(eq(inventory.productId, testProductId));

    // 1. Criar estoque na origem com LOTE-C
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: originLocationId,
      batch: "LOTE-C",
      quantity: 100,
      status: "available",
    });

    // 2. Destino está vazio (validação deve passar)

    // 3. Mover LOTE-C para destino vazio (deve funcionar)
    await registerMovement({
      productId: testProductId,
      fromLocationId: originLocationId,
      toLocationId: destinationLocationId,
      quantity: 30,
      batch: "LOTE-C",
      movementType: "transfer",
      tenantId: testTenantId,
      performedBy: 1,
    });

    // ✅ Estoque na origem deve ter sido DEDUZIDO (100 - 30 = 70)
    const originStock = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, originLocationId),
          eq(inventory.productId, testProductId),
          eq(inventory.batch, "LOTE-C")
        )
      )
      .limit(1);

    expect(originStock.length).toBe(1);
    expect(originStock[0].quantity).toBe(70);

    // ✅ Estoque no destino deve ter sido CRIADO (30 unidades)
    const destStock = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.locationId, destinationLocationId),
          eq(inventory.productId, testProductId),
          eq(inventory.batch, "LOTE-C")
        )
      )
      .limit(1);

    expect(destStock.length).toBe(1);
    expect(destStock[0].quantity).toBe(30);

    // Limpar
    await db.delete(inventory).where(eq(inventory.productId, testProductId));
  });
});
