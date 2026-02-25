import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import {
  products,
  pickingOrders,
  pickingOrderItems,
  stageChecks,
  stageCheckItems,
  labelAssociations,
  tenants,
} from "../drizzle/schema";
import { recordStageItem } from "./stage";
import { eq } from "drizzle-orm";

/**
 * Testes para auto-preenchimento de quantidade no Stage
 * Valida incremento automático de +1 caixa e modal para itens fracionados
 */
describe("Stage - Auto-preenchimento de quantidade", () => {
  let dbConn: any;
  let tenantId: number;
  let productId: number;
  let pickingOrderId: number;
  let stageCheckId: number;
  let labelCode: string;
  let uniqueSuffix: string;

  beforeEach(async () => {
    uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    dbConn = await getDb();
    if (!dbConn) throw new Error("Database connection failed");

    // Criar tenant com CNPJ único
    const uniqueCnpj = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [tenant] = await dbConn.insert(tenants).values({
      name: "Teste Auto-increment",
      cnpj: uniqueCnpj.substring(0, 18),
    });
    tenantId = tenant.insertId;

    // Criar produto com unitsPerBox = 80
    const [product] = await dbConn.insert(products).values({
      tenantId,
      sku: "PROD-AUTO-001",
      description: "Produto Teste Auto-increment",
      unitsPerBox: 80,
      requiresBatchControl: true,
      requiresExpiryControl: true,
    });
    productId = product.insertId;

    // Criar etiqueta de lote
    labelCode = `${productId}L001`;
    await dbConn.insert(labelAssociations).values({
      sessionId: 1,
      tenantId,
      labelCode,
      productId,
      batch: "LOTE001",
      expiryDate: new Date("2026-12-31"),
      locationCode: "H01-01-01",
      unitsPerBox: 80,
      associatedBy: 1, // Obrigatório
    });

    // Criar pedido
    const [order] = await dbConn.insert(pickingOrders).values({
      tenantId,
      orderNumber: `ORD-AUTO-${uniqueSuffix}`,
      customerOrderNumber: `0001-${uniqueSuffix}`,
      customerName: "Cliente Teste",
      status: "picked",
      createdBy: 1,
    });
    pickingOrderId = order.insertId;

    // Criar item do pedido (160 unidades = 2 caixas)
    await dbConn.insert(pickingOrderItems).values({
      pickingOrderId,
      productId,
      requestedQuantity: 2,
      requestedUM: "box",
      batch: "LOTE001",
      expiryDate: new Date("2026-12-31"),
    });

    // Criar conferência de stage
    const [check] = await dbConn.insert(stageChecks).values({
      tenantId,
      pickingOrderId,
      customerOrderNumber: `0001-${uniqueSuffix}`,
      operatorId: 1,
      status: "in_progress",
      hasDivergence: false,
    });
    stageCheckId = check.insertId;

    // Criar item esperado (160 unidades)
    await dbConn.insert(stageCheckItems).values({
      stageCheckId,
      productId,
      productSku: "PROD-AUTO-001",
      productName: "Produto Teste Auto-increment",
      expectedQuantity: 160,
      checkedQuantity: 0,
      divergence: 0,
    });
  });

  it("deve incrementar automaticamente +1 caixa (80 unidades) quando item é inteiro", async () => {
    const result = await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    expect(result.isFractional).toBe(false);
    expect(result.quantityAdded).toBe(80);
    expect(result.checkedQuantity).toBe(80);
    expect(result.remainingQuantity).toBe(80); // 160 - 80 = 80
    expect(result.message).toContain("80");
    expect(result.message).toContain("80/160");
  });

  it("deve incrementar +1 caixa na segunda bipagem", async () => {
    // Primeira bipagem: 80 unidades
    await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    // Segunda bipagem: +80 unidades (total 160)
    const result = await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    expect(result.isFractional).toBe(false);
    expect(result.quantityAdded).toBe(80);
    expect(result.checkedQuantity).toBe(160);
    expect(result.remainingQuantity).toBe(0); // 160 - 160 = 0
  });

  it("deve retornar isFractional=true quando quantidade restante < 1 caixa", async () => {
    // Atualizar item esperado para 100 unidades (1 caixa + 20 unidades)
    await dbConn
      .update(stageCheckItems)
      .set({ expectedQuantity: 100 })
      .where(eq(stageCheckItems.stageCheckId, stageCheckId));

    // Primeira bipagem: 80 unidades (OK)
    await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    // Segunda bipagem: restam 20 unidades (< 1 caixa de 80)
    const result = await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    expect(result.isFractional).toBe(true);
    expect(result.remainingQuantity).toBe(20);
    expect(result.unitsPerBox).toBe(80);
    expect(result.message).toContain("fracionado");
    expect(result.message).toContain("20 unidades");
  });

  it("deve permitir registro manual após detectar item fracionado", async () => {
    // Atualizar item esperado para 100 unidades
    await dbConn
      .update(stageCheckItems)
      .set({ expectedQuantity: 100 })
      .where(eq(stageCheckItems.stageCheckId, stageCheckId));

    // Primeira bipagem: 80 unidades
    await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    // Segunda bipagem: detecta fracionado
    const fractionalResult = await recordStageItem({
      stageCheckId,
      labelCode,
      autoIncrement: true,
      tenantId,
    });

    expect(fractionalResult.isFractional).toBe(true);

    // Usuário informa quantidade manual (20 unidades)
    const manualResult = await recordStageItem({
      stageCheckId,
      labelCode,
      quantity: 20,
      autoIncrement: false,
      tenantId,
    });

    expect(manualResult.isFractional).toBe(false);
    expect(manualResult.quantityAdded).toBe(20);
    expect(manualResult.checkedQuantity).toBe(100);
    expect(manualResult.remainingQuantity).toBe(0);
  });

  it("deve validar quantidade quando autoIncrement=false e quantity não fornecida", async () => {
    await expect(
      recordStageItem({
        stageCheckId,
        labelCode,
        autoIncrement: false,
        tenantId,
      })
    ).rejects.toThrow("Quantidade inválida");
  });

  it("deve funcionar com produto sem unitsPerBox (default 1)", async () => {
    // Criar produto sem unitsPerBox
    const [product2] = await dbConn.insert(products).values({
      tenantId,
      sku: "PROD-NO-BOX",
      description: "Produto sem caixa",
      unitsPerBox: null,
      requiresBatchControl: true,
      requiresExpiryControl: true,
    });

    const labelCode2 = `${product2.insertId}L002`;
    await dbConn.insert(labelAssociations).values({
      sessionId: 1,
      tenantId,
      labelCode: labelCode2,
      productId: product2.insertId,
      batch: "LOTE002",
      expiryDate: new Date("2026-12-31"),
      locationCode: "H01-01-02",
      unitsPerBox: 1,
      associatedBy: 1, // Obrigatório
    });

    // Criar item esperado (10 unidades)
    await dbConn.insert(stageCheckItems).values({
      stageCheckId,
      productId: product2.insertId,
      productSku: "PROD-NO-BOX",
      productName: "Produto sem caixa",
      expectedQuantity: 10,
      checkedQuantity: 0,
      divergence: 0,
    });

    // Auto-increment deve usar 1 como default
    const result = await recordStageItem({
      stageCheckId,
      labelCode: labelCode2,
      autoIncrement: true,
      tenantId,
    });

    expect(result.isFractional).toBe(false);
    expect(result.quantityAdded).toBe(1);
    expect(result.checkedQuantity).toBe(1);
    expect(result.remainingQuantity).toBe(9);
  });
});
