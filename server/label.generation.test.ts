import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { products } from "../drizzle/schema";

describe("receiving.generateLabel", () => {
  let testProductSku: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar um produto existente
    const [product] = await db.select().from(products).limit(1);
    if (!product) throw new Error("No products found");
    
    testProductSku = product.sku;
  });

  it("should generate label with logo successfully", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", role: "admin" },
    } as any);

    const result = await caller.receiving.generateLabel({
      productSku: testProductSku,
      batch: "TESTBATCH123",
      expiryDate: "2026-12-31",
      quantity: 1,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.labelCode).toBe(`${testProductSku}TESTBATCH123`);
    expect(result.image).toMatch(/^data:application\/pdf;base64,/);
    expect(result.quantity).toBe(1);
  }, 30000); // 30 segundos de timeout
});
