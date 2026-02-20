/**
 * Testes para validação de múltiplos lotes por endereço
 * Garante que apenas zonas DEV, NCG, REC, EXP aceitem múltiplos lotes do mesmo SKU
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  warehouses,
  warehouseZones,
  warehouseLocations,
  products,
  inventory,
  tenants,
} from "../drizzle/schema";
import { validateLocationForBatch } from "./locationValidation";
import { eq, and } from "drizzle-orm";

describe("Validação de Múltiplos Lotes por Endereço", () => {
  let testTenantId: number;
  let testWarehouseId: number;
  let testProductId: number;
  let storageZoneId: number;
  let recZoneId: number;
  let storageLocationId: number;
  let recLocationId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant - Location Validation",
      code: `TEST-LOC-${Date.now()}`,
      cnpj: "12345678000199",
      active: true,
    });
    testTenantId = Number(tenant.insertId);

    // Criar warehouse
    const [warehouse] = await db.insert(warehouses).values({
      code: `WH-LOC-${Date.now()}`,
      name: "Test Warehouse",
      address: "Test Address",
      status: "active",
    });
    testWarehouseId = Number(warehouse.insertId);

    // Criar zona de armazenamento (storage)
    const [storageZone] = await db.insert(warehouseZones).values({
      warehouseId: testWarehouseId,
      code: "STORAGE-TEST",
      name: "Zona de Armazenamento Teste",
      storageCondition: "ambient",
      status: "active",
    });
    storageZoneId = Number(storageZone.insertId);

    // Criar zona REC (recebimento)
    const [recZone] = await db.insert(warehouseZones).values({
      warehouseId: testWarehouseId,
      code: "REC",
      name: "Zona de Recebimento",
      storageCondition: "ambient",
      status: "active",
    });
    recZoneId = Number(recZone.insertId);

    // Criar endereço na zona storage
    const [storageLocation] = await db.insert(warehouseLocations).values({
      tenantId: testTenantId,
      zoneId: storageZoneId,
      code: `STORAGE-LOC-${Date.now()}`,
      locationType: "whole",
      storageRule: "single",
      status: "livre",
    });
    storageLocationId = Number(storageLocation.insertId);

    // Criar endereço na zona REC
    const [recLocation] = await db.insert(warehouseLocations).values({
      tenantId: testTenantId,
      zoneId: recZoneId,
      code: `REC-LOC-${Date.now()}`,
      locationType: "whole",
      storageRule: "single",
      status: "livre",
    });
    recLocationId = Number(recLocation.insertId);

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: `SKU-LOC-${Date.now()}`,
      description: "Test Product - Location Validation",
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

  it("deve permitir primeiro lote em endereço storage vazio", async () => {
    const result = await validateLocationForBatch(
      storageLocationId,
      testProductId,
      "LOTE-001"
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("deve permitir mesmo lote em endereço storage que já tem estoque", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar estoque com LOTE-001
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: storageLocationId,
      batch: "LOTE-001",
      quantity: 50,
      status: "available",
    });

    // Tentar adicionar mais do mesmo lote
    const result = await validateLocationForBatch(
      storageLocationId,
      testProductId,
      "LOTE-001"
    );

    expect(result.allowed).toBe(true);

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.locationId, storageLocationId),
        eq(inventory.productId, testProductId)
      )
    );
  });

  it("deve BLOQUEAR segundo lote diferente em endereço storage", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar estoque com LOTE-001
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: storageLocationId,
      batch: "LOTE-001",
      quantity: 50,
      status: "available",
    });

    // Tentar adicionar LOTE-002 (diferente)
    const result = await validateLocationForBatch(
      storageLocationId,
      testProductId,
      "LOTE-002"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("já possui outro lote");
    expect(result.reason).toContain("LOTE-001");

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.locationId, storageLocationId),
        eq(inventory.productId, testProductId)
      )
    );
  });

  it("deve PERMITIR múltiplos lotes em zona REC (zona especial)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar estoque com LOTE-001
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: recLocationId,
      batch: "LOTE-001",
      quantity: 50,
      status: "available",
    });

    // Tentar adicionar LOTE-002 (diferente) - deve permitir pois é zona REC
    const result = await validateLocationForBatch(
      recLocationId,
      testProductId,
      "LOTE-002"
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.locationId, recLocationId),
        eq(inventory.productId, testProductId)
      )
    );
  });

  it("deve permitir produtos sem lote (batch null)", async () => {
    const result = await validateLocationForBatch(
      storageLocationId,
      testProductId,
      null
    );

    expect(result.allowed).toBe(true);
  });
});
