import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { products, inventory, warehouseLocations, warehouseZones, tenants } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("products.checkAvailability", () => {
  let testTenantId: number;
  let testProductId: number;
  let testLocationId: number;
  let testZoneId: number;
  let expZoneId: number;
  let expLocationId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const [tenant] = await db.insert(tenants).values({
      name: "Test Tenant - CheckAvailability",
      cnpj: "12345678000199",
      status: "active",
    }).$returningId();
    testTenantId = tenant.id;

    // Buscar zona de armazenagem existente (ou criar se não existir)
    const existingZones = await db.select().from(warehouseZones).where(eq(warehouseZones.code, "A01")).limit(1);
    if (existingZones.length > 0) {
      testZoneId = existingZones[0].id;
    } else {
      // Usar timestamp para código único
      const uniqueCode = `TST${Date.now().toString().slice(-6)}`;
      const [zone] = await db.insert(warehouseZones).values({
        name: "Zona Teste",
        code: uniqueCode,
        warehouseId: 1,
        storageCondition: "ambient",
      }).$returningId();
      testZoneId = zone.id;
    }

    // Buscar zona de expedição existente
    const existingExpZones = await db.select().from(warehouseZones).where(eq(warehouseZones.code, "EXP")).limit(1);
    if (existingExpZones.length > 0) {
      expZoneId = existingExpZones[0].id;
    } else {
      throw new Error("Zona EXP não encontrada no banco de dados");
    }

    // Criar endereço de armazenagem
    const uniqueLocationCode = `TST-${Date.now().toString().slice(-6)}-A`;
    const [location] = await db.insert(warehouseLocations).values({
      code: uniqueLocationCode,
      zoneId: testZoneId,
      tenantId: testTenantId,
      warehouseId: 1,
      status: "occupied",
      locationType: "whole",
      storageRule: "single",
    }).$returningId();
    testLocationId = location.id;

    // Criar endereço de expedição
    const uniqueExpLocationCode = `EXP-${Date.now().toString().slice(-6)}-A`;
    const [expLocation] = await db.insert(warehouseLocations).values({
      code: uniqueExpLocationCode,
      zoneId: expZoneId,
      tenantId: testTenantId,
      warehouseId: 1,
      status: "occupied",
      locationType: "whole",
      storageRule: "multi",
    }).$returningId();
    expLocationId = expLocation.id;

    // Criar produto de teste
    const [product] = await db.insert(products).values({
      tenantId: testTenantId,
      sku: "TEST-AVAIL-001",
      description: "Produto Teste Disponibilidade",
      unitsPerBox: 10,
      requiresBatchControl: true,
      requiresExpiryControl: true,
    }).$returningId();
    testProductId = product.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    await db.delete(inventory).where(eq(inventory.productId, testProductId));
    await db.delete(products).where(eq(products.id, testProductId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.id, testLocationId));
    await db.delete(warehouseLocations).where(eq(warehouseLocations.id, expLocationId));
    // Não deletar zonas pois podem ser zonas existentes do sistema
    // await db.delete(warehouseZones).where(eq(warehouseZones.id, testZoneId));
    // await db.delete(warehouseZones).where(eq(warehouseZones.id, expZoneId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve retornar produto não cadastrado quando produto não existe", async () => {
    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    await expect(
      caller.products.checkAvailability({
        productId: 999999,
        tenantId: testTenantId,
        requestedQuantity: 10,
        unit: "unit",
      })
    ).rejects.toThrow("Produto não cadastrado");
  });

  it("deve retornar disponível quando há estoque suficiente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Adicionar estoque disponível
    await db.insert(inventory).values({
      productId: testProductId,
      tenantId: testTenantId,
      locationId: testLocationId,
      batchNumber: "LOTE001",
      expiryDate: new Date("2026-12-31"),
      quantity: 100,
      reservedQuantity: 0,
    });

    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    const result = await caller.products.checkAvailability({
      productId: testProductId,
      tenantId: testTenantId,
      requestedQuantity: 50,
      unit: "unit",
    });

    expect(result.available).toBe(true);
    expect(result.totalAvailable).toBe(100);
    expect(result.requestedUnits).toBe(50);
    expect(result.hasStockInSpecialZonesOnly).toBe(false);

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.productId, testProductId),
        eq(inventory.locationId, testLocationId)
      )
    );
  });

  it("deve retornar indisponível quando quantidade é insuficiente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Adicionar estoque insuficiente
    await db.insert(inventory).values({
      productId: testProductId,
      tenantId: testTenantId,
      locationId: testLocationId,
      batchNumber: "LOTE002",
      expiryDate: new Date("2026-12-31"),
      quantity: 30,
      reservedQuantity: 0,
    });

    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    const result = await caller.products.checkAvailability({
      productId: testProductId,
      tenantId: testTenantId,
      requestedQuantity: 50,
      unit: "unit",
    });

    expect(result.available).toBe(false);
    expect(result.totalAvailable).toBe(30);
    expect(result.requestedUnits).toBe(50);

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.productId, testProductId),
        eq(inventory.locationId, testLocationId)
      )
    );
  });

  it("deve excluir estoque em zonas especiais (EXP)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Adicionar estoque apenas em zona EXP
    await db.insert(inventory).values({
      productId: testProductId,
      tenantId: testTenantId,
      locationId: expLocationId,
      batchNumber: "LOTE003",
      expiryDate: new Date("2026-12-31"),
      quantity: 100,
      reservedQuantity: 0,
    });

    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    const result = await caller.products.checkAvailability({
      productId: testProductId,
      tenantId: testTenantId,
      requestedQuantity: 50,
      unit: "unit",
    });

    expect(result.available).toBe(false);
    expect(result.totalAvailable).toBe(0); // Não deve contar estoque em EXP
    expect(result.hasStockInSpecialZonesOnly).toBe(true);

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.productId, testProductId),
        eq(inventory.locationId, expLocationId)
      )
    );
  });

  it("deve converter caixas para unidades corretamente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Adicionar estoque (100 unidades = 10 caixas)
    await db.insert(inventory).values({
      productId: testProductId,
      tenantId: testTenantId,
      locationId: testLocationId,
      batchNumber: "LOTE004",
      expiryDate: new Date("2026-12-31"),
      quantity: 100,
      reservedQuantity: 0,
    });

    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    const result = await caller.products.checkAvailability({
      productId: testProductId,
      tenantId: testTenantId,
      requestedQuantity: 5, // 5 caixas
      unit: "box",
    });

    expect(result.available).toBe(true);
    expect(result.totalAvailable).toBe(100); // Total em unidades
    expect(result.requestedUnits).toBe(50); // 5 caixas * 10 unidades

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.productId, testProductId),
        eq(inventory.locationId, testLocationId)
      )
    );
  });

  it("deve considerar quantidade reservada ao calcular disponibilidade", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Adicionar estoque com reserva
    await db.insert(inventory).values({
      productId: testProductId,
      tenantId: testTenantId,
      locationId: testLocationId,
      batchNumber: "LOTE005",
      expiryDate: new Date("2026-12-31"),
      quantity: 100,
      reservedQuantity: 60, // 60 reservadas
    });

    const mockUser = { openId: "test-user", name: "Test User", email: "test@example.com" };
    const caller = appRouter.createCaller({ user: mockUser, req: {} as any, res: {} as any });

    const result = await caller.products.checkAvailability({
      productId: testProductId,
      tenantId: testTenantId,
      requestedQuantity: 50,
      unit: "unit",
    });

    expect(result.available).toBe(false);
    expect(result.totalAvailable).toBe(40); // 100 - 60 reservadas
    expect(result.requestedUnits).toBe(50);

    // Limpar
    await db.delete(inventory).where(
      and(
        eq(inventory.productId, testProductId),
        eq(inventory.locationId, testLocationId)
      )
    );
  });
});
