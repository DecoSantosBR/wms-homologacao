import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { products, productLabels } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("receiving.generateLabelZPL", () => {
  let testProductId: number;
  const testSku = "TEST-ZPL-001";
  const testBatch = "BATCH-ZPL-001";

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Criar produto de teste
    const [product] = await db
      .insert(products)
      .values({
        sku: testSku,
        description: "Produto Teste ZPL",
        unitsPerBox: 10,
        tenantId: 1,
      })
      .onDuplicateKeyUpdate({
        set: { description: "Produto Teste ZPL" },
      });

    // Buscar ID do produto
    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, testSku))
      .limit(1);

    testProductId = existingProduct.id;
  });

  it("should generate ZPL code successfully", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "admin" },
    });

    const result = await caller.receiving.generateLabelZPL({
      productSku: testSku,
      batch: testBatch,
      productId: testProductId,
      productName: "Produto Teste ZPL",
      expiryDate: "2026-12-31",
      quantity: 1,
    });

    expect(result.success).toBe(true);
    expect(result.labelCode).toBe(`${testSku}${testBatch}`);
    expect(result.zplCode).toContain("^XA"); // Início do comando ZPL
    expect(result.zplCode).toContain("^XZ"); // Fim do comando ZPL
    expect(result.zplCode).toContain("^PW812"); // Largura 10cm (812 pontos a 203 DPI)
    expect(result.zplCode).toContain("^LL406"); // Altura 5cm (406 pontos a 203 DPI)
    expect(result.zplCode).toContain("^BCN,100"); // Código de barras Code-128 com 100pt de altura
    expect(result.zplCode).toContain(testSku); // SKU no código
    expect(result.zplCode).toContain(testBatch); // Lote no código
    expect(result.zplCode).toContain("30/12/2026"); // Data de validade formatada (timezone UTC-3)
  });

  it("should register label in productLabels table", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [label] = await db
      .select()
      .from(productLabels)
      .where(eq(productLabels.labelCode, `${testSku}${testBatch}`))
      .limit(1);

    expect(label).toBeDefined();
    expect(label.productSku).toBe(testSku);
    expect(label.batch).toBe(testBatch);
    expect(label.productId).toBe(testProductId);
  });

  it("should handle product not found", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", email: "test@example.com", role: "admin" },
    });

    await expect(
      caller.receiving.generateLabelZPL({
        productSku: "NONEXISTENT-SKU",
        batch: "BATCH-001",
        quantity: 1,
      })
    ).rejects.toThrow("não encontrado");
  });
});
