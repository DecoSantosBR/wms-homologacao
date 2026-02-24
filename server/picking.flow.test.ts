import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, warehouseZones, inventory, pickingOrders, pickingOrderItems, pickingWaves, pickingWaveItems, pickingReservations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const TEST_TENANT_ID = 999001;
const TEST_PRODUCT_ID = 999002;
const TEST_ZONE_ID = 999003;
const TEST_LOCATION_1_ID = 999004;
const TEST_INVENTORY_1_ID = 999006;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 999999,
    openId: "test-admin",
    email: "admin@test.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    tenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

async function setupTestData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await cleanupTestData();

  await db.insert(tenants).values({
    id: TEST_TENANT_ID,
    name: "Test Client",
    cnpj: "12345678000199",
    address: "Test Address",
    contactName: "Test Contact",
    contactPhone: "11999999999",
    contactEmail: "test@client.com",
    status: "active",
  });

  await db.insert(products).values({
    id: TEST_PRODUCT_ID,
    tenantId: TEST_TENANT_ID,
    sku: "TEST-PROD-001",
    description: "Test Product",
    eanCode: "7891234567890",
    anvisaCode: "123456789",
    quantityPerBox: 10,
    status: "active",
  });

  await db.insert(warehouseZones).values({
    id: TEST_ZONE_ID,
    warehouseId: 1, // Warehouse padrão
    code: "TEST-ZONE",
    name: "Test Zone",
  });

  await db.insert(warehouseLocations).values({
    id: TEST_LOCATION_1_ID,
    zoneId: TEST_ZONE_ID,
    code: "TEST-01-01-01",
    street: "01",
    building: "01",
    level: "01",
    position: "01",
    type: "storage",
    status: "available",
    storageRule: "multi",
    fractionRule: "whole",
  });

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 3);

  await db.insert(inventory).values({
    id: TEST_INVENTORY_1_ID,
    tenantId: TEST_TENANT_ID,
    productId: TEST_PRODUCT_ID,
    locationId: TEST_LOCATION_1_ID,
    quantity: 100,
    reservedQuantity: 0,
    batch: "BATCH001",
    expiryDate,
    status: "available",
  });
}

async function cleanupTestData() {
  const db = await getDb();
  if (!db) return;

  await db.delete(pickingWaveItems).where(eq(pickingWaveItems.id, TEST_INVENTORY_1_ID));
  await db.delete(pickingWaves).where(eq(pickingWaves.id, TEST_INVENTORY_1_ID));
  await db.delete(pickingReservations).where(eq(pickingReservations.productId, TEST_PRODUCT_ID));
  await db.delete(pickingOrderItems).where(eq(pickingOrderItems.productId, TEST_PRODUCT_ID));
  await db.delete(pickingOrders).where(eq(pickingOrders.tenantId, TEST_TENANT_ID));
  await db.delete(inventory).where(eq(inventory.tenantId, TEST_TENANT_ID));
  await db.delete(warehouseLocations).where(eq(warehouseLocations.zoneId, TEST_ZONE_ID));
  await db.delete(warehouseZones).where(eq(warehouseZones.id, TEST_ZONE_ID));
  await db.delete(products).where(eq(products.id, TEST_PRODUCT_ID));
  await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
}

describe("Fluxo Completo de Separação", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("deve criar pedido com sucesso quando há estoque disponível", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.picking.create({
      tenantId: TEST_TENANT_ID,
      customerName: "Test Customer",
      priority: "normal",
      items: [{
        productId: TEST_PRODUCT_ID,
        requestedQuantity: 50,
        requestedUnit: "unit",
      }],
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toMatch(/^PK\d+$/);

    const db = await getDb();
    const [order] = await db!.select().from(pickingOrders)
      .where(eq(pickingOrders.orderNumber, result.orderNumber)).limit(1);

    expect(order).toBeDefined();
    expect(order.tenantId).toBe(TEST_TENANT_ID);
    expect(order.status).toBe("pending");
    expect(order.totalQuantity).toBe(50);

    const [inv] = await db!.select().from(inventory)
      .where(eq(inventory.id, TEST_INVENTORY_1_ID)).limit(1);

    expect(inv.reservedQuantity).toBe(50);
  });

  it("deve falhar ao criar pedido com estoque insuficiente", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.picking.create({
        tenantId: TEST_TENANT_ID,
        customerName: "Test Customer",
        priority: "normal",
        items: [{
          productId: TEST_PRODUCT_ID,
          requestedQuantity: 500,
          requestedUnit: "unit",
        }],
      })
    ).rejects.toThrow(/Estoque insuficiente/);

    const db = await getDb();
    const orders = await db!.select().from(pickingOrders)
      .where(eq(pickingOrders.tenantId, TEST_TENANT_ID));

    expect(orders).toHaveLength(0);

    const [inv] = await db!.select().from(inventory)
      .where(eq(inventory.id, TEST_INVENTORY_1_ID)).limit(1);

    expect(inv.reservedQuantity).toBe(0);
  });

  it("deve falhar ao criar pedido para produto inexistente", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.picking.create({
        tenantId: TEST_TENANT_ID,
        customerName: "Test Customer",
        priority: "normal",
        items: [{
          productId: 999999,
          requestedQuantity: 10,
          requestedUnit: "unit",
        }],
      })
    ).rejects.toThrow(/não encontrado/);
  });
});
