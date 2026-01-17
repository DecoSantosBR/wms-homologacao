import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { tenants, pickingOrders, pickingOrderItems, pickingWaves, products, warehouseLocations, inventory, warehouseZones } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Testes para endpoints de Wave Picking
 * 
 * Testa a criação, listagem e gerenciamento de ondas de separação
 */

describe("Wave Picking Endpoints", () => {
  let testTenantId: number;
  let testOrderIds: number[] = [];
  let testWaveId: number;

  const adminUser = {
    id: 1,
    openId: "test-admin",
    name: "Admin Test",
    email: "admin@test.com",
    loginMethod: "email" as const,
    role: "admin" as const,
    tenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const clientUser = {
    id: 2,
    openId: "test-client",
    name: "Client Test",
    email: "client@test.com",
    loginMethod: "email" as const,
    role: "user" as const,
    tenantId: 0, // Será preenchido após criar tenant
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste
    const timestamp = Date.now().toString().slice(-8);
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Test Tenant Wave",
        cnpj: `${timestamp}000199`,
        email: "wave@test.com",
        phone: "1234567890",
        address: "Test Address",
        pickingRule: "fifo",
      })
      .$returningId();

    testTenantId = tenant.id;
    clientUser.tenantId = testTenantId;

    // Criar produto de teste
    const [product] = await db
      .insert(products)
      .values({
        sku: "TEST-WAVE-001",
        name: "Test Product Wave",
        description: "Product for wave picking tests",
        category: "Test",
        unitOfMeasure: "UN",
        tenantId: testTenantId,
      })
      .$returningId();

    // Nota: Não criamos estoque/endereços nos testes unitários
    // A lógica de alocação será testada em testes de integração

    // Criar 3 pedidos de teste
    for (let i = 1; i <= 3; i++) {
      const [order] = await db
        .insert(pickingOrders)
        .values({
          orderNumber: `TEST-WAVE-${i}`,
          tenantId: testTenantId,
          status: "pending",
          totalItems: 1,
          totalQuantity: 10 * i,
          customerName: "Test Customer",
          deliveryAddress: "Test Address",
          carrier: "Test Carrier",
          createdBy: adminUser.id,
        })
        .$returningId();

      testOrderIds.push(order.id);

      // Adicionar item ao pedido
      await db.insert(pickingOrderItems).values({
        pickingOrderId: order.id,
        productId: testProductId,
        requestedQuantity: 10 * i,
        status: "pending",
      });
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar dados de teste
    if (testWaveId) {
      await db.delete(pickingWaves).where(eq(pickingWaves.id, testWaveId));
    }
    
    for (const orderId of testOrderIds) {
      await db.delete(pickingOrderItems).where(eq(pickingOrderItems.pickingOrderId, orderId));
      await db.delete(pickingOrders).where(eq(pickingOrders.id, orderId));
    }

    await db.delete(products).where(eq(products.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  it("deve criar onda de separação consolidando pedidos", async () => {
    const caller = appRouter.createCaller({
      user: adminUser,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.picking.createWave({
      orderIds: testOrderIds,
    });

    expect(result).toBeDefined();
    expect(result.wave).toBeDefined();
    expect(result.wave.waveNumber).toMatch(/^OS-\d{8}-\d{4}$/);
    expect(result.wave.totalOrders).toBe(3);
    expect(result.wave.status).toBe("pending");
    expect(result.items).toBeDefined();
    expect(result.items.length).toBeGreaterThan(0);

    testWaveId = result.wave.id;
  });

  it("deve listar ondas de separação", async () => {
    const caller = appRouter.createCaller({
      user: clientUser,
      req: {} as any,
      res: {} as any,
    });

    const waves = await caller.picking.listWaves();

    expect(Array.isArray(waves)).toBe(true);
    expect(waves.length).toBeGreaterThan(0);
    expect(waves[0]).toHaveProperty("waveNumber");
    expect(waves[0]).toHaveProperty("status");
  });

  it("deve buscar detalhes de uma onda", async () => {
    const caller = appRouter.createCaller({
      user: adminUser,
      req: {} as any,
      res: {} as any,
    });

    const wave = await caller.picking.getWaveById({ id: testWaveId });

    expect(wave).toBeDefined();
    expect(wave.id).toBe(testWaveId);
    expect(wave.orders).toBeDefined();
    expect(wave.orders.length).toBe(3);
    expect(wave.items).toBeDefined();
  });

  it("deve atualizar status da onda", async () => {
    const caller = appRouter.createCaller({
      user: adminUser,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.picking.updateWaveStatus({
      id: testWaveId,
      status: "picking",
    });

    expect(result.success).toBe(true);

    // Verificar se status foi atualizado
    const wave = await caller.picking.getWaveById({ id: testWaveId });
    expect(wave.status).toBe("picking");
  });

  it("deve negar acesso a onda de outro tenant", async () => {
    const otherUser = {
      ...clientUser,
      id: 999,
      tenantId: 9999, // Tenant diferente
    };

    const caller = appRouter.createCaller({
      user: otherUser,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      caller.picking.getWaveById({ id: testWaveId })
    ).rejects.toThrow("Acesso negado");
  });

  it("deve validar que pedidos são do mesmo cliente", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar pedido de outro cliente
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other Tenant",
        cnpj: "98765432000188",
        email: "other@test.com",
        phone: "9876543210",
        address: "Other Address",
        pickingRule: "fifo",
      })
      .$returningId();

    const [otherOrder] = await db
      .insert(pickingOrders)
      .values({
        orderNumber: "OTHER-ORDER",
        tenantId: otherTenant.id,
        status: "pending",
        totalItems: 1,
        totalQuantity: 10,
      })
      .$returningId();

    const caller = appRouter.createCaller({
      user: adminUser,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      caller.picking.createWave({
        orderIds: [testOrderIds[0], otherOrder.id],
      })
    ).rejects.toThrow();

    // Limpar
    await db.delete(pickingOrders).where(eq(pickingOrders.id, otherOrder.id));
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });
});
