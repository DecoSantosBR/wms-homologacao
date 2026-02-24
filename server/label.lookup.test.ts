import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { productLabels, products } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("receiving.lookupProductByLabel", () => {
  let testProductId: number;
  let testLabelCode: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Buscar um produto existente
    const [product] = await db.select().from(products).limit(1);
    if (!product) throw new Error("No products found");
    
    testProductId = product.id;
    testLabelCode = `${product.sku}TESTBATCH001`;

    // Inserir etiqueta de teste
    await db.insert(productLabels).values({
      labelCode: testLabelCode,
      productId: testProductId,
      productSku: product.sku,
      batch: "TESTBATCH001",
      expiryDate: new Date("2026-12-31"),
      createdBy: 1,
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Limpar etiqueta de teste
    await db.delete(productLabels).where(eq(productLabels.labelCode, testLabelCode));
  });

  it("should lookup product by label code successfully", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", role: "admin" },
    } as any);

    const result = await caller.receiving.lookupProductByLabel({
      labelCode: testLabelCode,
    });

    expect(result).toBeDefined();
    expect(result.labelCode).toBe(testLabelCode);
    expect(result.productId).toBe(testProductId);
    expect(result.batch).toBe("TESTBATCH001");
    expect(result.productSku).toBeDefined();
    expect(result.productName).toBeDefined();
  });

  it("should throw NOT_FOUND error for non-existent label", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", role: "admin" },
    } as any);

    await expect(
      caller.receiving.lookupProductByLabel({
        labelCode: "NONEXISTENT123",
      })
    ).rejects.toThrow("não encontrada no sistema");
  });

  it("should return correct product information", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", role: "admin" },
    } as any);

    const result = await caller.receiving.lookupProductByLabel({
      labelCode: testLabelCode,
    });

    // Verificar que todos os campos necessários estão presentes
    expect(result).toHaveProperty("labelCode");
    expect(result).toHaveProperty("productId");
    expect(result).toHaveProperty("productSku");
    expect(result).toHaveProperty("productName");
    expect(result).toHaveProperty("batch");
    expect(result).toHaveProperty("expiryDate");
  });
});
