/**
 * Testes unitários para o módulo de Separação (Picking)
 * Valida criação de pedidos, sugestões FIFO/FEFO e execução de picking
 */

import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { tenants, products, warehouseLocations, warehouseZones, inventory } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(tenantId: number, role: "admin" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    tenantId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Módulo de Separação (Picking)", () => {
  let testTenantId: number;
  let testProductId: number;
  let testLocationId: number;
  let testPickingOrderId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar tenant de teste com CNPJ único
    const uniqueCnpj = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Tenant Teste Picking",
        tradeName: "Tenant Picking",
        cnpj: uniqueCnpj.substring(0, 14),
        pickingRule: "FIFO", // Regra FIFO para testes
        status: "active",
      })
      .$returningId();
    testTenantId = tenant.id;

    // Criar produto de teste
    const [product] = await db
      .insert(products)
      .values({
        tenantId: testTenantId,
        sku: "PICK-TEST-001",
        description: "Produto Teste Picking",
        category: "Medicamentos",
        manufacturer: "Fabricante Teste",
        status: "active",
      })
      .$returningId();
    testProductId = product.id;

    // Criar zona de teste com código único
    const uniqueZoneCode = `ZONE-PICK-${Date.now()}`;
    const [zone] = await db
      .insert(warehouseZones)
      .values({
        warehouseId: 1,
        code: uniqueZoneCode,
        name: "Zona Picking Teste",
        storageCondition: "ambient",
        status: "active",
      })
      .$returningId();

    // Criar endereço de teste com código único
    const uniqueLocationCode = `A01-01-${Date.now()}`;
    const [location] = await db
      .insert(warehouseLocations)
      .values({
        zoneId: zone.id,
        tenantId: testTenantId,
        code: uniqueLocationCode,
        aisle: "A01",
        rack: "01",
        level: "01",
        locationType: "whole",
        status: "available",
      })
      .$returningId();
    testLocationId = location.id;

    // Criar estoque de teste
    await db.insert(inventory).values({
      tenantId: testTenantId,
      productId: testProductId,
      locationId: testLocationId,
      batch: "LOTE-001",
      expiryDate: new Date("2025-12-31"),
      quantity: 100,
      status: "available",
    });
  });

  describe("Criação de Pedidos de Separação", () => {
    it("deve criar um pedido de separação com sucesso", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.picking.create({
        customerName: "Cliente Teste",
        priority: "normal",
        items: [
          {
            productId: testProductId,
            requestedQuantity: 10,
            requestedUnit: "box",
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.orderNumber).toMatch(/^PICK-/);
      expect(result.customerName).toBe("Cliente Teste");
      expect(result.priority).toBe("normal");
      expect(result.status).toBe("pending");

      testPickingOrderId = result.id;
    });

    it("deve validar campos obrigatórios", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.picking.create({
          customerName: "",
          priority: "normal",
          items: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("Listagem de Pedidos", () => {
    it("deve listar pedidos de separação", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      const orders = await caller.picking.list({ limit: 10 });

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
    });

    it("deve buscar pedido por ID", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      const order = await caller.picking.getById({ id: testPickingOrderId });

      expect(order).toBeDefined();
      expect(order.id).toBe(testPickingOrderId);
      expect(order.items).toBeDefined();
      expect(Array.isArray(order.items)).toBe(true);
      expect(order.items.length).toBeGreaterThan(0);
    });
  });

  describe("Sugestões FIFO/FEFO", () => {
    it("deve sugerir endereços baseado em FIFO", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      const suggestions = await caller.picking.suggestLocations({
        productId: testProductId,
        requestedQuantity: 5,
      });

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const firstSuggestion = suggestions[0];
      expect(firstSuggestion.locationId).toBe(testLocationId);
      expect(firstSuggestion.locationCode).toBe("A01-01-01");
      expect(firstSuggestion.rule).toBe("FIFO");
      expect(firstSuggestion.priority).toBe(1);
      expect(firstSuggestion.availableQuantity).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Execução de Picking", () => {
    it("deve atualizar status do pedido para 'picking'", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      // Criar pedido para este teste
      const order = await caller.picking.create({
        customerName: "Cliente Teste Status",
        priority: "normal",
        items: [{
          productId: testProductId,
          requestedQuantity: 5,
          requestedUnit: "box",
        }],
      });

      await caller.picking.updateStatus({
        id: order.id,
        status: "picking",
      });

      const updatedOrder = await caller.picking.getById({ id: order.id });
      expect(updatedOrder.status).toBe("picking");
    });

    it("deve registrar separação de item", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      // Criar pedido para este teste
      const order = await caller.picking.create({
        customerName: "Cliente Teste Item",
        priority: "normal",
        items: [{
          productId: testProductId,
          requestedQuantity: 10,
          requestedUnit: "box",
        }],
      });

      const orderDetails = await caller.picking.getById({ id: order.id });
      const itemId = orderDetails.items[0].id;

      await caller.picking.pickItem({
        itemId,
        pickedQuantity: 10,
        locationId: testLocationId,
        batch: "LOTE-001",
      });

      const updatedOrder = await caller.picking.getById({ id: order.id });
      const pickedItem = updatedOrder.items.find((item: any) => item.id === itemId);

      expect(pickedItem).toBeDefined();
      expect(pickedItem.pickedQuantity).toBe(10);
      expect(pickedItem.status).toBe("picked");
    });

    it("deve atualizar status do pedido para 'picked'", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      // Criar pedido para este teste
      const order = await caller.picking.create({
        customerName: "Cliente Teste Picked",
        priority: "normal",
        items: [{
          productId: testProductId,
          requestedQuantity: 3,
          requestedUnit: "box",
        }],
      });

      // Separar item primeiro
      const orderDetails = await caller.picking.getById({ id: order.id });
      await caller.picking.pickItem({
        itemId: orderDetails.items[0].id,
        pickedQuantity: 3,
        locationId: testLocationId,
        batch: "LOTE-001",
      });

      // Atualizar status
      await caller.picking.updateStatus({
        id: order.id,
        status: "picked",
      });

      const finalOrder = await caller.picking.getById({ id: order.id });
      expect(finalOrder.status).toBe("picked");
    });
  });

  describe("Validações de Regra de Picking", () => {
    it("deve respeitar regra FIFO do cliente", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);

      const suggestions = await caller.picking.suggestLocations({
        productId: testProductId,
        requestedQuantity: 10,
      });

      expect(suggestions[0].rule).toBe("FIFO");
    });

    it("deve permitir alterar regra de picking do cliente", async () => {
      const ctx = createTestContext(testTenantId);
      const caller = appRouter.createCaller(ctx);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Alterar regra para FEFO
      await db
        .update(tenants)
        .set({ pickingRule: "FEFO" })
        .where(eq(tenants.id, testTenantId));

      const suggestions = await caller.picking.suggestLocations({
        productId: testProductId,
        requestedQuantity: 10,
      });

      expect(suggestions[0].rule).toBe("FEFO");

      // Restaurar para FIFO
      await db
        .update(tenants)
        .set({ pickingRule: "FIFO" })
        .where(eq(tenants.id, testTenantId));
    });
  });
});
